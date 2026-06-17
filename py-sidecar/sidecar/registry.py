"""Global handler registry — on, off, on_req, off_req, dispatch_event."""

from __future__ import annotations

import threading
from collections.abc import Awaitable, Callable
from typing import Any

EventHandle = int
EventHandler = Callable[[Any], None]
RequestHandler = Callable[[Any], Awaitable[Any] | Any]


class _EventEntry:
    __slots__ = ("id", "channel", "callback")

    def __init__(self, id: int, channel: str, callback: EventHandler) -> None:
        self.id = id
        self.channel = channel
        self.callback = callback


_lock = threading.Lock()
_next_id = 1
_events: list[_EventEntry] = []
_requests: dict[str, RequestHandler] = {}


def on(
    channel: str, handler: EventHandler | None = None
) -> EventHandle | Callable[[EventHandler], EventHandler]:
    """Register an event listener in the global registry."""
    if handler is not None:
        global _next_id
        with _lock:
            handle = _next_id
            _next_id += 1
            _events.append(_EventEntry(handle, channel, handler))
        return handle

    def decorator(fn: EventHandler) -> EventHandler:
        on(channel, fn)
        return fn

    return decorator


def off(handle: EventHandle) -> None:
    """Remove an event listener by the id returned from [`on`]."""
    with _lock:
        _events[:] = [entry for entry in _events if entry.id != handle]


def on_req(
    channel: str, handler: RequestHandler | None = None
) -> RequestHandler | Callable[[RequestHandler], RequestHandler]:
    """Register a request handler in the global registry."""
    if handler is not None:
        with _lock:
            _requests[channel] = handler
        return handler

    def decorator(fn: RequestHandler) -> RequestHandler:
        on_req(channel, fn)
        return fn

    return decorator


def off_req(channel: str) -> None:
    """Remove a request handler by channel."""
    with _lock:
        _requests.pop(channel, None)


def dispatch_event(msg: dict[str, Any]) -> None:
    """Route an incoming event message to registered listeners."""
    channel = msg.get("channel", "")
    payload = msg.get("payload")
    with _lock:
        handlers = [entry.callback for entry in _events if entry.channel == channel]
    for handler in handlers:
        try:
            handler(payload)
        except Exception:
            pass


def get_request_handler(channel: str) -> RequestHandler | None:
    with _lock:
        return _requests.get(channel)
