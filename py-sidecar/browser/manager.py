"""Atomic Playwright browser lifecycle — start, recover, stop."""

from __future__ import annotations

import asyncio
import uuid
from contextlib import AsyncExitStack
from dataclasses import dataclass
from typing import Any

from playwright.async_api import Browser, BrowserContext, Page, Playwright

from sidecar import bus

from .install import ensure_playwright_browsers
from .launch import chromium_launch_kwargs
from .pages import close_page, open_page


@dataclass(frozen=True)
class BrowserRunInfo:
    run_id: str
    headless: bool
    url: str
    running: bool
    crashed: bool = False


class BrowserManager:
    """Owns Playwright browser lifecycle; relaunch only via :meth:`recover`."""

    def __init__(self) -> None:
        self._stack = AsyncExitStack()
        self._playwright: Playwright | None = None
        self._launch_kwargs: dict[str, Any] = chromium_launch_kwargs(headless=True)
        self._run_id: str | None = None
        self._crashed = False
        self._closing = False
        self.browser: Browser | None = None
        self.context: BrowserContext | None = None
        self.page: Page | None = None

    @property
    def run_id(self) -> str | None:
        return self._run_id

    def _is_alive(self) -> bool:
        if self.browser is None:
            return False
        try:
            if not self.browser.is_connected():
                return False
            if self.page is None or self.page.is_closed():
                return False
            return True
        except Exception:
            return False

    @property
    def is_running(self) -> bool:
        return self._is_alive()

    @property
    def headless(self) -> bool | None:
        if not self.is_running:
            return None
        return bool(self._launch_kwargs.get("headless", True))

    def _on_page_close(self, _: Page) -> None:
        self._schedule_external_close(crashed=False)

    def _on_browser_disconnected(self, _: Browser) -> None:
        self._schedule_external_close(crashed=True)

    def _schedule_external_close(self, *, crashed: bool) -> None:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        loop.create_task(self._handle_external_close(crashed=crashed))

    async def _handle_external_close(self, *, crashed: bool) -> None:
        if self._closing or self._run_id is None:
            return

        self._closing = True
        try:
            run_id = self._run_id
            headless = bool(self._launch_kwargs.get("headless", True))
            self._crashed = crashed
            await self._shutdown()
            await self._stack.aclose()
            self._stack = AsyncExitStack()
            self._playwright = None
            self._run_id = None
            bus.emit(
                "browser.closed",
                {
                    "ok": True,
                    "run_id": run_id,
                    "running": False,
                    "headless": headless,
                    "url": "",
                    "crashed": crashed,
                },
            )
        finally:
            self._closing = False

    async def refresh(self) -> bool:
        """Detect a closed/crashed browser and tear down stale state."""
        if self.browser is None:
            return self._crashed

        if self._is_alive():
            self._crashed = False
            return False

        crashed = True
        try:
            crashed = not self.browser.is_connected()
        except Exception:
            crashed = True

        await self._handle_external_close(crashed=crashed)
        return crashed

    async def start(self, *, headless: bool = True) -> BrowserRunInfo:
        await self.refresh()
        if self.is_running:
            raise RuntimeError("browser is already running")

        await ensure_playwright_browsers()
        self._launch_kwargs = chromium_launch_kwargs(headless=headless)
        self._run_id = str(uuid.uuid4())
        self._crashed = False

        from playwright.async_api import async_playwright

        self._playwright = await self._stack.enter_async_context(async_playwright())
        await self._launch()
        assert self.page is not None and self._run_id is not None
        return BrowserRunInfo(
            run_id=self._run_id,
            headless=headless,
            url=self.page.url,
            running=True,
        )

    async def recover(self, *, run_id: str | None = None) -> BrowserRunInfo:
        await self.refresh()
        self._require_run(run_id)
        if self._playwright is None:
            raise RuntimeError("browser is not running")

        await self._shutdown()
        await asyncio.sleep(1.0)
        await self._launch()
        assert self.page is not None and self._run_id is not None
        return BrowserRunInfo(
            run_id=self._run_id,
            headless=bool(self._launch_kwargs.get("headless", True)),
            url=self.page.url,
            running=True,
        )

    async def stop(self, *, run_id: str | None = None) -> BrowserRunInfo | None:
        await self.refresh()
        if not self.is_running and self._run_id is None:
            return None

        if run_id is not None and self._run_id != run_id:
            raise RuntimeError(f"unknown browser run '{run_id}'")

        self._closing = True
        try:
            stopped_id = self._run_id
            await self._shutdown()
            await self._stack.aclose()
            self._stack = AsyncExitStack()
            self._playwright = None
            self._run_id = None
            self._crashed = False
            return BrowserRunInfo(
                run_id=stopped_id or "",
                headless=bool(self._launch_kwargs.get("headless", True)),
                url="",
                running=False,
            )
        finally:
            self._closing = False

    async def status(self, *, run_id: str | None = None) -> BrowserRunInfo:
        crashed = await self.refresh()
        headless = self.headless

        if self.is_running and self._run_id is not None:
            assert self.page is not None
            return BrowserRunInfo(
                run_id=self._run_id,
                headless=bool(headless),
                url=self.page.url,
                running=True,
                crashed=False,
            )

        if run_id and not self.is_running:
            return BrowserRunInfo(
                run_id=run_id,
                headless=bool(headless) if headless is not None else True,
                url="",
                running=False,
                crashed=crashed,
            )

        return BrowserRunInfo(
            run_id=self._run_id or "",
            headless=bool(headless) if headless is not None else True,
            url="",
            running=False,
            crashed=crashed,
        )

    def _require_run(self, run_id: str | None) -> None:
        if run_id is None:
            return
        if self._run_id != run_id:
            raise RuntimeError(f"unknown browser run '{run_id}'")

    async def _launch(self) -> None:
        assert self._playwright is not None
        self.browser = await self._playwright.chromium.launch(**self._launch_kwargs)
        self.browser.on("disconnected", self._on_browser_disconnected)
        self.context = await self.browser.new_context(locale="en-US")
        self.page = await open_page(self.context)
        self.page.on("close", self._on_page_close)

    async def _shutdown(self) -> None:
        if self.page is not None:
            try:
                self.page.remove_listener("close", self._on_page_close)
            except Exception:
                pass
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
                self.browser.remove_listener(
                    "disconnected", self._on_browser_disconnected
                )
            except Exception:
                pass
            try:
                if self.browser.is_connected():
                    await self.browser.close()
            except Exception:
                pass
            self.browser = None


_manager = BrowserManager()


def get_manager() -> BrowserManager:
    return _manager
