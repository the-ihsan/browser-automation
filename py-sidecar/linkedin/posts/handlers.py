"""Bus handlers for LinkedIn posts scraping."""

from __future__ import annotations

from typing import Any

from sidecar.registry import on, on_req

from .run_manager import get_run_manager


def _payload_dict(payload: Any) -> dict[str, Any]:
    if isinstance(payload, dict):
        return payload
    return {}


@on_req("linkedin.posts.run.start")
async def linkedin_posts_run_start(payload: Any) -> dict[str, Any]:
    data = _payload_dict(payload)
    return await get_run_manager().start(data)


@on("linkedin.posts.run.control")
def linkedin_posts_run_control(payload: Any) -> None:
    get_run_manager().control(_payload_dict(payload))
