use std::time::Duration;

use serde_json::{json, Value};
use tauri::State;

use crate::sidecar;
use crate::state::AppState;

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
        Err("daemon is not running".into())
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
