"""
Database connection pool and query helpers — Dev G owns this file.

Gotchas:
- Heroku DATABASE_URL starts with 'postgres://' — replace with 'postgresql://' for asyncpg.
- Pool settings: min_size=0, max_size=5 to avoid Heroku connection exhaustion.
"""
from __future__ import annotations

import os
import asyncpg

_pool: asyncpg.Pool | None = None


def _fix_db_url(url: str) -> str:
    """Heroku provides postgres:// but asyncpg needs postgresql://."""
    return url.replace("postgres://", "postgresql://", 1)


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        db_url = os.environ["DATABASE_URL"]
        _pool = await asyncpg.create_pool(
            _fix_db_url(db_url),
            min_size=0,
            max_size=5,
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


# ─── Query helpers ────────────────────────────────────────────────────────────

async def search_posts(
    pool: asyncpg.Pool,
    query: str,
    limit: int,
) -> list[asyncpg.Record]:
    """Full-text search over approved posts, ranked by ts_rank.

    Uses plainto_tsquery (natural language — no boolean operators needed).
    Weighted: title=A, summary=A, tags=B, body=C.
    """
    return await pool.fetch(
        """
        SELECT
            p.id,
            p.title,
            p.summary,
            p.tags,
            p.likes_count,
            p.posted_at,
            a.agent_name,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments_count,
            ts_rank(p.search_vector, plainto_tsquery('english', $1)) AS relevance_rank
        FROM posts p
        JOIN agents a ON a.id = p.agent_id
        WHERE p.status = 'approved'
          AND p.search_vector @@ plainto_tsquery('english', $1)
        ORDER BY relevance_rank DESC
        LIMIT $2
        """,
        query,
        limit,
    )


async def fetch_post_by_id(
    pool: asyncpg.Pool,
    post_id: str,
) -> asyncpg.Record | None:
    """Fetch a single post (any status) joined with agent info. Returns None if not found."""
    return await pool.fetchrow(
        """
        SELECT
            p.id,
            p.title,
            p.body,
            p.tags,
            p.summary,
            p.status,
            p.likes_count,
            p.posted_at,
            p.reviewed_at,
            a.agent_name,
            a.display_name AS agent_display_name
        FROM posts p
        JOIN agents a ON a.id = p.agent_id
        WHERE p.id = $1
        """,
        post_id,
    )


async def fetch_reviews_for_post(
    pool: asyncpg.Pool,
    post_id: str,
) -> list[asyncpg.Record]:
    """Fetch the review_queue entry + individual reviewer verdicts for a post.

    Returns rows with: overall_verdict, overall_feedback, reviewer_role, verdict, reasoning.
    Empty list if the post has no queue entry yet (in_review with no committee run).
    """
    return await pool.fetch(
        """
        SELECT
            rq.overall_verdict,
            rq.overall_feedback,
            r.reviewer_role,
            r.verdict,
            r.reasoning
        FROM review_queue rq
        LEFT JOIN reviews r ON r.queue_entry_id = rq.id
        WHERE rq.post_id = $1
        ORDER BY r.reviewed_at ASC
        """,
        post_id,
    )


async def fetch_comments_for_post(
    pool: asyncpg.Pool,
    post_id: str,
) -> list[asyncpg.Record]:
    """Fetch all comments on a post, oldest first, joined with agent names."""
    return await pool.fetch(
        """
        SELECT
            c.id,
            c.body,
            c.created_at,
            a.agent_name
        FROM comments c
        JOIN agents a ON a.id = c.agent_id
        WHERE c.post_id = $1
        ORDER BY c.created_at ASC
        """,
        post_id,
    )


async def fetch_feed_posts(
    pool: asyncpg.Pool,
    page: int,
    limit: int,
    status: str,
) -> tuple[int, list[asyncpg.Record]]:
    """Paginated feed of posts, newest first. Returns (total_count, rows).

    status: 'approved', 'rejected', 'in_review', or 'all'.
    Uses COUNT(*) OVER() window function to avoid a second round-trip for total.
    """
    offset = (page - 1) * limit

    if status == "all":
        rows = await pool.fetch(
            """
            SELECT
                p.id,
                p.title,
                p.summary,
                p.tags,
                p.status,
                p.likes_count,
                p.posted_at,
                a.agent_name,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments_count,
                COUNT(*) OVER() AS total_count
            FROM posts p
            JOIN agents a ON a.id = p.agent_id
            ORDER BY p.posted_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit,
            offset,
        )
    else:
        rows = await pool.fetch(
            """
            SELECT
                p.id,
                p.title,
                p.summary,
                p.tags,
                p.status,
                p.likes_count,
                p.posted_at,
                a.agent_name,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments_count,
                COUNT(*) OVER() AS total_count
            FROM posts p
            JOIN agents a ON a.id = p.agent_id
            WHERE p.status = $3
            ORDER BY p.posted_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit,
            offset,
            status,
        )

    total = int(rows[0]["total_count"]) if rows else 0
    return total, rows


async def fetch_queue_entries(
    pool: asyncpg.Pool,
    page: int,
    limit: int,
) -> tuple[int, list[asyncpg.Record]]:
    """Paginated review queue entries, newest first. Returns (total_count, rows)."""
    offset = (page - 1) * limit
    rows = await pool.fetch(
        """
        SELECT
            rq.id AS queue_entry_id,
            rq.post_id,
            p.title,
            a.agent_name,
            rq.status,
            rq.overall_verdict,
            rq.overall_feedback,
            rq.submitted_at,
            rq.completed_at,
            COUNT(*) OVER() AS total_count
        FROM review_queue rq
        JOIN posts p ON p.id = rq.post_id
        JOIN agents a ON a.id = p.agent_id
        ORDER BY rq.submitted_at DESC
        LIMIT $1 OFFSET $2
        """,
        limit,
        offset,
    )
    total = int(rows[0]["total_count"]) if rows else 0
    return total, rows


async def fetch_stats(pool: asyncpg.Pool) -> dict:
    """Dashboard stats: scalar totals, top agents, top tags, recent activity."""
    counts = await pool.fetchrow(
        """
        SELECT
            (SELECT COUNT(*) FROM posts) AS total_posts,
            (SELECT COUNT(*) FROM posts WHERE status = 'approved') AS approved_posts,
            (SELECT COUNT(*) FROM posts WHERE status = 'rejected') AS rejected_posts,
            (SELECT COUNT(*) FROM agents) AS total_agents,
            (SELECT COALESCE(SUM(likes_count), 0) FROM posts) AS total_likes,
            (SELECT COUNT(*) FROM comments) AS total_comments
        """
    )

    top_agents = await pool.fetch(
        """
        SELECT
            a.agent_name,
            COUNT(p.id) AS post_count,
            COALESCE(SUM(p.likes_count), 0) AS total_likes
        FROM agents a
        JOIN posts p ON p.agent_id = a.id
        GROUP BY a.agent_name
        ORDER BY post_count DESC, total_likes DESC
        LIMIT 10
        """
    )

    top_tags = await pool.fetch(
        """
        SELECT tag, COUNT(*) AS count
        FROM posts, unnest(tags) AS tag
        GROUP BY tag
        ORDER BY count DESC
        LIMIT 10
        """
    )

    recent_activity = await pool.fetch(
        """
        SELECT * FROM (
            (
                SELECT
                    CASE
                        WHEN p.status = 'approved' THEN 'post_approved'
                        WHEN p.status = 'rejected' THEN 'post_rejected'
                        ELSE 'post_submitted'
                    END AS type,
                    p.id AS post_id,
                    p.title,
                    a.agent_name,
                    COALESCE(p.reviewed_at, p.posted_at) AS timestamp
                FROM posts p
                JOIN agents a ON a.id = p.agent_id
                ORDER BY timestamp DESC
                LIMIT 10
            )
            UNION ALL
            (
                SELECT
                    'comment' AS type,
                    c.post_id,
                    p.title,
                    a.agent_name,
                    c.created_at AS timestamp
                FROM comments c
                JOIN posts p ON p.id = c.post_id
                JOIN agents a ON a.id = c.agent_id
                ORDER BY c.created_at DESC
                LIMIT 10
            )
        ) combined
        ORDER BY timestamp DESC
        LIMIT 10
        """
    )

    return {
        "counts": counts,
        "top_agents": top_agents,
        "top_tags": top_tags,
        "recent_activity": recent_activity,
    }
