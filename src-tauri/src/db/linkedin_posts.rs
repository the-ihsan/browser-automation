use diesel::prelude::*;
use serde_json::Value;
use uuid::Uuid;

use super::models::{
    LinkedInPostsRun, LinkedInPostsRunItem, NewLinkedInPostsRun, NewLinkedInPostsRunItem,
    PaginatedRunItems, PaginatedRuns,
};
use super::schema::{linkedin_posts_runs, linkedin_posts_runs_item};
use super::sessions::now_iso;
use super::DbPool;

pub fn reset_running_runs_on_startup(pool: &DbPool) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let now = now_iso();
    diesel::update(
        linkedin_posts_runs::table.filter(linkedin_posts_runs::status.eq("running")),
    )
    .set((
        linkedin_posts_runs::status.eq("paused"),
        linkedin_posts_runs::updated_at.eq(&now),
    ))
    .execute(&mut conn)
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list_runs(
    pool: &DbPool,
    page: i64,
    page_size: i64,
) -> Result<PaginatedRuns, String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let page = page.max(1);
    let page_size = page_size.clamp(1, 100);
    let offset = (page - 1) * page_size;

    let total: i64 = linkedin_posts_runs::table
        .count()
        .get_result(&mut conn)
        .map_err(|e| e.to_string())?;

    let items = linkedin_posts_runs::table
        .order(linkedin_posts_runs::created_at.desc())
        .limit(page_size)
        .offset(offset)
        .load::<LinkedInPostsRun>(&mut conn)
        .map_err(|e| e.to_string())?;

    Ok(PaginatedRuns {
        items,
        total,
        page,
        page_size,
    })
}

pub fn get_run(pool: &DbPool, run_id: &str) -> Result<LinkedInPostsRun, String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    linkedin_posts_runs::table
        .find(run_id)
        .first::<LinkedInPostsRun>(&mut conn)
        .map_err(|e| e.to_string())
}

pub fn list_run_items(
    pool: &DbPool,
    run_id: &str,
    page: i64,
    page_size: i64,
) -> Result<PaginatedRunItems, String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let page = page.max(1);
    let page_size = page_size.clamp(1, 100);
    let offset = (page - 1) * page_size;

    let total: i64 = linkedin_posts_runs_item::table
        .filter(linkedin_posts_runs_item::run_id.eq(run_id))
        .count()
        .get_result(&mut conn)
        .map_err(|e| e.to_string())?;

    let items = linkedin_posts_runs_item::table
        .filter(linkedin_posts_runs_item::run_id.eq(run_id))
        .order(linkedin_posts_runs_item::ordinal.asc())
        .limit(page_size)
        .offset(offset)
        .load::<LinkedInPostsRunItem>(&mut conn)
        .map_err(|e| e.to_string())?;

    Ok(PaginatedRunItems {
        items,
        total,
        page,
        page_size,
    })
}

pub struct CreateRunParams<'a> {
    pub profile_url: &'a str,
    pub session_ids: &'a [String],
    pub post_count: Option<i32>,
    pub start_from: i32,
    pub post_matcher: Option<&'a str>,
    pub headless: bool,
}

pub fn create_run(pool: &DbPool, params: CreateRunParams<'_>) -> Result<LinkedInPostsRun, String> {
    let profile_url = params.profile_url.trim();
    if profile_url.is_empty() {
        return Err("profile_url is required".into());
    }
    if params.session_ids.is_empty() {
        return Err("at least one session is required".into());
    }

    let id = Uuid::new_v4().to_string();
    let session_ids_json =
        serde_json::to_string(params.session_ids).map_err(|e| e.to_string())?;
    let start_from = params.start_from.max(1);

    let new_run = NewLinkedInPostsRun {
        id: &id,
        profile_url,
        session_ids: &session_ids_json,
        post_count: params.post_count,
        start_from,
        post_matcher: params.post_matcher,
        headless: if params.headless { 1 } else { 0 },
        status: "pending",
    };

    let mut conn = pool.get().map_err(|e| e.to_string())?;
    diesel::insert_into(linkedin_posts_runs::table)
        .values(&new_run)
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;

    get_run(pool, &id)
}

