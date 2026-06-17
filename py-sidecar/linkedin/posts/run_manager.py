"""Active LinkedIn posts scrape runs."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .scraper import LinkedInPostsScraper, ScrapeConfig
from .urls import normalize_profile_url


@dataclass
class SessionEntry:
    session_id: str
    session_dir: Path


@dataclass
class ActiveRun:
    run_id: str
    config: ScrapeConfig
    task: asyncio.Task[None] | None = None
    scraper: LinkedInPostsScraper | None = None
    sessions: list[SessionEntry] = field(default_factory=list)
    session_index: int = 0


class RunManager:
    def __init__(self) -> None:
        self._runs: dict[str, ActiveRun] = {}

    def get(self, run_id: str) -> ActiveRun | None:
        return self._runs.get(run_id)

    async def start(self, payload: dict[str, Any]) -> dict[str, Any]:
        run_id = str(payload.get("run_id", "")).strip()
        if not run_id:
            raise ValueError("run_id is required")

        profile_url = normalize_profile_url(
            str(payload.get("profile_url", "")).strip()
        )

        sessions_raw = payload.get("sessions") or []
        sessions: list[SessionEntry] = []
        for entry in sessions_raw:
            if not isinstance(entry, dict):
                continue
            sid = str(entry.get("session_id", "")).strip()
            sdir = str(entry.get("session_dir", "")).strip()
            if sid and sdir:
                sessions.append(SessionEntry(session_id=sid, session_dir=Path(sdir)))

        if not sessions:
            raise ValueError("at least one session is required")

        session_index = int(payload.get("current_session_index") or 0)
        if session_index >= len(sessions):
            session_index = 0

        session = sessions[session_index]
        initial_post_ids = payload.get("initial_post_ids") or []
        if not isinstance(initial_post_ids, list):
            initial_post_ids = []
        initial_post_ids = [str(x) for x in initial_post_ids]

        existing_post_ids = payload.get("existing_post_ids") or []
        if not isinstance(existing_post_ids, list):
            existing_post_ids = []
        existing_post_ids_set = {str(x) for x in existing_post_ids}

        post_count = payload.get("post_count")
        post_count_int = int(post_count) if post_count is not None else None

        config = ScrapeConfig(
            run_id=run_id,
            profile_url=profile_url,
            session_id=session.session_id,
            session_dir=session.session_dir,
            headless=bool(payload.get("headless", True)),
            post_count=post_count_int,
            start_from=max(1, int(payload.get("start_from") or 1)),
            post_matcher=payload.get("post_matcher"),
            initial_post_ids=initial_post_ids,
            initial_top_post_id=payload.get("initial_top_post_id"),
            resume_from_ordinal=int(payload.get("resume_from_ordinal") or 0),
            existing_post_ids=existing_post_ids_set,
        )

        existing = self._runs.get(run_id)
        if existing and existing.task and not existing.task.done():
            return {"ok": True, "run_id": run_id, "already_running": True}

        scraper = LinkedInPostsScraper(config)
        task = asyncio.create_task(scraper.run())

        self._runs[run_id] = ActiveRun(
            run_id=run_id,
            config=config,
            task=task,
            scraper=scraper,
            sessions=sessions,
            session_index=session_index,
        )

        def _cleanup(t: asyncio.Task[None]) -> None:
            active = self._runs.get(run_id)
            if active and active.task is t:
                self._runs.pop(run_id, None)

        task.add_done_callback(_cleanup)

        return {"ok": True, "run_id": run_id}

    def control(self, payload: dict[str, Any]) -> None:
        run_id = str(payload.get("run_id", "")).strip()
        action = str(payload.get("action", "")).strip().lower()
        active = self._runs.get(run_id)
        if active is None or active.scraper is None:
            return
        if action == "pause":
            active.scraper.pause()
        elif action == "resume":
            active.scraper.resume()
        elif action == "stop":
            active.scraper.stop()


_manager = RunManager()


def get_run_manager() -> RunManager:
    return _manager
