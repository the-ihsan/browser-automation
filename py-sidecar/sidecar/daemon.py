#!/usr/bin/env python3
"""playwright-tools — Python daemon entrypoint.

Spawned once by Tauri at app start. Messages flow as NDJSON (one per line):

  Event:    {"kind": "event", "channel": "...", "payload": ...}
  Request:  {"kind": "request", "id": "<uuid>", "channel": "...", "payload": ...}
  Response: {"kind": "response", "id": "<uuid>", "channel": "...", "payload": ...}
"""

from __future__ import annotations

import asyncio
import json
import sys
import threading
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from sidecar.bus import ingest
from sidecar.transport import start, stop


def _force_utf8_stdio() -> None:
    for stream, kwargs in (
        (sys.stdout, {"encoding": "utf-8", "newline": "\n"}),
        (sys.stdin, {"encoding": "utf-8"}),
        (sys.stderr, {"encoding": "utf-8"}),
    ):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            try:
                reconfigure(**kwargs)
            except (ValueError, OSError):
                pass


class Daemon:
    def run(self) -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        start()
        print("[sidecar] daemon ready", file=sys.stderr, flush=True)
        threading.Thread(
            target=self._read_stdin, args=(loop,), name="stdin-reader", daemon=True
        ).start()

        try:
            loop.run_forever()
        finally:
            stop()

    def _read_stdin(self, loop: asyncio.AbstractEventLoop) -> None:
        try:
            for raw in sys.stdin:
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if isinstance(msg, dict):
                    loop.call_soon_threadsafe(ingest, msg)
        except Exception:
            pass
        if loop.is_running():
            loop.call_soon_threadsafe(loop.stop)


def main() -> None:
    _force_utf8_stdio()
    Daemon().run()


if __name__ == "__main__":
    main()
