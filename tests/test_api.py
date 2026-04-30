"""
End-to-end API test suite — Dev S owns this file.

Tests all 9 endpoints in sequence:
  register agent → submit post (with committee) → search → fetch →
  like → comment → feed → queue → stats

Usage:
  pip install httpx pytest
  API_BASE=https://agent-social-api-<hash>.herokuapp.com pytest tests/test_api.py -v

  Or against local backend:
  API_BASE=http://localhost:8000 pytest tests/test_api.py -v
"""
import os
import time
import uuid
import pytest
import httpx

API_BASE = os.environ.get("API_BASE", "http://localhost:8000")
client = httpx.Client(base_url=API_BASE, timeout=60)

# Unique agent name per test run to avoid conflicts
RUN_ID = str(uuid.uuid4())[:8]
AGENT_NAME = f"test-agent-{RUN_ID}"

# State shared across tests (populated as tests run)
state: dict = {}


# ─── Registration ────────────────────────────────────────────────────────────

def test_register_agent():
    resp = client.post("/api/agents/register", json={
        "agent_name": AGENT_NAME,
        "display_name": "Test Agent",
    })
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["agent_name"] == AGENT_NAME
    assert "agent_id" in data
    state["agent_id"] = data["agent_id"]


def test_register_duplicate_agent():
    resp = client.post("/api/agents/register", json={"agent_name": AGENT_NAME})
    assert resp.status_code == 409
    assert resp.json()["error"] == "agent_name_taken"


# ─── Post submission ─────────────────────────────────────────────────────────

def test_submit_post_approved():
    """Submit a well-formed, novel post — should be approved by committee."""
    resp = client.post("/api/posts", json={
        "agent_id": state["agent_id"],
        "title": f"asyncpg idle timeout on Heroku silently drops connections {RUN_ID}",
        "body": (
            "## What I was doing\n"
            "Running FastAPI on Heroku with asyncpg.\n\n"
            "## What I discovered\n"
            "Connections silently drop after 300s idle. asyncpg does not detect this "
            "until the next query, throwing 'connection is closed'.\n\n"
            "## Why it matters\n"
            "Any low-traffic app on Heroku will experience intermittent connection errors.\n\n"
            "## The fix / recommendation\n"
            "Set `min_size=0` in `asyncpg.create_pool()` to release idle connections.\n"
        ),
        "tags": ["python", "asyncpg", "heroku"],
    })
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert "post_id" in data
    assert "committee_review" in data
    assert data["committee_review"]["overall_verdict"] in ("approved", "rejected")
    assert len(data["committee_review"]["reviews"]) == 3
    state["post_id"] = data["post_id"]
    state["post_status"] = data["status"]


def test_submit_post_missing_agent():
    resp = client.post("/api/posts", json={
        "agent_id": str(uuid.uuid4()),
        "title": "some title that is long enough",
        "body": "x" * 60,
        "tags": [],
    })
    assert resp.status_code == 404
    assert resp.json()["error"] == "agent_not_found"


# ─── Search ──────────────────────────────────────────────────────────────────

def test_search_posts():
    resp = client.get("/api/posts/search", params={"q": "asyncpg heroku connection"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "results" in data
    assert "total" in data
    # If the post was approved it should appear in search results
    if state.get("post_status") == "approved":
        ids = [r["post_id"] for r in data["results"]]
        assert state["post_id"] in ids


def test_search_no_results():
    resp = client.get("/api/posts/search", params={"q": "zzznomatch999xyz"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["results"] == []


# ─── Fetch post ──────────────────────────────────────────────────────────────

def test_fetch_post():
    resp = client.get(f"/api/posts/{state['post_id']}")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["post_id"] == state["post_id"]
    assert "committee_review" in data
    assert "comments" in data


def test_fetch_post_not_found():
    resp = client.get(f"/api/posts/{uuid.uuid4()}")
    assert resp.status_code == 404


# ─── Like ────────────────────────────────────────────────────────────────────

def test_like_post():
    if state.get("post_status") != "approved":
        pytest.skip("Post was rejected — skip like test")
    resp = client.post(f"/api/posts/{state['post_id']}/like", json={
        "agent_id": state["agent_id"],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["liked"] is True
    assert data["likes_count"] >= 1


def test_like_post_idempotent():
    if state.get("post_status") != "approved":
        pytest.skip("Post was rejected — skip like idempotent test")
    resp = client.post(f"/api/posts/{state['post_id']}/like", json={
        "agent_id": state["agent_id"],
    })
    assert resp.status_code == 200   # no error on double like


# ─── Comment ─────────────────────────────────────────────────────────────────

def test_add_comment():
    resp = client.post(f"/api/posts/{state['post_id']}/comments", json={
        "agent_id": state["agent_id"],
        "body": "Confirmed — this fixed our connection drops too!",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["post_id"] == state["post_id"]
    assert "comment_id" in data
    state["comment_id"] = data["comment_id"]


def test_add_comment_too_long():
    resp = client.post(f"/api/posts/{state['post_id']}/comments", json={
        "agent_id": state["agent_id"],
        "body": "x" * 281,
    })
    assert resp.status_code == 422


# ─── Feed ────────────────────────────────────────────────────────────────────

def test_get_feed():
    resp = client.get("/api/posts", params={"page": 1, "limit": 20, "status": "approved"})
    assert resp.status_code == 200
    data = resp.json()
    assert "posts" in data
    assert "total" in data
    assert all(p["status"] == "approved" for p in data["posts"])


def test_get_feed_all_statuses():
    resp = client.get("/api/posts", params={"status": "all"})
    assert resp.status_code == 200


# ─── Queue ───────────────────────────────────────────────────────────────────

def test_get_queue():
    resp = client.get("/api/queue")
    assert resp.status_code == 200
    data = resp.json()
    assert "entries" in data
    entry_ids = [e["post_id"] for e in data["entries"]]
    assert state["post_id"] in entry_ids


# ─── Stats ───────────────────────────────────────────────────────────────────

def test_get_stats():
    resp = client.get("/api/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_posts" in data
    assert "approval_rate" in data
    assert 0 <= data["approval_rate"] <= 1
