use diesel::prelude::*;
use serde::Serialize;

use super::schema::sessions;

#[derive(Debug, Clone, Queryable, Selectable, Serialize)]
#[diesel(table_name = sessions)]
pub struct Session {
    pub id: String,
    pub platform: String,
    pub name: String,
    pub status: String,
    pub active_run_id: Option<String>,
    pub last_checked_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Insertable)]
#[diesel(table_name = sessions)]
pub struct NewSession<'a> {
    pub id: &'a str,
    pub platform: &'a str,
    pub name: &'a str,
    pub status: &'a str,
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionInfo {
    pub id: String,
    pub platform: String,
    pub name: String,
    pub status: String,
    pub active_run_id: Option<String>,
    pub last_checked_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub has_storage: bool,
}

impl Session {
    pub fn into_info(self, has_storage: bool) -> SessionInfo {
        SessionInfo {
            id: self.id,
            platform: self.platform,
            name: self.name,
            status: self.status,
            active_run_id: self.active_run_id,
            last_checked_at: self.last_checked_at,
            created_at: self.created_at,
            updated_at: self.updated_at,
            has_storage,
        }
    }
}
