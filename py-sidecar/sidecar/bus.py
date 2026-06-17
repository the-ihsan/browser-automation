"""Message bus — ingest, emit, send_req, request/response correlation."""

from __future__ import annotations

import asyncio
import sys
from typing import Any

from sidecar.registry import dispatch_event, get_request_handler
from sidecar.transport import new_request_id, send_message, trace

_pending: dict[str, asyncio.Future[Any]] = {}


async def send_req(
    channel: str,
    payload: Any = None,
    *,
    timeout: float = 30.0,
) -> Any:
    """Send a request to the Rust host and await the response."""
    req_id = new_request_id()
    loop = asyncio.get_running_loop()
    fut: asyncio.Future[Any] = loop.create_future()
    _pending[req_id] = fut

    trace(f"sending request ({req_id})")
    send_message(
        {
            "kind": "request",
            "id": req_id,
            "channel": channel,
            "payload": payload,
        }
    )

    try:
        return await asyncio.wait_for(fut, timeout=timeout)
    except asyncio.TimeoutError as exc:
        _pending.pop(req_id, None)
        raise TimeoutError(
            f"request on channel '{channel}' timed out after {timeout}s"
        ) from exc


def emit(channel: str, payload: Any = None) -> bool:
    """Broadcast an event to the Rust host."""
    trace(f"event {channel} sent")
    return send_message(
        {
            "kind": "event",
            "channel": channel,
            "payload": payload,
        }
    )


def ingest(msg: dict[str, Any]) -> None:
    """Route an incoming NDJSON message from the Rust host."""
    kind = msg.get("kind")
    if kind == "event":
        channel = msg.get("channel", "")
        trace(f"event {channel} received")
        dispatch_event(msg)
    elif kind == "response":
        req_id = msg.get("id", "")
        channel = msg.get("channel", "")
        trace(f"response received ({req_id})")
        _complete_response(msg)
    elif kind == "request":
        req_id = msg.get("id", "")
        channel = msg.get("channel", "")
        trace(f"received request ({req_id})")
        asyncio.get_event_loop().create_task(_dispatch_request(msg))
    else:
        print(f"[sidecar] unknown message kind: {kind}", file=sys.stderr, flush=True)


async def _dispatch_request(msg: dict[str, Any]) -> None:
    channel = msg.get("channel", "")
    req_id = msg.get("id", "")
    payload = msg.get("payload")

    handler = get_request_handler(channel)
    if handler is None:
        trace(f"responding to {req_id}")
        send_message(
            {
                "kind": "response",
                "id": req_id,
                "channel": channel,
                "error": f"no handler for channel '{channel}'",
            }
        )
        return

    try:
        result = handler(payload)
        if asyncio.iscoroutine(result):
            result = await result
        trace(f"responding to {req_id}")
        send_message(
            {
                "kind": "response",
                "id": req_id,
                "channel": channel,
                "payload": result,
            }
        )
    except Exception as exc:
        trace(f"responding to {req_id}")
        send_message(
            {
                "kind": "response",
                "id": req_id,
                "channel": channel,
                "error": str(exc),
            }
        )


def _complete_response(msg: dict[str, Any]) -> None:
    req_id = msg.get("id")
    if not isinstance(req_id, str):
        return
    fut = _pending.pop(req_id, None)
    if fut is None or fut.done():
        return
    if error := msg.get("error"):
        fut.set_exception(RuntimeError(str(error)))
    else:
        fut.set_result(msg.get("payload"))
