"""
FastAPI application — Dev G owns this file.

All 9 endpoints live here:
  POST   /api/agents/register
  POST   /api/posts                    ← triggers committee review
  GET    /api/posts/search
  GET    /api/posts/{post_id}
  POST   /api/posts/{post_id}/like
  POST   /api/posts/{post_id}/comments
  GET    /api/posts                    ← paginated feed (frontend-only)
  GET    /api/queue                    ← review queue (frontend-only)
  GET    /api/stats                    ← dashboard data (frontend-only)

Implementation order (Day 1):
  1. POST /api/agents/register
  2. GET  /api/posts/search
  3. GET  /api/posts/{post_id}
  4. GET  /api/posts  (feed)
  5. POST /api/posts/{post_id}/like
  6. POST /api/posts/{post_id}/comments
  7. POST /api/posts  (stub: status='approved', skip committee)
  Then wire up committee.py into POST /api/posts (hours 4.5–7).
  Then GET /api/queue + GET /api/stats.
"""
from __future__ import annotations

import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import asyncpg
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend import db as db
from backend.db import get_pool, close_pool
from backend.models import (
    AgentRegisterRequest, AgentRegisterResponse,
    PostSubmitRequest, PostSubmitResponse,
    PostSearchResponse, PostSearchResult,
    PostDetailResponse, CommitteeReview, ReviewerVerdict, CommentOut,
    FeedResponse, PostSummary,
    LikeRequest, LikeResponse,
    CommentRequest, CommentResponse,
    QueueResponse, QueueEntry,
    StatsResponse, TopAgent, TopTag, RecentActivity,
)
from backend.committee import run_committee_review, generate_summary_and_tags
from mcp_server.server import mcp


# Build the MCP sub-app once — shared between lifespan and middleware.
# path="/mcp" means the sub-app has a route at /mcp, so the middleware can
# pass requests through with the original path and no rewriting needed.
mcp_app = mcp.http_app(path="/mcp")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with mcp_app.lifespan(app):
        await get_pool()
        yield
        await close_pool()


class MCPMiddleware:
    """Pure ASGI middleware that routes /mcp* to the FastMCP sub-app.

    Starlette's app.mount() returns Match.PARTIAL for the exact path /mcp,
    while the SPA catch-all Route("/{full_path:path}") returns Match.FULL.
    Starlette always picks FULL, so the mount never wins. This middleware runs
    before routing and delegates /mcp requests directly to the FastMCP app.
    """

    def __init__(self, app: object, mcp_asgi_app: object) -> None:
        self.app = app
        self.mcp_asgi_app = mcp_asgi_app

    async def __call__(self, scope: dict, receive: object, send: object) -> None:
        if scope["type"] == "http":
            path: str = scope.get("path", "")
            if path == "/mcp" or path.startswith("/mcp/"):
                if path == "/mcp":
                    # FastMCP's internal Mount regex requires a trailing slash.
                    # Rewrite here so the client gets no redirect round-trip.
                    scope = {**scope, "path": "/mcp/", "raw_path": b"/mcp/"}
                await self.mcp_asgi_app(scope, receive, send)
                return
        await self.app(scope, receive, send)


app = FastAPI(title="Agent Social API", lifespan=lifespan)

# CORS: allow all origins for hackathon
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
# MCPMiddleware added after CORS so it sits outermost in the stack
# (add_middleware is LIFO — last added = first to run).
app.add_middleware(MCPMiddleware, mcp_asgi_app=mcp_app)


# ─── Agents ──────────────────────────────────────────────────────────────────

@app.post("/api/agents/register", status_code=201, response_model=AgentRegisterResponse)
async def register_agent(body: AgentRegisterRequest):
    """Register a new agent. Returns agent_id needed for all other write operations."""
    pool = await get_pool()
    try:
        row = await pool.fetchrow(
            """
            INSERT INTO agents (agent_name, display_name)
            VALUES ($1, $2)
            RETURNING id, agent_name, display_name, registered_at
            """,
            body.agent_name,
            body.display_name if body.display_name else None,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "agent_name_taken",
                "message": f"Agent name '{body.agent_name}' is already registered. Try a different name.",
            },
        )
    return AgentRegisterResponse(
        agent_id=str(row["id"]),
        agent_name=row["agent_name"],
        display_name=row["display_name"] or "",
        registered_at=row["registered_at"],
    )


# ─── Posts ───────────────────────────────────────────────────────────────────

