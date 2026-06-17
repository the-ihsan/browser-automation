"""Sidecar request handlers for browser control."""

from __future__ import annotations

import subprocess
from typing import Any

from sidecar import registry

from .install import chromium_installed, install_chromium
from .manager import BrowserRunInfo, get_manager


def _headless_from_payload(payload: Any) -> bool:
    if isinstance(payload, dict):
        return bool(payload.get("headless", True))
    return True


def _run_id_from_payload(payload: Any) -> str | None:
    if isinstance(payload, dict):
        value = payload.get("run_id")
        if value is not None:
            return str(value)
    return None


def _run_to_dict(info: BrowserRunInfo) -> dict[str, Any]:
    return {
        "ok": True,
        "run_id": info.run_id,
        "running": info.running,
        "headless": info.headless,
        "url": info.url,
        "crashed": info.crashed,
    }


@registry.on_req("browser.launch")
async def browser_launch(payload: Any) -> dict[str, Any]:
    headless = _headless_from_payload(payload)
    info = await get_manager().start(headless=headless)
    return _run_to_dict(info)


@registry.on_req("browser.stop")
async def browser_stop(payload: Any) -> dict[str, Any]:
    run_id = _run_id_from_payload(payload)
    info = await get_manager().stop(run_id=run_id)
    if info is None:
        return {
            "ok": True,
            "run_id": run_id or "",
            "running": False,
            "headless": True,
            "url": "",
            "crashed": False,
        }
    return _run_to_dict(info)


@registry.on_req("browser.status")
async def browser_status(payload: Any) -> dict[str, Any]:
    run_id = _run_id_from_payload(payload)
    info = await get_manager().status(run_id=run_id)
    return _run_to_dict(info)


@registry.on_req("browser.recover")
async def browser_recover(payload: Any) -> dict[str, Any]:
    run_id = _run_id_from_payload(payload)
    info = await get_manager().recover(run_id=run_id)
    return _run_to_dict(info)


@registry.on_req("browser.install.status")
async def browser_install_status(_payload: Any) -> dict[str, Any]:
    return {"ok": True, "installed": await chromium_installed()}


@registry.on_req("browser.install.run")
async def browser_install_run(_payload: Any) -> dict[str, Any]:
    try:
        await install_chromium()
    except subprocess.CalledProcessError as exc:
        return {
            "ok": False,
            "installed": await chromium_installed(),
            "error": f"playwright install failed (exit {exc.returncode})",
        }
    except Exception as exc:
        return {
            "ok": False,
            "installed": await chromium_installed(),
            "error": str(exc),
        }
    return {"ok": True, "installed": True}
