use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State};

use crate::db::{
    create_session, delete_session, get_session, list_sessions, mark_checked, mark_idle,
    mark_running, platform_check_url, session_dir, storage_state_path, SessionInfo,
};
use crate::state::AppState;

use super::do_request;

#[derive(Debug, Clone, Serialize)]
pub struct StoredCookie {
    pub name: String,
    pub domain: String,
    pub path: String,
    pub value: String,
    pub expires: Option<f64>,
    pub http_only: bool,
    pub secure: bool,
    pub same_site: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionLaunchResult {
    pub session: SessionInfo,
    pub run_id: String,
    pub running: bool,
    pub url: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionCheckResult {
    pub session: SessionInfo,
    pub ok: bool,
    pub logged_in: bool,
    pub url: String,
    pub cookie_count: u32,
}

fn session_payload(
    state: &AppState,
    session_id: &str,
    extra: Value,
) -> Result<Value, String> {
    let session = get_session(&state.db, &state.sessions_dir, session_id)?;
    let check_url = platform_check_url(&session.platform)?;

    let mut payload = json!({
        "session_id": session.id,
        "platform": session.platform,
        "session_dir": session_dir(&state.sessions_dir, session_id).to_string_lossy(),
        "check_url": check_url,
        "start_url": check_url,
    });

    if let Some(obj) = payload.as_object_mut() {
        if let Some(extra_obj) = extra.as_object() {
            for (key, value) in extra_obj {
                obj.insert(key.clone(), value.clone());
            }
        }
    }

    Ok(payload)
}

#[tauri::command]
pub fn sessions_list(
    state: State<AppState>,
    platform: String,
) -> Result<Vec<SessionInfo>, String> {
    list_sessions(&state.db, &state.sessions_dir, &platform)
}

#[tauri::command]
pub fn sessions_create(
    state: State<AppState>,
    platform: String,
    name: String,
) -> Result<SessionInfo, String> {
    create_session(&state.db, &state.sessions_dir, &platform, &name)
}

#[tauri::command]
pub fn sessions_delete(state: State<AppState>, session_id: String) -> Result<(), String> {
    let session = get_session(&state.db, &state.sessions_dir, &session_id)?;
    if session.status == "running" {
        if let Some(run_id) = session.active_run_id.clone() {
            let payload = session_payload(&state, &session_id, json!({ "run_id": run_id }))?;
            let _ = do_request(&state, "session.stop", payload, 120_000);
        }
        mark_idle(&state.db, &session_id)?;
    }
    delete_session(&state.db, &state.sessions_dir, &session_id)
}

#[tauri::command]
pub fn sessions_launch(
    state: State<AppState>,
    session_id: String,
    fresh: bool,
) -> Result<SessionLaunchResult, String> {
    let session = get_session(&state.db, &state.sessions_dir, &session_id)?;
    if session.status == "running" {
        return Err(format!("session '{}' is already running", session.name));
    }

    let payload = session_payload(
        &state,
        &session_id,
        json!({ "headless": false, "fresh": fresh }),
    )?;
    let value = do_request(&state, "session.launch", payload, 120_000)?;
    let run_id = value
        .get("run_id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

    if !run_id.is_empty() {
        mark_running(&state.db, &session_id, &run_id)?;
    }

    let updated = get_session(&state.db, &state.sessions_dir, &session_id)?;
    Ok(SessionLaunchResult {
        session: updated,
        run_id,
        running: value
            .get("running")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        url: value
            .get("url")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
    })
}

#[tauri::command]
pub fn sessions_check(
    state: State<AppState>,
    session_id: String,
) -> Result<SessionCheckResult, String> {
    let session = get_session(&state.db, &state.sessions_dir, &session_id)?;
    if session.status == "running" {
        return Err(format!("session '{}' is running — stop it before checking", session.name));
    }

    let payload = session_payload(&state, &session_id, json!({}))?;
    let value = do_request(&state, "session.check", payload, 120_000)?;
    mark_checked(&state.db, &session_id)?;

    let updated = get_session(&state.db, &state.sessions_dir, &session_id)?;
    Ok(SessionCheckResult {
        session: updated,
        ok: value.get("ok").and_then(Value::as_bool).unwrap_or(false),
        logged_in: value
            .get("logged_in")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        url: value
            .get("url")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        cookie_count: value
            .get("cookie_count")
            .and_then(Value::as_u64)
            .unwrap_or(0) as u32,
    })
}

#[tauri::command]
pub fn sessions_get_cookies(
    state: State<AppState>,
    session_id: String,
) -> Result<Vec<StoredCookie>, String> {
    let path = storage_state_path(&state.sessions_dir, &session_id);
    if !path.is_file() {
        return Ok(vec![]);
    }

    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let Some(cookies) = value.get("cookies").and_then(Value::as_array) else {
        return Ok(vec![]);
    };

    Ok(cookies
        .iter()
        .filter_map(|cookie| {
            let name = cookie.get("name")?.as_str()?.to_string();
            Some(StoredCookie {
                name,
                domain: cookie
                    .get("domain")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                path: cookie
                    .get("path")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                value: cookie
                    .get("value")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                expires: cookie.get("expires").and_then(Value::as_f64),
                http_only: cookie
                    .get("httpOnly")
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
                secure: cookie
                    .get("secure")
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
                same_site: cookie
                    .get("sameSite")
                    .and_then(Value::as_str)
                    .unwrap_or("Lax")
                    .to_string(),
            })
        })
        .collect())
}

pub fn handle_session_event(app: &AppHandle, state: &AppState, channel: &str, payload: &Value) {
    if channel == "session.closed" {
        if let Some(session_id) = payload.get("session_id").and_then(Value::as_str) {
            let _ = mark_idle(&state.db, session_id);
        }
    }

    let _ = app.emit(
        "daemon://session",
        json!({ "channel": channel, "payload": payload }),
    );
}