@app.post("/api/posts", status_code=201, response_model=PostSubmitResponse)
async def submit_post(body: PostSubmitRequest):
    """
    Submit a post to the review queue.
    Committee runs synchronously (~3-5s). Response includes full verdict.
    """
    # Validate agent_id UUID format early to give a clean 422 before any DB work.
    try:
        uuid.UUID(body.agent_id)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail={"error": "validation_error", "message": "agent_id must be a valid UUID."},
        )

    pool = await get_pool()
    try:
        # Step 1: Verify agent exists
        agent_row = await pool.fetchrow(
            "SELECT id, agent_name FROM agents WHERE id = $1::uuid",
            body.agent_id,
        )
        if agent_row is None:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "agent_not_found",
                    "message": f"No agent registered with ID '{body.agent_id}'. Register first using register_agent.",
                },
            )

        # Step 2: INSERT post with status='in_review'
        post_row = await pool.fetchrow(
            """
            INSERT INTO posts (agent_id, title, body, tags, summary, status)
            VALUES ($1::uuid, $2, $3, $4, NULL, 'in_review')
            RETURNING id, posted_at
            """,
            body.agent_id,
            body.title,
            body.body,
            body.tags if body.tags else [],
        )
        post_id = str(post_row["id"])

        # Step 3: INSERT review_queue entry
        queue_row = await pool.fetchrow(
            """
            INSERT INTO review_queue (post_id, status)
            VALUES ($1::uuid, 'pending')
            RETURNING id
            """,
            post_id,
        )
        queue_entry_id = str(queue_row["id"])

        # Step 4: Generate summary always; generate tags too if none provided
        tags = list(body.tags) if body.tags else []
        gen = await generate_summary_and_tags(body.title, body.body)
        summary = gen["summary"]
        if not tags:
            tags = gen["tags"]

        # Step 5: Update post with summary (and tags if generated)
        await pool.execute(
            "UPDATE posts SET summary = $2, tags = $3 WHERE id = $1::uuid",
            post_id,
            summary,
            tags,
        )

        # Step 6: Run committee review (3-5s, parallel Claude calls)
        committee_result = await run_committee_review(
            post={"id": post_id, "title": body.title, "body": body.body, "tags": tags},
        )

        # Step 7: UPDATE post status + reviewed_at
        overall_verdict = committee_result["overall_verdict"]
        await pool.execute(
            "UPDATE posts SET status = $2, reviewed_at = now() WHERE id = $1::uuid",
            post_id,
            overall_verdict,
        )

        # Step 8: UPDATE review_queue entry
        await pool.execute(
            """
            UPDATE review_queue
            SET status = 'completed',
                overall_verdict = $2,
                overall_feedback = $3,
                completed_at = now()
            WHERE id = $1::uuid
            """,
            queue_entry_id,
            committee_result["overall_verdict"],
            committee_result["overall_feedback"],
        )

        # Step 9: INSERT 3 review rows
        for review in committee_result["reviews"]:
            await pool.execute(
                """
                INSERT INTO reviews (queue_entry_id, post_id, reviewer_role, verdict, reasoning)
                VALUES ($1::uuid, $2::uuid, $3, $4, $5)
                """,
                queue_entry_id,
                post_id,
                review["reviewer_role"],
                review["verdict"],
                review["reasoning"],
            )

        return PostSubmitResponse(
            post_id=post_id,
            status=overall_verdict,
            summary=summary or "",
            queue_entry_id=queue_entry_id,
            committee_review=CommitteeReview(
                overall_verdict=committee_result["overall_verdict"],
                overall_feedback=committee_result["overall_feedback"],
                reviews=[
                    ReviewerVerdict(
                        reviewer_role=r["reviewer_role"],
                        verdict=r["verdict"],
                        reasoning=r["reasoning"],
                    )
                    for r in committee_result["reviews"]
                ],
            ),
        )

    except HTTPException:
        raise
    except asyncpg.exceptions.InvalidTextRepresentationError:
        raise HTTPException(
            status_code=422,
            detail={"error": "validation_error", "message": "Invalid UUID format for agent_id."},
        )


@app.get("/api/posts/search", response_model=PostSearchResponse)
async def search_posts(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=5, ge=1, le=10),
):
    """
    Full-text search over approved posts.
    Uses plainto_tsquery (not to_tsquery) — handles natural language.
    Ranked by ts_rank with weighted fields (title=A, summary=A, tags=B, body=C).
    Also used internally by the Duplicate Detector.
    """
    pool = await get_pool()
    rows = await db.search_posts(pool, q, limit)
    results = [
        PostSearchResult(
            post_id=str(row["id"]),
            title=row["title"],
            summary=row["summary"],
            tags=list(row["tags"]),
            agent_name=row["agent_name"],
            likes_count=row["likes_count"],
            comments_count=int(row["comments_count"]),
            posted_at=row["posted_at"],
            relevance_rank=float(row["relevance_rank"]),
        )
        for row in rows
    ]
    return PostSearchResponse(query=q, total=len(results), results=results)


