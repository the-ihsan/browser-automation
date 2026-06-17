mod commands;
mod daemon;
mod db;
mod sidecar;
mod state;

use std::sync::Arc;

use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager, RunEvent};

use crate::db::{establish_pool, reset_running_on_startup};
use crate::state::{AppState, DaemonHandle};

fn build_state(app: &AppHandle) -> Result<AppState, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;

    let sessions_dir = data_dir.join("sessions");
    std::fs::create_dir_all(&sessions_dir).map_err(|e| e.to_string())?;

    let db_path = data_dir.join("playwright-tools.db");
    let db = establish_pool(&db_path)?;
    reset_running_on_startup(&db)?;

    let sidecar_bundle = app
        .path()
        .resolve("sidecar", BaseDirectory::Resource)
        .unwrap_or_else(|_| data_dir.join("sidecar"));

    Ok(AppState {
        data_dir,
        sessions_dir,
        sidecar_bundle,
        daemon: Arc::new(DaemonHandle::default()),
        dev: cfg!(debug_assertions),
        db,
        db_path,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = build_state(app.handle())?;

            match daemon::build_cmd(&state) {
                Ok(cmd) => {
                    daemon::spawn(app.handle().clone(), state.daemon.clone(), cmd);
                }
                Err(e) => eprintln!("could not build daemon command: {e}"),
            }

            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::say_hello,
            commands::comm_emit,
            commands::comm_request,
            commands::comm_trigger_py_event,
            commands::comm_trigger_py_request,
            commands::db::db_health,
            commands::sessions::sessions_list,
            commands::sessions::sessions_create,
            commands::sessions::sessions_delete,
            commands::sessions::sessions_launch,
            commands::sessions::sessions_check,
            commands::sessions::sessions_get_cookies,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if matches!(event, RunEvent::Exit) {
                daemon::kill(&app_handle.state::<AppState>().daemon);
            }
        });
}
