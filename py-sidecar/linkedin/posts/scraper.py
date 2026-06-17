"""LinkedIn profile posts scraper — Playwright domain logic."""

from __future__ import annotations

import asyncio
from contextlib import AsyncExitStack
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from playwright.async_api import Browser, BrowserContext, Page, Playwright

from browser.errors import is_recoverable_browser_error
from browser.install import ensure_playwright_browsers
from browser.launch import chromium_launch_kwargs
from browser.pages import close_page, open_page
from browser.sessions.storage import storage_path
from sidecar import bus

from .extractors import EXPAND_TRUNCATED_POSTS_JS, EXTRACT_POSTS_JS, parse_posts
from .scrolling import count_posts_in_dom, scroll_feed_down
from .urls import profile_activity_url

_STAGNANT_ROUNDS_LIMIT = 8
_RECOVER_SETTLE_SEC = 1.0


@dataclass
class ScrapeConfig:
    run_id: str
    profile_url: str
    session_id: str
    session_dir: Path
    headless: bool = True
    post_count: int | None = None
    start_from: int = 1
    post_matcher: str | None = None
    initial_post_ids: list[str] = field(default_factory=list)
    initial_top_post_id: str | None = None
    resume_from_ordinal: int = 0
    existing_post_ids: set[str] = field(default_factory=set)


