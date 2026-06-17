use std::collections::HashMap;
use std::sync::{mpsc, LazyLock, Mutex};
use std::time::{Duration, Instant};

use serde_json::{json, Value};

use crate::state::DaemonHandle;

use super::registry::{dispatch_event, handle_request};
use super::transport::{new_request_id, send_message, trace};

static PENDING: LazyLock<Mutex<HashMap<String, mpsc::Sender<Result<Value, String>>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// Send a request to the Python daemon and await the response.
pub fn send_req(
    daemon: &DaemonHandle,
    channel: &str,
    payload: Value,
    timeout: Duration,
) -> Result<Value, String> {
    let id = new_request_id();
    let (tx, rx) = mpsc::channel();
    PENDING.lock().unwrap().insert(id.clone(), tx);

    trace(daemon, format!("sending request ({id})"));
    if !send_message(
        daemon,
        json!({
            "kind": "request",
            "id": id,
            "channel": channel,
            "payload": payload,
        }),
    ) {
        PENDING.lock().unwrap().remove(&id);
        return Err("daemon is not running".into());
    }

    let deadline = Instant::now() + timeout;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            PENDING.lock().unwrap().remove(&id);
            return Err(format!(
                "request on channel '{channel}' timed out after {}s",
                timeout.as_secs_f64()
            ));
        }
        match rx.recv_timeout(remaining) {
            Ok(Ok(v)) => return Ok(v),
            Ok(Err(e)) => return Err(e),
            Err(mpsc::RecvTimeoutError::Timeout) => {
                PENDING.lock().unwrap().remove(&id);
                return Err(format!(
                    "request on channel '{channel}' timed out after {}s",
                    timeout.as_secs_f64()
                ));
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                PENDING.lock().unwrap().remove(&id);
                return Err("request channel closed".into());
            }
        }
    }
}

/// Broadcast an event to the Python daemon.
pub fn emit(daemon: &DaemonHandle, channel: &str, payload: Value) -> bool {
    trace(daemon, format!("event {channel} sent"));
    send_message(
        daemon,
        json!({
            "kind": "event",
            "channel": channel,
            "payload": payload,
        }),
    )
}

/// Route an incoming NDJSON message from the Python daemon.
pub fn ingest(daemon: &DaemonHandle, msg: &Value) {
    let kind = msg.get("kind").and_then(Value::as_str).unwrap_or("");
    match kind {
        "event" => {
            let channel = msg.get("channel").and_then(Value::as_str).unwrap_or("");
            trace(daemon, format!("event {channel} received"));
            dispatch_event(msg);
        }
        "response" => {
            let id = msg.get("id").and_then(Value::as_str).unwrap_or("");
            trace(daemon, format!("response received ({id})"));
            complete_response(msg);
        }
        "request" => {
            let id = msg.get("id").and_then(Value::as_str).unwrap_or("");
            let channel = msg.get("channel").and_then(Value::as_str).unwrap_or("");
            trace(daemon, format!("received request ({id})"));
            dispatch_request(daemon, msg);
        }
        _ => eprintln!("[sidecar] unknown message kind: {kind}"),
    }
}

fn dispatch_request(daemon: &DaemonHandle, msg: &Value) {
    let channel = msg.get("channel").and_then(Value::as_str).unwrap_or("");
    let id = msg.get("id").and_then(Value::as_str).unwrap_or("").to_string();
    let payload = msg.get("payload").cloned().unwrap_or(Value::Null);

    let result = handle_request(channel, &payload);

    let response = match result {
        Some(Ok(result)) => json!({
            "kind": "response",
            "id": id,
            "channel": channel,
            "payload": result,
        }),
        Some(Err(error)) => json!({
            "kind": "response",
            "id": id,
            "channel": channel,
            "error": error,
        }),
        None => json!({
            "kind": "response",
            "id": id,
            "channel": channel,
            "error": format!("no handler for channel '{channel}'"),
        }),
    };

    trace(daemon, format!("responding to {id}"));
    if !send_message(daemon, response) {
        eprintln!("[sidecar] failed to send response for channel '{channel}'");
    }
}

fn complete_response(msg: &Value) {
    let id = match msg.get("id").and_then(Value::as_str) {
        Some(id) => id.to_string(),
        None => return,
    };
    let tx = PENDING.lock().unwrap().remove(&id);
    let Some(tx) = tx else {
        return;
    };

    let result = if let Some(error) = msg.get("error").and_then(Value::as_str) {
        Err(error.to_string())
    } else {
        Ok(msg.get("payload").cloned().unwrap_or(Value::Null))
    };
    let _ = tx.send(result);
}
