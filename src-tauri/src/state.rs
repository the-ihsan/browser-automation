use std::path::PathBuf;
use std::process::{Child, ChildStdin};
use std::sync::{Arc, Mutex};

use crate::db::DbPool;

/// Shared handle to the long-running Python daemon process.
pub struct DaemonHandle {
    pub stdin: Mutex<Option<ChildStdin>>,
    pub child: Mutex<Option<Child>>,
    pub spawn_error: Mutex<Option<String>>,
}

impl Default for DaemonHandle {
    fn default() -> Self {
        Self {
            stdin: Mutex::new(None),
            child: Mutex::new(None),
            spawn_error: Mutex::new(None),
        }
    }
}

pub struct AppState {
    pub data_dir: PathBuf,
    pub sessions_dir: PathBuf,
    pub sidecar_bundle: PathBuf,
    pub daemon: Arc<DaemonHandle>,
    pub dev: bool,
    pub db: DbPool,
    pub db_path: PathBuf,
}
