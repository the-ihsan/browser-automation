use std::sync::Once;

use serde_json::{json, Value};

use super::registry::{on, on_req};

static BUILTINS: Once = Once::new();

pub fn register() {
    BUILTINS.call_once(|| {
        on("test.event", |_payload: Value| {});

        on_req("rust.ping", |_payload: Value| {
            Ok(json!({ "pong": true, "from": "rust" }))
        });
        on_req("rust.echo", |payload: Value| {
            Ok(json!({ "echo": payload }))
        });
    });
}
