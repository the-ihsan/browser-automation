use std::io::Write;
use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::Value;

use crate::state::DaemonHandle;

pub(crate) fn send_message(daemon: &DaemonHandle, msg: Value) -> bool {
    let mut guard = daemon.stdin.lock().unwrap();
    if let Some(stdin) = guard.as_mut() {
        let line = serde_json::to_string(&msg).unwrap_or_default();
        if writeln!(stdin, "{line}").is_ok() {
            let _ = stdin.flush();
            return true;
        }
    }
    false
}

pub(crate) fn trace(daemon: &DaemonHandle, message: String) {
    if let Some(emit) = daemon.trace_emit.lock().unwrap().as_ref() {
        emit(message);
    }
}

pub(crate) fn new_request_id() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    format!(
        "{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    )
}
