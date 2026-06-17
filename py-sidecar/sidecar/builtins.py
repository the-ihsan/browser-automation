"""Built-in handlers — registered at import via decorators."""

from __future__ import annotations

from typing import Any

from . import bus, registry
from .transport import trace


@registry.on_req("hello")
async def _hello(_payload: Any) -> dict[str, str]:
    return {"message": "hi hello"}


@registry.on_req("test.emit")
async def _test_emit(payload: Any) -> dict[str, str]:
    channel = "test.event"
    data: Any = {"from": "python"}
    if isinstance(payload, dict):
        channel = str(payload.get("channel", channel))
        data = payload.get("payload", data)
    bus.emit(channel, data)
    return {"emitted": channel}


@registry.on_req("test.request_rust")
async def _test_request_rust(payload: Any) -> Any:
    channel = "rust.ping"
    data: Any = {}
    if isinstance(payload, dict):
        channel = str(payload.get("channel", channel))
        data = payload.get("payload", data)
    return await bus.send_req(channel, data, timeout=30.0)


@registry.on("test.event")
def _on_test_event(data: Any) -> None:
    trace(f"test.event listener fired: {data!r}")
