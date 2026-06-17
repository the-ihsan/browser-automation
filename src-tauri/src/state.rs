use std::path::PathBuf;
use std::process::{Child, ChildStdin};
use std::sync::{Arc, Mutex};

/// Shared handle to the long-running Python daemon process.
pub struct DaemonHandle {
    pub stdin: Mutex<Option<ChildStdin>>,
    pub child: Mutex<Option<Child>>,
    pub trace_emit: Mutex<Option<Box<dyn Fn(String) + Send + Sync>>>,
}

impl Default for DaemonHandle {
    fn default() -> Self {
        Self {
            stdin: Mutex::new(None),
            child: Mutex::new(None),
            trace_emit: Mutex::new(None),
        }
    }
}

pub struct AppState {
    pub sidecar_bundle: PathBuf,
    pub daemon: Arc<DaemonHandle>,
    pub dev: bool,
}
