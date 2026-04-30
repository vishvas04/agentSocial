"""
Pydantic request/response models — Dev G owns this file.
These shapes are LOCKED from the API contracts in InitialPlan.md.
Do not change field names without a group discussion.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ─── Agents ──────────────────────────────────────────────────────────────────

class AgentRegisterRequest(BaseModel):
    agent_name: str = Field(..., min_length=3, max_length=40,
                            pattern=r'^[a-z][a-z0-9\-]*[a-z0-9]$')
    display_name: str = Field(default="", max_length=100)


class AgentRegisterResponse(BaseModel):
    agent_id: str
    agent_name: str
    display_name: str
    registered_at: datetime


# ─── Committee / Reviews ─────────────────────────────────────────────────────

class ReviewerVerdict(BaseModel):
    reviewer_role: str   # 'novelty_checker' | 'technical_reviewer' | 'duplicate_detector'
    verdict: str         # 'approve' | 'reject'
    reasoning: str


class CommitteeReview(BaseModel):
    overall_verdict: str          # 'approved' | 'rejected'
    overall_feedback: str
    reviews: list[ReviewerVerdict]


# ─── Posts ───────────────────────────────────────────────────────────────────

class PostSubmitRequest(BaseModel):
    agent_id: str
    title: str = Field(..., min_length=10, max_length=120)
    body: str = Field(..., min_length=50)
    tags: list[str] = Field(default_factory=list, max_length=10)


class PostSubmitResponse(BaseModel):
    post_id: str
    status: str
    summary: str
    queue_entry_id: str
    committee_review: CommitteeReview


class PostSummary(BaseModel):
    post_id: str
    agent_name: str
    title: str
    summary: Optional[str]
    tags: list[str]
    status: str
    likes_count: int
    comments_count: int
    posted_at: datetime


class PostSearchResult(BaseModel):
    post_id: str
    title: str
    summary: Optional[str]
    tags: list[str]
    agent_name: str
    likes_count: int
    comments_count: int
    posted_at: datetime
    relevance_rank: float


class PostSearchResponse(BaseModel):
    query: str
    total: int
    results: list[PostSearchResult]


class CommentOut(BaseModel):
    comment_id: str
    agent_name: str
    body: str
    created_at: datetime


class PostDetailResponse(BaseModel):
    post_id: str
    agent_name: str
    agent_display_name: str
    title: str
    body: str
    tags: list[str]
    summary: Optional[str]
    status: str
    likes_count: int
    posted_at: datetime
    reviewed_at: Optional[datetime]
    committee_review: Optional[CommitteeReview]
    comments: list[CommentOut]


class FeedResponse(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int
    posts: list[PostSummary]


# ─── Likes ───────────────────────────────────────────────────────────────────

class LikeRequest(BaseModel):
    agent_id: str


class LikeResponse(BaseModel):
    post_id: str
    likes_count: int
    liked: bool
    message: Optional[str] = None


# ─── Comments ────────────────────────────────────────────────────────────────

class CommentRequest(BaseModel):
    agent_id: str
    body: str = Field(..., min_length=1, max_length=280)


class CommentResponse(BaseModel):
    comment_id: str
    post_id: str
    agent_name: str
    body: str
    created_at: datetime


# ─── Queue ───────────────────────────────────────────────────────────────────

class QueueEntry(BaseModel):
    queue_entry_id: str
    post_id: str
    title: str
    agent_name: str
    status: str
    overall_verdict: Optional[str]
    overall_feedback: Optional[str]
    submitted_at: datetime
    completed_at: Optional[datetime]


class QueueResponse(BaseModel):
    page: int
    limit: int
    total: int
    entries: list[QueueEntry]


# ─── Stats ───────────────────────────────────────────────────────────────────

class TopAgent(BaseModel):
    agent_name: str
    post_count: int
    total_likes: int


class TopTag(BaseModel):
    tag: str
    count: int


class RecentActivity(BaseModel):
    type: str
    post_id: str
    title: str
    agent_name: str
    timestamp: datetime


class StatsResponse(BaseModel):
    total_posts: int
    approved_posts: int
    rejected_posts: int
    approval_rate: float
    total_agents: int
    total_likes: int
    total_comments: int
    top_agents: list[TopAgent]
    top_tags: list[TopTag]
    recent_activity: list[RecentActivity]
