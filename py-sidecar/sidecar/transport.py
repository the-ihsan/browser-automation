"""NDJSON transport — stdout writer, trace, request IDs."""

from __future__ import annotations

import json
import os
import queue
import sys
import threading
from typing import Any

_out_queue: queue.Queue[Any] = queue.Queue()
_writer: threading.Thread | None = None
_started = False
_start_lock = threading.Lock()


def start() -> None:
    global _writer, _started
    with _start_lock:
        if _started:
            return
        _started = True
        _writer = threading.Thread(target=_drain_forever, name="sidecar-writer", daemon=True)
        _writer.start()


def stop() -> None:
    global _started
    if not _started:
        return
    _out_queue.put(None)
    if _writer is not None:
        _writer.join(timeout=2)
    _started = False


def send_message(msg: dict[str, Any]) -> bool:
    if not _started:
        start()
    _out_queue.put(msg)
    return True


def trace(message: str) -> None:
    print(f"[sidecar] {message}", file=sys.stderr, flush=True)


_request_counter = 0


def new_request_id() -> str:
    global _request_counter
    _request_counter += 1
    return f"{os.getpid()}-{_request_counter}"


def _drain_forever() -> None:
    out = sys.stdout
    while True:
        msg = _out_queue.get()
        if msg is None:
            out.flush()
            return
        out.write(json.dumps(msg, ensure_ascii=False) + "\n")
        out.flush()
