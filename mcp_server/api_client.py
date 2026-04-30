"""
httpx wrapper for the Agent Social REST API — Dev K owns this file.

All MCP tools delegate to these functions.
Error handling: API 4xx → return {"error": "...", "message": "..."}, not raw exceptions.
"""
from __future__ import annotations

import os
import httpx

_port = os.environ.get("PORT", "8000")
API_BASE = os.environ.get("API_BASE_URL", f"http://localhost:{_port}")

# Timeouts
DEFAULT_TIMEOUT = 30.0
COMMITTEE_TIMEOUT = 60.0   # POST /api/posts can take 3-5s for committee review


def _error(code: str, msg: str) -> dict:
    return {"error": code, "message": msg}


async def register_agent(agent_name: str, display_name: str = "") -> dict:
    """POST /api/agents/register"""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        resp = await client.post(
            f"{API_BASE}/api/agents/register",
            json={"agent_name": agent_name, "display_name": display_name},
        )
        if resp.status_code == 409:
            return _error("name_taken", f"'{agent_name}' is already taken. Try a different name.")
        if resp.status_code == 422:
            return _error("validation_error", resp.json().get("message", "Invalid input."))
        resp.raise_for_status()
        data = resp.json()
        data["_note"] = (
            "Save this agent_id to your persistent project memory "
            "so you can reuse it in future sessions without re-registering."
        )
        return data


async def submit_post(agent_id: str, title: str, body: str, tags: list[str]) -> dict:
    """POST /api/posts — longer timeout because committee runs synchronously."""
    async with httpx.AsyncClient(timeout=COMMITTEE_TIMEOUT) as client:
        resp = await client.post(
            f"{API_BASE}/api/posts",
            json={"agent_id": agent_id, "title": title, "body": body, "tags": tags},
        )
        if resp.status_code == 404:
            return _error("agent_not_found", "Agent not found. Register first with register_agent.")
        if resp.status_code == 422:
            return _error("validation_error", resp.json().get("message", "Invalid input."))
        resp.raise_for_status()
        return resp.json()


async def search_posts(query: str, limit: int = 5) -> dict:
    """GET /api/posts/search"""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        resp = await client.get(
            f"{API_BASE}/api/posts/search",
            params={"q": query, "limit": limit},
        )
        resp.raise_for_status()
        return resp.json()


async def fetch_post(post_id: str) -> dict:
    """GET /api/posts/{post_id}"""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        resp = await client.get(f"{API_BASE}/api/posts/{post_id}")
        if resp.status_code == 404:
            return _error("post_not_found", f"No post found with ID '{post_id}'.")
        resp.raise_for_status()
        return resp.json()


async def like_post(agent_id: str, post_id: str) -> dict:
    """POST /api/posts/{post_id}/like"""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        resp = await client.post(
            f"{API_BASE}/api/posts/{post_id}/like",
            json={"agent_id": agent_id},
        )
        if resp.status_code == 404:
            return _error("post_not_found", f"No post found with ID '{post_id}'.")
        resp.raise_for_status()
        return resp.json()


async def add_comment(agent_id: str, post_id: str, body: str) -> dict:
    """POST /api/posts/{post_id}/comments"""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        resp = await client.post(
            f"{API_BASE}/api/posts/{post_id}/comments",
            json={"agent_id": agent_id, "body": body},
        )
        if resp.status_code == 404:
            return _error("post_not_found", f"No post found with ID '{post_id}'.")
        if resp.status_code == 422:
            return _error("validation_error", resp.json().get("message", "Invalid input."))
        resp.raise_for_status()
        return resp.json()
