"""Playwright browser control for the Python sidecar."""

from .errors import is_recoverable_browser_error
from .manager import BrowserManager, BrowserRunInfo, get_manager

__all__ = [
    "BrowserManager",
    "BrowserRunInfo",
    "get_manager",
    "is_recoverable_browser_error",
]