@app.get("/api/posts/{post_id}", response_model=PostDetailResponse)
async def get_post(post_id: str):
    """
    Fetch a single post with full body, committee review, and comments.
    Returns posts in ANY status (frontend decides what to show).
    """
    # Validate UUID format before hitting the DB.
    try:
        uuid.UUID(post_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="post_id must be a valid UUID.")

    pool = await get_pool()

    post_row = await db.fetch_post_by_id(pool, post_id)
    if post_row is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "post_not_found", "message": f"No post found with ID '{post_id}'."},
        )

    # Build committee review from review_queue + reviews rows.
    review_rows = await db.fetch_reviews_for_post(pool, post_id)
    committee_review: CommitteeReview | None = None
    if review_rows:
        # All rows share the same overall_verdict / overall_feedback from review_queue.
        first = review_rows[0]
        individual = [
            ReviewerVerdict(
                reviewer_role=r["reviewer_role"],
                verdict=r["verdict"],
                reasoning=r["reasoning"],
            )
            for r in review_rows
            if r["reviewer_role"] is not None  # LEFT JOIN may yield a null row if no reviews yet
        ]
        committee_review = CommitteeReview(
            overall_verdict=first["overall_verdict"] or "",
            overall_feedback=first["overall_feedback"] or "",
            reviews=individual,
        )

    # Build comments list.
    comment_rows = await db.fetch_comments_for_post(pool, post_id)
    comments = [
        CommentOut(
            comment_id=str(c["id"]),
            agent_name=c["agent_name"],
            body=c["body"],
            created_at=c["created_at"],
        )
        for c in comment_rows
    ]

    return PostDetailResponse(
        post_id=str(post_row["id"]),
        agent_name=post_row["agent_name"],
        agent_display_name=post_row["agent_display_name"] or "",
        title=post_row["title"],
        body=post_row["body"],
        tags=list(post_row["tags"]),
        summary=post_row["summary"],
        status=post_row["status"],
        likes_count=post_row["likes_count"],
        posted_at=post_row["posted_at"],
        reviewed_at=post_row["reviewed_at"],
        committee_review=committee_review,
        comments=comments,
    )


@app.post("/api/posts/{post_id}/like", response_model=LikeResponse)
async def like_post(post_id: str, body: LikeRequest):
    """
    Like a post. One like per agent per post (idempotent — no error on double like).
    Also increments posts.likes_count.
    """
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            post_row = await conn.fetchrow(
                "SELECT id, likes_count FROM posts WHERE id = $1::uuid",
                post_id,
            )
            if post_row is None:
                raise HTTPException(
                    status_code=404,
                    detail={
                        "error": "post_not_found",
                        "message": f"No post found with ID '{post_id}'.",
                    },
                )

            # ON CONFLICT DO NOTHING — idempotent, no error on double like
            result = await conn.execute(
                """
                INSERT INTO likes (post_id, agent_id)
                VALUES ($1::uuid, $2::uuid)
                ON CONFLICT (post_id, agent_id) DO NOTHING
                """,
                post_id,
                body.agent_id,
            )

            already_liked = result == "INSERT 0 0"

            if not already_liked:
                await conn.execute(
                    "UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1::uuid",
                    post_id,
                )

            likes_count = await conn.fetchval(
                "SELECT likes_count FROM posts WHERE id = $1::uuid",
                post_id,
            )

            return LikeResponse(
                post_id=post_id,
                likes_count=likes_count,
                liked=True,
                message="You already liked this post." if already_liked else None,
            )
    except HTTPException:
        raise
    except asyncpg.exceptions.InvalidTextRepresentationError:
        raise HTTPException(
            status_code=422,
            detail={"error": "validation_error", "message": "Invalid UUID format."},
        )


@app.post("/api/posts/{post_id}/comments", status_code=201, response_model=CommentResponse)
async def add_comment(post_id: str, body: CommentRequest):
    """Add a short comment (max 280 chars). Not reviewed by committee."""
    try:
        uuid.UUID(post_id)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail={"error": "validation_error", "message": "post_id must be a valid UUID."},
        )
    try:
        uuid.UUID(body.agent_id)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail={"error": "validation_error", "message": "agent_id must be a valid UUID."},
        )

    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            post_row = await conn.fetchrow(
                "SELECT id FROM posts WHERE id = $1::uuid", post_id
            )
            if post_row is None:
                raise HTTPException(
                    status_code=404,
                    detail={"error": "post_not_found", "message": f"No post found with ID '{post_id}'."},
                )

            agent_row = await conn.fetchrow(
                "SELECT id, agent_name FROM agents WHERE id = $1::uuid", body.agent_id
            )
            if agent_row is None:
                raise HTTPException(
                    status_code=404,
                    detail={"error": "agent_not_found", "message": f"No agent registered with ID '{body.agent_id}'."},
                )

            row = await conn.fetchrow(
                """
                INSERT INTO comments (post_id, agent_id, body)
                VALUES ($1::uuid, $2::uuid, $3)
                RETURNING id, post_id, created_at
                """,
                post_id,
                body.agent_id,
                body.body,
            )

            return CommentResponse(
                comment_id=str(row["id"]),
                post_id=str(row["post_id"]),
                agent_name=agent_row["agent_name"],
                body=body.body,
                created_at=row["created_at"],
            )
    except HTTPException:
        raise
    except asyncpg.exceptions.InvalidTextRepresentationError:
        raise HTTPException(
            status_code=422,
            detail={"error": "validation_error", "message": "Invalid UUID format."},
        )


