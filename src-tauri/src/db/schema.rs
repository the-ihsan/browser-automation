// @generated automatically by Diesel CLI.

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