pub fn update_run_status(
    pool: &DbPool,
    run_id: &str,
    status: &str,
    error_message: Option<&str>,
) -> Result<LinkedInPostsRun, String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let now = now_iso();
    let run = linkedin_posts_runs::table
        .find(run_id)
        .first::<LinkedInPostsRun>(&mut conn)
        .map_err(|e| e.to_string())?;

    let started_at = if status == "running" && run.started_at.is_none() {
        Some(now.clone())
    } else {
        run.started_at
    };

    let completed_at = if matches!(status, "completed" | "stopped" | "failed") {
        Some(now.clone())
    } else {
        run.completed_at
    };

    diesel::update(linkedin_posts_runs::table.find(run_id))
        .set((
            linkedin_posts_runs::status.eq(status),
            linkedin_posts_runs::error_message.eq(error_message),
            linkedin_posts_runs::updated_at.eq(&now),
            linkedin_posts_runs::started_at.eq(started_at),
            linkedin_posts_runs::completed_at.eq(completed_at),
        ))
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;

    linkedin_posts_runs::table
        .find(run_id)
        .first::<LinkedInPostsRun>(&mut conn)
        .map_err(|e| e.to_string())
}

pub fn set_run_status(pool: &DbPool, run_id: &str, status: &str) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let now = now_iso();
    diesel::update(linkedin_posts_runs::table.find(run_id))
        .set((
            linkedin_posts_runs::status.eq(status),
            linkedin_posts_runs::updated_at.eq(&now),
        ))
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn set_run_anchor(
    pool: &DbPool,
    run_id: &str,
    initial_top_post_id: &str,
    initial_post_ids: &str,
) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let now = now_iso();
    diesel::update(linkedin_posts_runs::table.find(run_id))
        .set((
            linkedin_posts_runs::initial_top_post_id.eq(Some(initial_top_post_id)),
            linkedin_posts_runs::initial_post_ids.eq(Some(initial_post_ids)),
            linkedin_posts_runs::updated_at.eq(&now),
        ))
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn increment_session_index(pool: &DbPool, run_id: &str) -> Result<i32, String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let run = linkedin_posts_runs::table
        .find(run_id)
        .first::<LinkedInPostsRun>(&mut conn)
        .map_err(|e| e.to_string())?;
    let next = run.current_session_index + 1;
    let now = now_iso();
    diesel::update(linkedin_posts_runs::table.find(run_id))
        .set((
            linkedin_posts_runs::current_session_index.eq(next),
            linkedin_posts_runs::updated_at.eq(&now),
        ))
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;
    Ok(next)
}

pub fn run_resume_state(pool: &DbPool, run_id: &str) -> Result<(Vec<String>, i32), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;

    let existing_post_ids = linkedin_posts_runs_item::table
        .filter(linkedin_posts_runs_item::run_id.eq(run_id))
        .select(linkedin_posts_runs_item::post_id)
        .load::<String>(&mut conn)
        .map_err(|e| e.to_string())?;

    #[derive(QueryableByName)]
    struct MaxOrd {
        #[diesel(sql_type = diesel::sql_types::Nullable<diesel::sql_types::Integer>)]
        max_ord: Option<i32>,
    }
    let row: MaxOrd = diesel::sql_query(
        "SELECT MAX(ordinal) AS max_ord FROM linkedin_posts_runs_item WHERE run_id = ?",
    )
    .bind::<diesel::sql_types::Text, _>(run_id)
    .get_result(&mut conn)
    .map_err(|e| e.to_string())?;

    Ok((existing_post_ids, row.max_ord.unwrap_or(0)))
}

pub fn max_ordinal(pool: &DbPool, run_id: &str) -> Result<i32, String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    #[derive(QueryableByName)]
    struct MaxOrd {
        #[diesel(sql_type = diesel::sql_types::Nullable<diesel::sql_types::Integer>)]
        max_ord: Option<i32>,
    }
    let row: MaxOrd = diesel::sql_query(
        "SELECT MAX(ordinal) AS max_ord FROM linkedin_posts_runs_item WHERE run_id = ?",
    )
    .bind::<diesel::sql_types::Text, _>(run_id)
    .get_result(&mut conn)
    .map_err(|e| e.to_string())?;
    Ok(row.max_ord.unwrap_or(0))
}

