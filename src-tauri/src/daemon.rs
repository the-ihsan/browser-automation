use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::thread;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use crate::sidecar;
use crate::state::{AppState, DaemonHandle};

#[cfg(windows)]
const DAEMON_EXE: &str = "playwright-tools-daemon.exe";
#[cfg(not(windows))]
const DAEMON_EXE: &str = "playwright-tools-daemon";

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."))
}

pub fn build_cmd(state: &AppState) -> Result<Command, String> {
    let mut cmd = if state.dev {
        let mut c = Command::new("uv");
        c.current_dir(project_root());
        c.args(["run", "python", "py-sidecar/sidecar/daemon.py"]);
        c
    } else {
        let exe = state.sidecar_bundle.join(DAEMON_EXE);
        let mut c = Command::new(&exe);
        if !exe.exists() {
            return Err(format!(
                "daemon binary not found: {}. Run 'pnpm build:daemon' first.",
                exe.display()
            ));
        }
        c.current_dir(&state.sidecar_bundle);
        c
    };
    cmd.env("PYTHONIOENCODING", "utf-8");
    cmd.env("PYTHONUTF8", "1");
    Ok(cmd)
}

pub fn spawn(_app: AppHandle, daemon: Arc<DaemonHandle>, mut cmd: Command) {

    thread::spawn(move || {
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let msg = format!("failed to spawn: {e}");
                eprintln!("[daemon] {msg}");
                *daemon.spawn_error.lock().unwrap() = Some(msg);
                return;
            }
        };

        let stdout = child.stdout.take().expect("daemon stdout pipe");
        let stderr = child.stderr.take().expect("daemon stderr pipe");
        let stdin = child.stdin.take();

        *daemon.stdin.lock().unwrap() = stdin;
        *daemon.child.lock().unwrap() = Some(child);

        // Drain stderr so a full pipe cannot block the daemon process.
        thread::spawn(move || {
            for _ in BufReader::new(stderr).lines().map_while(Result::ok) {}
        });

        let app = _app;
        let mut reader = BufReader::new(stdout);
        let mut buf = Vec::new();
        loop {
            buf.clear();
            match reader.read_until(b'\n', &mut buf) {
                Ok(0) => break,
                Ok(_) => {}
                Err(_) => break,
            }
            let line = String::from_utf8_lossy(&buf);
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
                handle_message(&app, &daemon, &v);
            }
        }

        *daemon.stdin.lock().unwrap() = None;
        *daemon.spawn_error.lock().unwrap() = Some("daemon process exited".into());
    });
}

pub fn kill(daemon: &DaemonHandle) {
    *daemon.stdin.lock().unwrap() = None;
    if let Some(mut child) = daemon.child.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

fn handle_message(app: &AppHandle, daemon: &DaemonHandle, msg: &Value) {
    sidecar::ingest(daemon, msg);

    if msg.get("kind").and_then(Value::as_str) == Some("event") {
        let channel = msg.get("channel").and_then(Value::as_str).unwrap_or("");
        let payload = msg.get("payload").cloned().unwrap_or(Value::Null);
        if channel == "hello" {
            let message = payload
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let _ = app.emit("daemon://hello", json!({ "message": message }));
        } else if channel.starts_with("browser.") {
            let _ = app.emit(
                "daemon://browser",
                json!({ "channel": channel, "payload": payload }),
            );
        }
    }
}
