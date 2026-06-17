"""Ensure Playwright browser binaries are installed on the client machine."""

from __future__ import annotations

import asyncio
import subprocess
import sys
from pathlib import Path

_INSTALL_LOCK = asyncio.Lock()


def _chromium_installed_sync() -> bool:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        exe = playwright.chromium.executable_path
        return bool(exe and Path(exe).is_file())


async def chromium_installed() -> bool:
    return await asyncio.to_thread(_chromium_installed_sync)


def _install_chromium_sync() -> None:
    subprocess.run(
        [sys.executable, "-m", "playwright", "install", "chromium"],
        check=True,
    )


async def install_chromium() -> None:
    """Download Chromium via Playwright; raises on failure."""
    async with _INSTALL_LOCK:
        await asyncio.to_thread(_install_chromium_sync)
        if not await chromium_installed():
            raise RuntimeError("Chromium install finished but Playwright cannot find it")


async def ensure_playwright_browsers() -> None:
    """Install Chromium on first use if Playwright does not already have it."""
    if await chromium_installed():
        return
    await install_chromium()
