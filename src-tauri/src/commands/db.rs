use tauri::State;

use crate::db::db_status;
use crate::state::AppState;

#[tauri::command]
pub fn db_health(state: State<AppState>) -> Result<String, String> {
    db_status(&state.db)
}
