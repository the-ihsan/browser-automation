use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, LazyLock, Mutex};

use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::Value;

pub type EventHandle = u64;

type EventCallback = Arc<dyn Fn(&Value) + Send + Sync>;
type RequestCallback = Arc<dyn Fn(&Value) -> Result<Value, String> + Send + Sync>;

struct EventEntry {
    id: u64,
    channel: String,
    callback: EventCallback,
}

static NEXT_EVENT_ID: AtomicU64 = AtomicU64::new(1);

static EVENT_REGISTRY: LazyLock<Mutex<Vec<EventEntry>>> =
    LazyLock::new(|| Mutex::new(Vec::new()));

static REQUEST_REGISTRY: LazyLock<Mutex<HashMap<String, RequestCallback>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// Register a typed event listener in the global registry.
pub fn on<P, F>(channel: impl Into<String>, callback: F) -> EventHandle
where
    P: DeserializeOwned + Send + 'static,
    F: Fn(P) + Send + Sync + 'static,
{
    let channel = channel.into();
    let channel_log = channel.clone();
    let id = NEXT_EVENT_ID.fetch_add(1, Ordering::Relaxed);
    let cb: EventCallback = Arc::new(move |value| {
        match serde_json::from_value::<P>(value.clone()) {
            Ok(payload) => callback(payload),
            Err(e) => eprintln!("[sidecar] event '{channel_log}' deserialize error: {e}"),
        }
    });
    EVENT_REGISTRY
        .lock()
        .unwrap()
        .push(EventEntry { id, channel, callback: cb });
    id
}

/// Remove an event listener by the id returned from [`on`].
#[allow(dead_code)]
pub fn off(handle: EventHandle) {
    EVENT_REGISTRY
        .lock()
        .unwrap()
        .retain(|entry| entry.id != handle);
}

/// Register a typed request handler in the global registry.
pub fn on_req<P, R, F>(channel: impl Into<String>, callback: F)
where
    P: DeserializeOwned + Send + 'static,
    R: Serialize + Send + 'static,
    F: Fn(P) -> Result<R, String> + Send + Sync + 'static,
{
    let channel = channel.into();
    let cb: RequestCallback = Arc::new(move |value| {
        let payload: P = serde_json::from_value(value.clone())
            .map_err(|e| format!("deserialize error: {e}"))?;
        let result = callback(payload)?;
        serde_json::to_value(result).map_err(|e| format!("serialize error: {e}"))
    });
    REQUEST_REGISTRY.lock().unwrap().insert(channel, cb);
}

/// Remove a request handler by channel.
#[allow(dead_code)]
pub fn off_req(channel: &str) {
    REQUEST_REGISTRY.lock().unwrap().remove(channel);
}

/// Route an incoming event message to registered listeners.
pub fn dispatch_event(msg: &Value) {
    let channel = msg.get("channel").and_then(Value::as_str).unwrap_or("");
    let payload = msg.get("payload").cloned().unwrap_or(Value::Null);
    for entry in EVENT_REGISTRY.lock().unwrap().iter() {
        if entry.channel == channel {
            (entry.callback)(&payload);
        }
    }
}

pub(crate) fn handle_request(channel: &str, payload: &Value) -> Option<Result<Value, String>> {
    REQUEST_REGISTRY
        .lock()
        .unwrap()
        .get(channel)
        .map(|callback| callback(payload))
}