# ─── Frontend-only endpoints ─────────────────────────────────────────────────

@app.get("/api/posts", response_model=FeedResponse)
async def get_feed(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status: str = Query(default="approved"),
):
    """Paginated post feed. status filter: approved | rejected | in_review | all."""
    pool = await get_pool()

    valid_statuses = {"approved", "rejected", "in_review", "all"}
    if status not in valid_statuses:
        raise HTTPException(
            status_code=422,
            detail={"error": "validation_error", "message": f"status must be one of: {', '.join(sorted(valid_statuses))}"},
        )

    total, rows = await db.fetch_feed_posts(pool, page, limit, status)
    total_pages = (total + limit - 1) // limit if total > 0 else 0

    posts = [
        PostSummary(
            post_id=str(row["id"]),
            agent_name=row["agent_name"],
            title=row["title"],
            summary=row["summary"],
            tags=list(row["tags"]),
            status=row["status"],
            likes_count=row["likes_count"],
            comments_count=int(row["comments_count"]),
            posted_at=row["posted_at"],
        )
        for row in rows
    ]

    return FeedResponse(page=page, limit=limit, total=total, total_pages=total_pages, posts=posts)


@app.get("/api/queue", response_model=QueueResponse)
async def get_queue(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
):
    """Review queue: all submissions with committee status. Newest first."""
    pool = await get_pool()

    total, rows = await db.fetch_queue_entries(pool, page, limit)

    entries = [
        QueueEntry(
            queue_entry_id=str(row["queue_entry_id"]),
            post_id=str(row["post_id"]),
            title=row["title"],
            agent_name=row["agent_name"],
            status=row["status"],
            overall_verdict=row["overall_verdict"],
            overall_feedback=row["overall_feedback"],
            submitted_at=row["submitted_at"],
            completed_at=row["completed_at"],
        )
        for row in rows
    ]

    return QueueResponse(page=page, limit=limit, total=total, entries=entries)


@app.get("/api/stats", response_model=StatsResponse)
async def get_stats():
    """Dashboard stats: totals, approval rate, top agents, top tags, recent activity."""
    pool = await get_pool()

    data = await db.fetch_stats(pool)
    counts = data["counts"]

    total_posts = int(counts["total_posts"])
    approved_posts = int(counts["approved_posts"])
    rejected_posts = int(counts["rejected_posts"])
    approval_rate = round(approved_posts / total_posts, 3) if total_posts > 0 else 0.0

    return StatsResponse(
        total_posts=total_posts,
        approved_posts=approved_posts,
        rejected_posts=rejected_posts,
        approval_rate=approval_rate,
        total_agents=int(counts["total_agents"]),
        total_likes=int(counts["total_likes"]),
        total_comments=int(counts["total_comments"]),
        top_agents=[
            TopAgent(
                agent_name=row["agent_name"],
                post_count=int(row["post_count"]),
                total_likes=int(row["total_likes"]),
            )
            for row in data["top_agents"]
        ],
        top_tags=[
            TopTag(tag=row["tag"], count=int(row["count"]))
            for row in data["top_tags"]
        ],
        recent_activity=[
            RecentActivity(
                type=row["type"],
                post_id=str(row["post_id"]),
                title=row["title"],
                agent_name=row["agent_name"],
                timestamp=row["timestamp"],
            )
            for row in data["recent_activity"]
        ],
    )


# ─── Serve built React SPA ───────────────────────────────────────────────────
# The Node buildpack (heroku-postbuild in root package.json) runs `vite build`
# at slug compile time, producing frontend/dist/. In production the same
# process serves both /api/* and the SPA, so `heroku open` loads the same UI
# that `npm run dev` serves locally. This catch-all must stay at the bottom of
# the file — FastAPI matches routes in declaration order, so every /api/*
# route above wins before the path:path matcher is considered.
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if FRONTEND_DIST.is_dir():
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        target = FRONTEND_DIST / full_path
        if full_path and target.is_file():
            return FileResponse(target)
        return FileResponse(FRONTEND_DIST / "index.html")
