use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

use crate::commands::do_request;
use crate::db::{
    finish_run, get_run, increment_session_index, list_sessions, run_resume_state, session_dir,
    set_run_error, update_run_status, DbPool, LinkedInPostsRun,
};
use crate::sidecar;
use crate::state::AppState;

pub struct OrchestratorRegistry {
    active: Mutex<HashSet<String>>,
}

impl OrchestratorRegistry {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(HashSet::new()),
        }
    }

    pub fn mark_active(&self, run_id: &str) -> bool {
        let mut set = self.active.lock().unwrap();
        if set.contains(run_id) {
            return false;
        }
        set.insert(run_id.to_string());
        true
    }

    pub fn mark_inactive(&self, run_id: &str) {
        self.active.lock().unwrap().remove(run_id);
    }
}

impl Default for OrchestratorRegistry {
    fn default() -> Self {
        Self::new()
    }
}

struct RunGuard<'a> {
    registry: &'a OrchestratorRegistry,
    run_id: &'a str,
}

impl Drop for RunGuard<'_> {
    fn drop(&mut self) {
        self.registry.mark_inactive(self.run_id);
    }
}

fn parse_session_ids(raw: &str) -> Result<Vec<String>, String> {
    serde_json::from_str(raw).map_err(|e| e.to_string())
}

fn build_start_payload(state: &AppState, run: &LinkedInPostsRun) -> Result<Value, String> {
    let session_ids = parse_session_ids(&run.session_ids)?;
    let idx = run.current_session_index as usize;
    if idx >= session_ids.len() {
        return Err("no sessions available for run".into());
    }

    let mut sessions = Vec::new();
    for sid in &session_ids {
        let dir = session_dir(&state.sessions_dir, sid);
        sessions.push(json!({
            "session_id": sid,
            "session_dir": dir.to_string_lossy(),
        }));
    }

    let initial_post_ids: Value = run
        .initial_post_ids
        .as_ref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or(json!([]));

    let (existing_post_ids, resume_from_ordinal) =
        run_resume_state(&state.db, &run.id).unwrap_or((Vec::new(), 0));

    Ok(json!({
        "run_id": run.id,
        "profile_url": run.profile_url,
        "sessions": sessions,
        "current_session_index": run.current_session_index,
        "headless": run.headless != 0,
        "post_count": run.post_count,
        "start_from": run.start_from,
        "post_matcher": run.post_matcher,
        "initial_post_ids": initial_post_ids,
        "initial_top_post_id": run.initial_top_post_id,
        "resume_from_ordinal": resume_from_ordinal,
        "existing_post_ids": existing_post_ids,
    }))
}

pub fn spawn_orchestrator(app: AppHandle, run_id: String) {
    let registry = app.state::<AppState>().linkedin_orchestrator.clone();
    if !registry.mark_active(&run_id) {
        return;
    }

    thread::spawn(move || {
        let _guard = RunGuard {
            registry: &registry,
            run_id: &run_id,
        };

        loop {
            let state = app.state::<AppState>();
            let run = match get_run(&state.db, &run_id) {
                Ok(r) => r,
                Err(e) => {
                    let _ = set_run_error(&state.db, &run_id, &e);
                    break;
                }
            };

            match run.status.as_str() {
                "stopping" | "stopped" => {
                    let _ = sidecar::emit(
                        &state.daemon,
                        "linkedin.posts.run.control",
                        json!({ "run_id": run_id, "action": "stop" }),
                    );
                    let _ = finish_run(&state.db, &run_id, "stopped", None);
                    break;
                }
                "paused" => {
                    thread::sleep(Duration::from_secs(1));
                    continue;
                }
                "pending" | "running" => {}
                _ => break,
            }

            if run.status == "pending" {
                let _ = update_run_status(&state.db, &run_id, "running", None);
            }

            let payload = match build_start_payload(&state, &run) {
                Ok(p) => p,
                Err(e) => {
                    let _ = finish_run(&state.db, &run_id, "failed", Some(&e));
                    break;
                }
            };

            if let Err(e) = do_request(&state, "linkedin.posts.run.start", payload, 120_000) {
                let _ = set_run_error(&state.db, &run_id, &e);
                let _ = finish_run(&state.db, &run_id, "failed", Some(&e));
                break;
            }

            loop {
                thread::sleep(Duration::from_secs(1));
                let state = app.state::<AppState>();
                let run = match get_run(&state.db, &run_id) {
                    Ok(r) => r,
                    Err(_) => return,
                };

                match run.status.as_str() {
                    "running" => {}
                    "paused" => break,
                    "stopping" => {
                        let _ = sidecar::emit(
                            &state.daemon,
                            "linkedin.posts.run.control",
                            json!({ "run_id": run_id, "action": "stop" }),
                        );
                        let _ = finish_run(&state.db, &run_id, "stopped", None);
                        return;
                    }
                    "completed" | "failed" | "stopped" => return,
                    _ => break,
                }
            }
        }
    });
}

pub fn pause_run(state: &AppState, run_id: &str) -> Result<(), String> {
    update_run_status(&state.db, run_id, "paused", None)?;
    sidecar::emit(
        &state.daemon,
        "linkedin.posts.run.control",
        json!({ "run_id": run_id, "action": "pause" }),
    );
    Ok(())
}

pub fn resume_run(app: &AppHandle, run_id: &str) -> Result<(), String> {
    let state = app.state::<AppState>();
    update_run_status(&state.db, run_id, "running", None)?;
    sidecar::emit(
        &state.daemon,
        "linkedin.posts.run.control",
        json!({ "run_id": run_id, "action": "resume" }),
    );
    spawn_orchestrator(app.clone(), run_id.to_string());
    Ok(())
}

pub fn stop_run(state: &AppState, run_id: &str) -> Result<(), String> {
    update_run_status(&state.db, run_id, "stopping", None)?;
    sidecar::emit(
        &state.daemon,
        "linkedin.posts.run.control",
        json!({ "run_id": run_id, "action": "stop" }),
    );
    Ok(())
}

pub fn resolve_session_ids(
    pool: &DbPool,
    sessions_root: &std::path::Path,
    requested: Option<Vec<String>>,
) -> Result<Vec<String>, String> {
    if let Some(ids) = requested {
        if ids.is_empty() {
            return Err("at least one session is required".into());
        }
        return Ok(ids);
    }
    let sessions = list_sessions(pool, sessions_root, "linkedin")?;
    let ids: Vec<String> = sessions.into_iter().map(|s| s.id).collect();
    if ids.is_empty() {
        return Err("no LinkedIn sessions found — create one first".into());
    }
    Ok(ids)
}

pub fn handle_session_rotation(app: &AppHandle, run_id: &str) -> Result<bool, String> {
    let state = app.state::<AppState>();
    let run = get_run(&state.db, run_id)?;
    let session_ids = parse_session_ids(&run.session_ids)?;
    let next = increment_session_index(&state.db, run_id)?;
    if next as usize >= session_ids.len() {
        finish_run(&state.db, run_id, "failed", Some("all sessions exhausted"))?;
        return Ok(false);
    }
    update_run_status(&state.db, run_id, "running", Some("rotating session"))?;
    spawn_orchestrator(app.clone(), run_id.to_string());
    Ok(true)
}