pub fn insert_run_item(
    pool: &DbPool,
    run_id: &str,
    post: &Value,
    ordinal: i32,
    matched: bool,
    session_id: Option<&str>,
) -> Result<LinkedInPostsRunItem, String> {
    let post_id = post
        .get("post_id")
        .and_then(Value::as_str)
        .ok_or("post_id is required")?;

    let id = Uuid::new_v4().to_string();
    let text = post.get("text").and_then(Value::as_str);
    let posted_at = post.get("posted_at").and_then(Value::as_str);
    let author_name = post.get("author_name").and_then(Value::as_str);
    let author_url = post.get("author_url").and_then(Value::as_str);
    let post_url = post.get("post_url").and_then(Value::as_str);
    let like_count = post.get("like_count").and_then(Value::as_i64).map(|v| v as i32);
    let comment_count = post
        .get("comment_count")
        .and_then(Value::as_i64)
        .map(|v| v as i32);
    let repost_count = post
        .get("repost_count")
        .and_then(Value::as_i64)
        .map(|v| v as i32);
    let impression_count = post
        .get("impression_count")
        .and_then(Value::as_i64)
        .map(|v| v as i32);
    let media_urls = post
        .get("media_urls")
        .map(|v| serde_json::to_string(v).unwrap_or_default());
    let raw_data = serde_json::to_string(post).ok();

    let new_item = NewLinkedInPostsRunItem {
        id: &id,
        run_id,
        post_id,
        ordinal,
        text,
        posted_at,
        author_name,
        author_url,
        post_url,
        like_count,
        comment_count,
        repost_count,
        impression_count,
        media_urls: media_urls.as_deref(),
        raw_data: raw_data.as_deref(),
        matched: if matched { 1 } else { 0 },
        session_id,
    };

    let mut conn = pool.get().map_err(|e| e.to_string())?;
    diesel::insert_into(linkedin_posts_runs_item::table)
        .values(&new_item)
        .execute(&mut conn)
        .map_err(|e| {
            if e.to_string().contains("UNIQUE") {
                format!("post '{post_id}' already exists for run '{run_id}'")
            } else {
                e.to_string()
            }
        })?;

    let now = now_iso();
    let matched_inc = if matched { 1 } else { 0 };
    diesel::update(linkedin_posts_runs::table.find(run_id))
        .set((
            linkedin_posts_runs::collected_count
                .eq(linkedin_posts_runs::collected_count + 1),
            linkedin_posts_runs::matched_count
                .eq(linkedin_posts_runs::matched_count + matched_inc),
            linkedin_posts_runs::updated_at.eq(&now),
        ))
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;

    linkedin_posts_runs_item::table
        .find(&id)
        .first::<LinkedInPostsRunItem>(&mut conn)
        .map_err(|e| e.to_string())
}

pub fn reset_run(pool: &DbPool, run_id: &str) -> Result<LinkedInPostsRun, String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let now = now_iso();

    diesel::delete(
        linkedin_posts_runs_item::table.filter(linkedin_posts_runs_item::run_id.eq(run_id)),
    )
    .execute(&mut conn)
    .map_err(|e| e.to_string())?;

    diesel::update(linkedin_posts_runs::table.find(run_id))
        .set((
            linkedin_posts_runs::status.eq("pending"),
            linkedin_posts_runs::initial_top_post_id.eq::<Option<String>>(None),
            linkedin_posts_runs::initial_post_ids.eq::<Option<String>>(None),
            linkedin_posts_runs::collected_count.eq(0),
            linkedin_posts_runs::matched_count.eq(0),
            linkedin_posts_runs::current_session_index.eq(0),
            linkedin_posts_runs::error_message.eq::<Option<String>>(None),
            linkedin_posts_runs::started_at.eq::<Option<String>>(None),
            linkedin_posts_runs::completed_at.eq::<Option<String>>(None),
            linkedin_posts_runs::updated_at.eq(&now),
        ))
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;

    get_run(pool, run_id)
}

pub fn persist_anchor_from_event(
    pool: &DbPool,
    run_id: &str,
    initial_top_post_id: &str,
    initial_post_ids: &[String],
) -> Result<(), String> {
    let json_ids = serde_json::to_string(initial_post_ids).map_err(|e| e.to_string())?;
    set_run_anchor(pool, run_id, initial_top_post_id, &json_ids)
}

pub fn set_run_error(pool: &DbPool, run_id: &str, error: &str) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let now = now_iso();
    diesel::update(linkedin_posts_runs::table.find(run_id))
        .set((
            linkedin_posts_runs::error_message.eq(Some(error)),
            linkedin_posts_runs::updated_at.eq(&now),
        ))
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_run(pool: &DbPool, run_id: &str) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    diesel::delete(linkedin_posts_runs::table.find(run_id))
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn finish_run(
    pool: &DbPool,
    run_id: &str,
    status: &str,
    error_message: Option<&str>,
) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let now = now_iso();
    diesel::update(linkedin_posts_runs::table.find(run_id))
        .set((
            linkedin_posts_runs::status.eq(status),
            linkedin_posts_runs::error_message.eq(error_message),
            linkedin_posts_runs::completed_at.eq(Some(&now)),
            linkedin_posts_runs::updated_at.eq(&now),
        ))
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;
    Ok(())
}
