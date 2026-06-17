// @generated automatically by Diesel CLI.

diesel::table! {
    linkedin_posts_runs (id) {
        id -> Text,
        profile_url -> Text,
        session_ids -> Text,
        post_count -> Nullable<Integer>,
        start_from -> Integer,
        post_matcher -> Nullable<Text>,
        headless -> Integer,
        status -> Text,
        initial_top_post_id -> Nullable<Text>,
        initial_post_ids -> Nullable<Text>,
        collected_count -> Integer,
        matched_count -> Integer,
        current_session_index -> Integer,
        error_message -> Nullable<Text>,
        created_at -> Text,
        updated_at -> Text,
        started_at -> Nullable<Text>,
        completed_at -> Nullable<Text>,
    }
}

diesel::table! {
    linkedin_posts_runs_item (id) {
        id -> Text,
        run_id -> Text,
        post_id -> Text,
        ordinal -> Integer,
        text -> Nullable<Text>,
        posted_at -> Nullable<Text>,
        author_name -> Nullable<Text>,
        author_url -> Nullable<Text>,
        post_url -> Nullable<Text>,
        like_count -> Nullable<Integer>,
        comment_count -> Nullable<Integer>,
        repost_count -> Nullable<Integer>,
        impression_count -> Nullable<Integer>,
        media_urls -> Nullable<Text>,
        raw_data -> Nullable<Text>,
        matched -> Integer,
        session_id -> Nullable<Text>,
        created_at -> Text,
    }
}

diesel::table! {
    sessions (id) {
        id -> Text,
        platform -> Text,
        name -> Text,
        status -> Text,
        active_run_id -> Nullable<Text>,
        last_checked_at -> Nullable<Text>,
        created_at -> Text,
        updated_at -> Text,
    }
}

diesel::joinable!(linkedin_posts_runs_item -> linkedin_posts_runs (run_id));

diesel::allow_tables_to_appear_in_same_query!(
    linkedin_posts_runs,
    linkedin_posts_runs_item,
    sessions,
);
