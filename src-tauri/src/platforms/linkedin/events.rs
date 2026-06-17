use serde_json::Value;
use tauri::AppHandle;

use crate::db::{finish_run, insert_run_item, persist_anchor_from_event};
use crate::state::AppState;

pub fn handle(app: &AppHandle, state: &AppState, channel: &str, payload: &Value) {
    match channel {
        "linkedin.posts.run.post" => handle_post(state, payload),
        "linkedin.posts.run.anchor" => handle_anchor(state, payload),
        "linkedin.posts.run.finished" => handle_finished(state, payload),
        "linkedin.posts.run.error" => handle_error(app, state, payload),
        _ => {}
    }
}

fn run_id_from(payload: &Value) -> Option<String> {
    payload
        .get("run_id")
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn handle_post(state: &AppState, payload: &Value) {
    let run_id = match run_id_from(payload) {
        Some(id) => id,
        None => return,
    };
    let post = match payload.get("post") {
        Some(p) => p,
        None => return,
    };
    let ordinal = payload
        .get("ordinal")
        .and_then(Value::as_i64)
        .unwrap_or(0) as i32;
    let matched = payload
        .get("matched")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let session_id = payload.get("session_id").and_then(Value::as_str);

    let _ = insert_run_item(
        &state.db,
        &run_id,
        post,
        ordinal,
        matched,
        session_id,
    );
}

fn handle_anchor(state: &AppState, payload: &Value) {
    let run_id = match run_id_from(payload) {
        Some(id) => id,
        None => return,
    };
    let top = payload
        .get("initial_top_post_id")
        .and_then(Value::as_str)
        .unwrap_or("");
    let ids: Vec<String> = payload
        .get("initial_post_ids")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();
    if top.is_empty() || ids.is_empty() {
        return;
    }
    let _ = persist_anchor_from_event(&state.db, &run_id, top, &ids);
}

fn handle_finished(state: &AppState, payload: &Value) {
    let run_id = match run_id_from(payload) {
        Some(id) => id,
        None => return,
    };
    let run = match crate::db::get_run(&state.db, &run_id) {
        Ok(r) => r,
        Err(_) => return,
    };
    if matches!(run.status.as_str(), "stopped" | "completed" | "failed") {
        return;
    }
    if run.status == "running" && run.error_message.as_deref() == Some("rotating session") {
        return;
    }

    let stopped = payload
        .get("stopped")
        .and_then(Value::as_bool)
        .unwrap_or(false)
        || run.status == "stopping";
    let ok = payload.get("ok").and_then(Value::as_bool).unwrap_or(false);
    let error = payload.get("error").and_then(Value::as_str);
    let status = if stopped {
        "stopped"
    } else if ok {
        "completed"
    } else {
        "failed"
    };
    let _ = finish_run(&state.db, &run_id, status, error);
}

fn handle_error(app: &AppHandle, state: &AppState, payload: &Value) {
    let run_id = match run_id_from(payload) {
        Some(id) => id,
        None => return,
    };
    let message = payload
        .get("message")
        .and_then(Value::as_str)
        .or_else(|| payload.get("reason").and_then(Value::as_str))
        .unwrap_or("session error");

    if super::orchestrator::handle_session_rotation(app, &run_id).unwrap_or(false) {
        return;
    }

    let _ = finish_run(&state.db, &run_id, "failed", Some(message));
}
