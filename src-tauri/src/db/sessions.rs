use std::path::{Path, PathBuf};

use chrono::Utc;
use diesel::prelude::*;
use uuid::Uuid;

use super::models::{NewSession, Session, SessionInfo};
use super::schema::sessions;
use super::DbPool;

pub fn now_iso() -> String {
    Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

pub fn session_dir(sessions_root: &Path, session_id: &str) -> PathBuf {
    sessions_root.join(session_id)
}

pub fn storage_state_path(sessions_root: &Path, session_id: &str) -> PathBuf {
    session_dir(sessions_root, session_id).join("storage_state.json")
}

pub fn has_storage(sessions_root: &Path, session_id: &str) -> bool {
    storage_state_path(sessions_root, session_id).is_file()
}

fn to_info(session: Session, sessions_root: &Path) -> SessionInfo {
    let has_storage = has_storage(sessions_root, &session.id);
    session.into_info(has_storage)
}

pub fn reset_running_on_startup(pool: &DbPool) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let now = now_iso();
    diesel::update(sessions::table.filter(sessions::status.eq("running")))
        .set((
            sessions::status.eq("idle"),
            sessions::active_run_id.eq::<Option<String>>(None),
            sessions::updated_at.eq(&now),
        ))
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list_sessions(
    pool: &DbPool,
    sessions_root: &Path,
    platform: &str,
) -> Result<Vec<SessionInfo>, String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let rows = sessions::table
        .filter(sessions::platform.eq(platform))
        .order(sessions::name.asc())
        .load::<Session>(&mut conn)
        .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| to_info(row, sessions_root))
        .collect())
}

pub fn get_session(
    pool: &DbPool,
    sessions_root: &Path,
    session_id: &str,
) -> Result<SessionInfo, String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let row = sessions::table
        .find(session_id)
        .first::<Session>(&mut conn)
        .map_err(|e| e.to_string())?;
    Ok(to_info(row, sessions_root))
}

pub fn create_session(
    pool: &DbPool,
    sessions_root: &Path,
    platform: &str,
    name: &str,
) -> Result<SessionInfo, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("session name is required".into());
    }

    let id = Uuid::new_v4().to_string();
    let dir = session_dir(sessions_root, &id);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let new_session = NewSession {
        id: &id,
        platform,
        name: trimmed,
        status: "idle",
    };

    let mut conn = pool.get().map_err(|e| e.to_string())?;
    diesel::insert_into(sessions::table)
        .values(&new_session)
        .execute(&mut conn)
        .map_err(|e| {
            if e.to_string().contains("UNIQUE") {
                format!("a session named '{trimmed}' already exists for {platform}")
            } else {
                e.to_string()
            }
        })?;

    get_session(pool, sessions_root, &id)
}

pub fn delete_session(
    pool: &DbPool,
    sessions_root: &Path,
    session_id: &str,
) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let deleted = diesel::delete(sessions::table.find(session_id))
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;

    if deleted == 0 {
        return Err(format!("session '{session_id}' not found"));
    }

    let dir = session_dir(sessions_root, session_id);
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub fn mark_running(
    pool: &DbPool,
    session_id: &str,
    run_id: &str,
) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let now = now_iso();
    let updated = diesel::update(sessions::table.find(session_id))
        .set((
            sessions::status.eq("running"),
            sessions::active_run_id.eq(Some(run_id)),
            sessions::updated_at.eq(&now),
        ))
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;

    if updated == 0 {
        return Err(format!("session '{session_id}' not found"));
    }
    Ok(())
}

pub fn mark_idle(pool: &DbPool, session_id: &str) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let now = now_iso();
    diesel::update(sessions::table.find(session_id))
        .set((
            sessions::status.eq("idle"),
            sessions::active_run_id.eq::<Option<String>>(None),
            sessions::updated_at.eq(&now),
        ))
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn mark_checked(pool: &DbPool, session_id: &str) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let now = now_iso();
    diesel::update(sessions::table.find(session_id))
        .set((
            sessions::last_checked_at.eq(&now),
            sessions::updated_at.eq(&now),
        ))
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn platform_check_url(platform: &str) -> Result<&'static str, String> {
    match platform {
        "linkedin" => Ok("https://www.linkedin.com/feed/"),
        "facebook" => Ok("https://www.facebook.com/"),
        "twitter" => Ok("https://x.com/home"),
        other => Err(format!("unsupported platform '{other}'")),
    }
}
