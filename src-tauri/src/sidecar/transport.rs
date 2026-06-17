use std::io::Write;
use std::process::ChildStdin;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use serde_json::Value;

use crate::state::DaemonHandle;

const DAEMON_START_TIMEOUT: Duration = Duration::from_secs(30);
const DAEMON_START_POLL: Duration = Duration::from_millis(50);

pub(crate) fn send_message(daemon: &DaemonHandle, msg: Value) -> bool {
    let deadline = Instant::now() + DAEMON_START_TIMEOUT;
    loop {
        if let Some(err) = daemon.spawn_error.lock().unwrap().clone() {
            eprintln!("[daemon] {err}");
            return false;
        }

        let write_result = {
            let mut guard = daemon.stdin.lock().unwrap();
            if let Some(stdin) = guard.as_mut() {
                Some(try_write(stdin, &msg))
            } else {
                None
            }
        };

        if let Some(ok) = write_result {
            return ok;
        }

        if Instant::now() >= deadline {
            if let Some(err) = daemon.spawn_error.lock().unwrap().clone() {
                eprintln!("[daemon] {err}");
            }
            return false;
        }
        std::thread::sleep(DAEMON_START_POLL);
    }
}

fn try_write(stdin: &mut ChildStdin, msg: &Value) -> bool {
    let line = serde_json::to_string(msg).unwrap_or_default();
    if writeln!(stdin, "{line}").is_ok() {
        let _ = stdin.flush();
        return true;
    }
    false
}

pub(crate) fn new_request_id() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    format!(
        "{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    )
}