class LinkedInPostsScraper:
    def __init__(self, config: ScrapeConfig) -> None:
        self.config = config
        self._stack = AsyncExitStack()
        self._playwright: Playwright | None = None
        self.browser: Browser | None = None
        self.context: BrowserContext | None = None
        self.page: Page | None = None
        self._paused = asyncio.Event()
        self._paused.set()
        self._stop = False
        self._activity_url = ""
        self._top_post_id: str | None = config.initial_top_post_id
        self._initial_snapshot_ids: set[str] = set(config.initial_post_ids)
        self._seen_ids: set[str] = set(config.existing_post_ids)
        self._matched = 0
        self._ordinal_map: dict[str, int] = {}
        self._next_ordinal = max(config.resume_from_ordinal, 0) + 1

    def pause(self) -> None:
        self._paused.clear()

    def resume(self) -> None:
        self._paused.set()

    def stop(self) -> None:
        self._stop = True
        self._paused.set()

    async def _wait_if_paused(self) -> bool:
        await self._paused.wait()
        return self._stop

    async def _launch(self) -> None:
        await ensure_playwright_browsers()
        from playwright.async_api import async_playwright

        self._playwright = await self._stack.enter_async_context(async_playwright())
        launch_kwargs = chromium_launch_kwargs(headless=self.config.headless)
        self.browser = await self._playwright.chromium.launch(**launch_kwargs)

        context_kwargs: dict[str, Any] = {"locale": "en-US"}
        state_file = storage_path(self.config.session_dir)
        if state_file.is_file():
            context_kwargs["storage_state"] = str(state_file)

        self.context = await self.browser.new_context(**context_kwargs)
        self.page = await open_page(self.context)

    async def _shutdown(self) -> None:
        if self.page is not None:
            await close_page(self.page)
            self.page = None
        if self.context is not None:
            try:
                await self.context.close()
            except Exception:
                pass
            self.context = None
        if self.browser is not None:
            try:
                if self.browser.is_connected():
                    await self.browser.close()
            except Exception:
                pass
            self.browser = None

    async def _recover_browser(self) -> None:
        """Relaunch browser and return to the activity page after a crash."""
        await self._shutdown()
        await asyncio.sleep(_RECOVER_SETTLE_SEC)
        await self._launch()
        assert self.page is not None
        await self.page.goto(
            self._activity_url,
            wait_until="domcontentloaded",
            timeout=90_000,
        )
        await asyncio.sleep(2.0)

    async def _with_page_retry(self, fn):
        assert self.page is not None
        try:
            return await fn()
        except Exception as exc:
            if not is_recoverable_browser_error(exc):
                raise
            await self._recover_browser()
            return await fn()

    def _profile_activity_url(self) -> str:
        return profile_activity_url(self.config.profile_url)

    async def _looks_logged_in(self) -> bool:
        assert self.page is not None
        final_url = self.page.url.lower()
        if any(m in final_url for m in ("login", "signin", "checkpoint", "authwall")):
            return False
        cookies = await self.context.cookies() if self.context else []
        return len(cookies) > 0

    async def _expand_truncated_posts(self) -> None:
        assert self.page is not None
        await self.page.evaluate(EXPAND_TRUNCATED_POSTS_JS)

    async def _extract_visible_posts(self) -> list[dict[str, Any]]:
        assert self.page is not None
        await self._expand_truncated_posts()
        raw = await self.page.evaluate(EXTRACT_POSTS_JS)
        return parse_posts(raw)

    async def _run_matcher(self, post: dict[str, Any]) -> bool:
        matcher = self.config.post_matcher
        if not matcher or not matcher.strip():
            return True
        assert self.page is not None
        try:
            result = await self.page.evaluate(
                """
                ([code, post]) => {
                  try {
                    const fn = new Function('post', code);
                    return Boolean(fn(post));
                  } catch (e) {
                    return false;
                  }
                }
                """,
                [matcher.strip(), post],
            )
            return bool(result)
        except Exception:
            return False

    async def _snapshot_anchor(self) -> list[str]:
        posts = await self._with_page_retry(self._extract_visible_posts)
        ids = [p["post_id"] for p in posts if p.get("post_id")]
        if not self._top_post_id and ids:
            self._top_post_id = ids[0]

        if not self._initial_snapshot_ids and ids:
            self._initial_snapshot_ids = set(ids)
            for idx, pid in enumerate(ids, start=1):
                if pid not in self._ordinal_map:
                    self._ordinal_map[pid] = idx
            self._next_ordinal = max(self._ordinal_map.values(), default=0) + 1
            bus.emit(
                "linkedin.posts.run.anchor",
                {
                    "run_id": self.config.run_id,
                    "initial_top_post_id": ids[0],
                    "initial_post_ids": ids,
                },
            )
        elif self.config.initial_post_ids:
            for idx, pid in enumerate(self.config.initial_post_ids, start=1):
                if pid not in self._ordinal_map:
                    self._ordinal_map[pid] = idx
            self._next_ordinal = max(self._ordinal_map.values(), default=0) + 1

        return ids

    def _eligible_posts(self, posts: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Posts to process: anchor onward in DOM, skipping new-at-top inserts."""
        if not posts:
            return []

        top_id = self._top_post_id
        if not top_id:
            return posts

        dom_ids = [p.get("post_id") for p in posts]
        try:
            top_idx = dom_ids.index(top_id)
        except ValueError:
            top_idx = 0

        eligible: list[dict[str, Any]] = []
        for idx, post in enumerate(posts):
            post_id = post.get("post_id")
            if not post_id:
                continue
            if idx < top_idx:
                if (
                    post_id not in self._initial_snapshot_ids
                    and post_id not in self._ordinal_map
                    and post_id not in self._seen_ids
                ):
                    continue
            eligible.append(post)
        return eligible

    def _ordinal_for(self, post_id: str) -> int:
        existing = self._ordinal_map.get(post_id)
        if existing is not None:
            return existing
        ordinal = self._next_ordinal
        self._next_ordinal += 1
        self._ordinal_map[post_id] = ordinal
        return ordinal

    async def _process_posts(self, posts: list[dict[str, Any]]) -> int:
        processed = 0
        for post in posts:
            if self._stop:
                break
            if await self._wait_if_paused():
                break
            post_id = post.get("post_id")
            if not post_id or post_id in self._seen_ids:
                continue

            ordinal = self._ordinal_for(post_id)
            if ordinal < self.config.start_from:
                self._seen_ids.add(post_id)
                continue

            matched = await self._run_matcher(post)
            self._seen_ids.add(post_id)
            processed += 1

            bus.emit(
                "linkedin.posts.run.post",
                {
                    "run_id": self.config.run_id,
                    "post": post,
                    "ordinal": ordinal,
                    "matched": matched,
                    "session_id": self.config.session_id,
                },
            )

            if matched:
                self._matched += 1
                if (
                    self.config.post_count is not None
                    and self._matched >= self.config.post_count
                ):
                    self._stop = True
                    break
        return processed

    async def _count_dom_posts(self) -> int:
        assert self.page is not None
        return await count_posts_in_dom(self.page)

    async def _pause_aware_sleep(self, seconds: float) -> bool:
        """Sleep in short slices so pause/stop are responsive. Returns True if stopped."""
        remaining = seconds
        while remaining > 0:
            if self._stop:
                return True
            if not self._paused.is_set():
                await self._paused.wait()
                if self._stop:
                    return True
            step = min(remaining, 0.1)
            await asyncio.sleep(step)
            remaining -= step
        return self._stop

    async def _scroll_feed(self) -> None:
        assert self.page is not None
        await scroll_feed_down(self.page, delay=0)
        await self._pause_aware_sleep(1.5)

    async def run(self) -> None:
        try:
            await self._launch()
            assert self.page is not None

            self._activity_url = self._profile_activity_url()
            await self.page.goto(
                self._activity_url,
                wait_until="domcontentloaded",
                timeout=90_000,
            )
            await asyncio.sleep(2.0)

            if not await self._looks_logged_in():
                bus.emit(
                    "linkedin.posts.run.error",
                    {
                        "run_id": self.config.run_id,
                        "session_id": self.config.session_id,
                        "reason": "not_logged_in",
                        "message": "Session is not logged in",
                    },
                )
                return

            await self._snapshot_anchor()

            stagnant_rounds = 0
            last_dom_count = 0

            while not self._stop:
                if await self._wait_if_paused():
                    break

                posts = await self._with_page_retry(self._extract_visible_posts)
                eligible = self._eligible_posts(posts)
                await self._process_posts(eligible)

                if self._stop:
                    break

                dom_count = await self._with_page_retry(self._count_dom_posts)

                bus.emit(
                    "linkedin.posts.run.progress",
                    {
                        "run_id": self.config.run_id,
                        "collected": len(self._seen_ids),
                        "matched": self._matched,
                        "dom_count": dom_count,
                        "url": self.page.url,
                    },
                )

                if dom_count <= last_dom_count:
                    stagnant_rounds += 1
                else:
                    stagnant_rounds = 0
                    last_dom_count = dom_count

                if stagnant_rounds >= _STAGNANT_ROUNDS_LIMIT:
                    break

                await self._with_page_retry(self._scroll_feed)

            limit_reached = (
                self.config.post_count is not None
                and self._matched >= self.config.post_count
            )
            bus.emit(
                "linkedin.posts.run.finished",
                {
                    "run_id": self.config.run_id,
                    "ok": not self._stop or limit_reached,
                    "stopped": self._stop and not limit_reached,
                },
            )
        except Exception as exc:
            if is_recoverable_browser_error(exc):
                bus.emit(
                    "linkedin.posts.run.error",
                    {
                        "run_id": self.config.run_id,
                        "session_id": self.config.session_id,
                        "reason": "browser_crashed",
                        "message": str(exc),
                    },
                )
            bus.emit(
                "linkedin.posts.run.finished",
                {
                    "run_id": self.config.run_id,
                    "ok": False,
                    "error": str(exc),
                },
            )
        finally:
            await self._shutdown()
            await self._stack.aclose()
