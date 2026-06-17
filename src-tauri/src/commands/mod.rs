use std::time::Duration;

use serde_json::{json, Value};
use tauri::State;

use crate::sidecar;
use crate::state::AppState;

fn daemon_unavailable(state: &AppState) -> String {
    state
        .daemon
        .spawn_error
        .lock()
        .unwrap()
        .clone()
        .unwrap_or_else(|| "daemon is not running".into())
}

fn do_request(
    state: &AppState,
    channel: &str,
    payload: Value,
    timeout_ms: u64,
) -> Result<Value, String> {
    sidecar::send_req(
        &state.daemon,
        channel,
        payload,
        Duration::from_millis(timeout_ms),
    )
    .map_err(|e| {
        if e == "daemon is not running" {
            daemon_unavailable(state)
        } else {
            e
        }
    })
}

#[tauri::command]
pub fn say_hello(state: State<AppState>) -> Result<Value, String> {
    do_request(&state, "hello", json!({}), 30_000)
}

#[tauri::command]
pub fn comm_emit(
    state: State<AppState>,
    channel: String,
    payload: Value,
) -> Result<(), String> {
    if sidecar::emit(&state.daemon, &channel, payload) {
        Ok(())
    } else {
        Err(daemon_unavailable(&state))
    }
}

#[tauri::command]
pub fn comm_request(
    state: State<AppState>,
    channel: String,
    payload: Value,
    timeout_ms: u64,
) -> Result<Value, String> {
    do_request(&state, &channel, payload, timeout_ms)
}

#[tauri::command]
pub fn comm_trigger_py_event(
    state: State<AppState>,
    channel: String,
    payload: Value,
) -> Result<Value, String> {
    do_request(
        &state,
        "test.emit",
        json!({ "channel": channel, "payload": payload }),
        30_000,
    )
}

#[tauri::command]
pub fn comm_trigger_py_request(
    state: State<AppState>,
    channel: String,
    payload: Value,
) -> Result<Value, String> {
    do_request(
        &state,
        "test.request_rust",
        json!({ "channel": channel, "payload": payload }),
        30_000,
    )
}
