"""Python sidecar — NDJSON communication with the Tauri host."""

from sidecar.bus import emit, ingest, send_req
from sidecar.registry import (
    EventHandle,
    dispatch_event,
    off,
    off_req,
    on,
    on_req,
)
from sidecar.transport import start, stop

import sidecar.builtins as _builtins  # noqa: F401 — register handlers
import browser.handlers as _browser_handlers  # noqa: F401 — register browser handlers

__all__ = [
    "EventHandle",
    "dispatch_event",
    "emit",
    "ingest",
    "off",
    "off_req",
    "on",
    "on_req",
    "send_req",
    "start",
    "stop",
]
