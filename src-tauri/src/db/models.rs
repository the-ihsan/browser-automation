use diesel::prelude::*;
use serde::Serialize;

use super::schema::{linkedin_posts_runs, linkedin_posts_runs_item, sessions};

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

#[derive(Debug, Clone, Queryable, Selectable, Serialize)]
#[diesel(table_name = linkedin_posts_runs)]
pub struct LinkedInPostsRun {
    pub id: String,
    pub profile_url: String,
    pub session_ids: String,
    pub post_count: Option<i32>,
    pub start_from: i32,
    pub post_matcher: Option<String>,
    pub headless: i32,
    pub status: String,
    pub initial_top_post_id: Option<String>,
    pub initial_post_ids: Option<String>,
    pub collected_count: i32,
    pub matched_count: i32,
    pub current_session_index: i32,
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Insertable)]
#[diesel(table_name = linkedin_posts_runs)]
pub struct NewLinkedInPostsRun<'a> {
    pub id: &'a str,
    pub profile_url: &'a str,
    pub session_ids: &'a str,
    pub post_count: Option<i32>,
    pub start_from: i32,
    pub post_matcher: Option<&'a str>,
    pub headless: i32,
    pub status: &'a str,
}

#[derive(Debug, Clone, Queryable, Selectable, Serialize)]
#[diesel(table_name = linkedin_posts_runs_item)]
pub struct LinkedInPostsRunItem {
    pub id: String,
    pub run_id: String,
    pub post_id: String,
    pub ordinal: i32,
    pub text: Option<String>,
    pub posted_at: Option<String>,
    pub author_name: Option<String>,
    pub author_url: Option<String>,
    pub post_url: Option<String>,
    pub like_count: Option<i32>,
    pub comment_count: Option<i32>,
    pub repost_count: Option<i32>,
    pub impression_count: Option<i32>,
    pub media_urls: Option<String>,
    pub raw_data: Option<String>,
    pub matched: i32,
    pub session_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Insertable)]
#[diesel(table_name = linkedin_posts_runs_item)]
pub struct NewLinkedInPostsRunItem<'a> {
    pub id: &'a str,
    pub run_id: &'a str,
    pub post_id: &'a str,
    pub ordinal: i32,
    pub text: Option<&'a str>,
    pub posted_at: Option<&'a str>,
    pub author_name: Option<&'a str>,
    pub author_url: Option<&'a str>,
    pub post_url: Option<&'a str>,
    pub like_count: Option<i32>,
    pub comment_count: Option<i32>,
    pub repost_count: Option<i32>,
    pub impression_count: Option<i32>,
    pub media_urls: Option<&'a str>,
    pub raw_data: Option<&'a str>,
    pub matched: i32,
    pub session_id: Option<&'a str>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PaginatedRuns {
    pub items: Vec<LinkedInPostsRun>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PaginatedRunItems {
    pub items: Vec<LinkedInPostsRunItem>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}
