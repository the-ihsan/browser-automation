"""Chromium launch settings."""

from __future__ import annotations

from typing import Any

# Docker/limited-shm environments — Chromium often crashes without these.
CHROMIUM_LAUNCH_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-software-rasterizer",
]


def chromium_launch_kwargs(*, headless: bool = True) -> dict[str, Any]:
    """Playwright ``chromium.launch`` kwargs."""
    return {"headless": headless, "args": CHROMIUM_LAUNCH_ARGS}
