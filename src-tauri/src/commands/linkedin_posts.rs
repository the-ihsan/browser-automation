use serde::Deserialize;
use tauri::{AppHandle, State};

use crate::db::{
    create_run, delete_run, get_run, list_run_items, list_runs, reset_run, CreateRunParams,
    LinkedInPostsRun, PaginatedRunItems, PaginatedRuns,
};
use crate::platforms::linkedin::{pause_run, resume_run, spawn_orchestrator, stop_run};
use crate::platforms::linkedin::orchestrator::resolve_session_ids;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct CreateRunInput {
    pub profile_url: String,
    pub session_ids: Option<Vec<String>>,
    pub post_count: Option<i32>,
    pub start_from: Option<i32>,
    pub post_matcher: Option<String>,
    pub headless: Option<bool>,
}

#[tauri::command]
pub fn linkedin_posts_runs_list(
    state: State<AppState>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<PaginatedRuns, String> {
    list_runs(&state.db, page.unwrap_or(1), page_size.unwrap_or(20))
}

#[tauri::command]
pub fn linkedin_posts_runs_get(
    state: State<AppState>,
    run_id: String,
) -> Result<LinkedInPostsRun, String> {
    get_run(&state.db, &run_id)
}

#[tauri::command]
pub fn linkedin_posts_runs_items_list(
    state: State<AppState>,
    run_id: String,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<PaginatedRunItems, String> {
    list_run_items(
        &state.db,
        &run_id,
        page.unwrap_or(1),
        page_size.unwrap_or(20),
    )
}

#[tauri::command]
pub fn linkedin_posts_run_create(
    app: AppHandle,
    state: State<AppState>,
    input: CreateRunInput,
) -> Result<LinkedInPostsRun, String> {
    let session_ids = resolve_session_ids(
        &state.db,
        &state.sessions_dir,
        input.session_ids,
    )?;

    let profile_url = crate::platforms::linkedin::normalize_profile_url(&input.profile_url)?;

    let run = create_run(
        &state.db,
        CreateRunParams {
            profile_url: &profile_url,
            session_ids: &session_ids,
            post_count: input.post_count,
            start_from: input.start_from.unwrap_or(1),
            post_matcher: input.post_matcher.as_deref(),
            headless: input.headless.unwrap_or(false),
        },
    )?;

    spawn_orchestrator(app, run.id.clone());
    Ok(run)
}

#[tauri::command]
pub fn linkedin_posts_run_pause(state: State<AppState>, run_id: String) -> Result<(), String> {
    pause_run(&state, &run_id)
}

#[tauri::command]
pub fn linkedin_posts_run_resume(app: AppHandle, run_id: String) -> Result<(), String> {
    resume_run(&app, &run_id)
}

#[tauri::command]
pub fn linkedin_posts_run_stop(state: State<AppState>, run_id: String) -> Result<(), String> {
    stop_run(&state, &run_id)
}

#[tauri::command]
pub fn linkedin_posts_run_restart(
    app: AppHandle,
    state: State<AppState>,
    run_id: String,
) -> Result<LinkedInPostsRun, String> {
    let run = reset_run(&state.db, &run_id)?;
    spawn_orchestrator(app, run.id.clone());
    Ok(run)
}

#[tauri::command]
pub fn linkedin_posts_run_delete(state: State<AppState>, run_id: String) -> Result<(), String> {
    let run = get_run(&state.db, &run_id)?;
    if matches!(
        run.status.as_str(),
        "running" | "paused" | "pending" | "stopping"
    ) {
        let _ = stop_run(&state, &run_id);
    }
    delete_run(&state.db, &run_id)
}
