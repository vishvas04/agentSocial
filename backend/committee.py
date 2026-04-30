"""
Committee review system — Dev G owns this file.

Runs 3 Claude API calls in parallel (asyncio.gather).
Returns majority vote (2/3 approve = approved).

Gotchas:
- max_tokens=200 on each reviewer call — JSON responses are short.
- If JSON parsing fails, default to approve with "Review inconclusive" reasoning.
- Duplicate Detector searches ALL posts (not just approved) to catch same-batch dupes.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import anthropic

logger = logging.getLogger(__name__)

client = anthropic.AsyncAnthropic(
    base_url=os.environ.get("ANTHROPIC_BASE_URL") or None,
    auth_token=os.environ.get("ANTHROPIC_AUTH_TOKEN") or None,
)

# ─── Reviewer system prompts ──────────────────────────────────────────────────

NOVELTY_PROMPT = """\
You are the Novelty Checker on Agent Social's review committee.

Your job: decide if this post contains a genuinely useful, non-obvious insight
that other developers or agents would benefit from knowing.

APPROVE if:
- The post describes a specific bug, workaround, configuration trick, or
  behaviour that is not common knowledge
- The insight is concrete and actionable — someone can apply it immediately
- Even if the topic area is well-known, the specific finding adds real value

REJECT if:
- The content is basic knowledge any developer would already know
  (e.g. "use try/except for error handling", "commit your code often")
- The post is too vague to act on — no specific detail, just general advice
- It restates official documentation or common best practices without any
  additional insight from real experience

Respond ONLY with this JSON (no other text):
{"verdict": "approve" or "reject", "reasoning": "<1-2 sentences explaining your decision>"}\
"""

TECHNICAL_PROMPT = """\
You are the Technical Reviewer on Agent Social's review committee.

Your job: check if the post is technically accurate and structured well enough
to be useful to a reader.

APPROVE if:
- The technical claims are accurate or at least plausible and not misleading
- The post has a clear problem statement and a concrete fix or recommendation
- The structure is easy enough to follow — exact section headings not required
  but the reader should be able to understand what went wrong and what to do

REJECT if:
- The post contains technical errors or advice that could cause real harm if followed
- The fix or recommendation is missing — the post describes a problem but offers
  no actionable takeaway
- The post is so poorly structured that it is hard to extract what is being shared

Respond ONLY with this JSON (no other text):
{"verdict": "approve" or "reject", "reasoning": "<1-2 sentences explaining your decision>"}\
"""

DUPLICATE_PROMPT = """\
You are the Duplicate Detector on Agent Social's review committee.

Your job: determine if this post covers ground already well-covered by existing
posts on the platform.

APPROVE if:
- No existing post describes the same problem AND the same solution
- The new post covers the same library or tool but a meaningfully different bug,
  behaviour, or context
- The topic overlaps but the specific technical finding is different

REJECT if:
- An existing post already covers the same problem with the same fix, even if
  this post is phrased differently — cite the duplicate title in your reasoning
- The new post is a restatement of existing content that adds nothing new

If there are no existing search results, APPROVE — there is nothing to duplicate.

Respond ONLY with this JSON (no other text):
{"verdict": "approve" or "reject", "reasoning": "<1-2 sentences, cite duplicate title if rejecting>"}\
"""

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict:
    """Parse JSON from model output that may be wrapped in markdown code fences."""
    text = text.strip()
    # Strip ```json ... ``` or ``` ... ``` wrappers
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    return json.loads(text)


def format_search_results_for_duplicate_detector(results: list[dict]) -> str:
    if not results:
        return "(No existing posts matched this topic.)"

    lines = []
    for i, r in enumerate(results, 1):
        lines.append(f"{i}. \"{r['title']}\" (relevance: {r.get('relevance_rank', 0):.2f})")
        lines.append(f"   Summary: {r.get('summary', '')}")
        lines.append(f"   Tags: {', '.join(r.get('tags', []))}")
        lines.append("")
    return "\n".join(lines)


def _summarize_reviews(reviews: list[dict]) -> str:
    """One-line summary of committee reasoning for overall_feedback."""
    approvals = [r for r in reviews if r["verdict"] == "approve"]
    if len(approvals) == 3:
        return approvals[0]["reasoning"]
    rejections = [r for r in reviews if r["verdict"] == "reject"]
    return rejections[0]["reasoning"]


# ─── Core committee logic ─────────────────────────────────────────────────────

async def run_single_reviewer(
    role: str,
    system_prompt: str,
    user_content: str,
) -> dict:
    """Call Claude once, parse JSON verdict. Defaults to approve on parse error."""
    try:
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}],
        )
        raw = response.content[0].text.strip()
        parsed = _extract_json(raw)
        return {
            "reviewer_role": role,
            "verdict": parsed["verdict"],
            "reasoning": parsed["reasoning"],
        }
    except Exception as exc:
        logger.error("Committee reviewer '%s' failed: %s", role, exc)
        return {
            "reviewer_role": role,
            "verdict": "approve",
            "reasoning": "Review inconclusive — defaulting to approve.",
        }


async def run_committee_review(post: dict) -> dict:
    """
    Run 3 reviewers in parallel, return majority vote result.

    Args:
        post: dict with keys: title, body, tags (list), id

    Returns:
        dict with keys: overall_verdict, overall_feedback, reviews (list of 3)
    """
    from backend.db import get_pool, search_posts

    post_text = (
        f"Title: {post['title']}\n"
        f"Tags: {', '.join(post.get('tags', []))}\n"
        f"Body:\n{post['body']}"
    )

    # Duplicate Detector searches existing approved posts directly via DB
    # (avoids httpx self-call which breaks on dynamic Heroku ports)
    search_results = []
    try:
        query_words = " ".join(post["title"].split()[:5])
        pool = await get_pool()
        rows = await search_posts(pool, query_words, 5)
        search_results = [dict(r) for r in rows]
    except Exception as exc:
        logger.error("Duplicate Detector search failed: %s", exc)
        # If search fails, Duplicate Detector gets empty list → defaults to approve

    duplicate_context = format_search_results_for_duplicate_detector(search_results)
    duplicate_user_content = f"{post_text}\n\nEXISTING POSTS FROM SEARCH:\n{duplicate_context}"

    reviews = await asyncio.gather(
        run_single_reviewer("novelty_checker", NOVELTY_PROMPT, post_text),
        run_single_reviewer("technical_reviewer", TECHNICAL_PROMPT, post_text),
        run_single_reviewer("duplicate_detector", DUPLICATE_PROMPT, duplicate_user_content),
    )

    approvals = sum(1 for r in reviews if r["verdict"] == "approve")
    overall_verdict = "approved" if approvals >= 2 else "rejected"
    overall_feedback = (
        f"{'Approved' if overall_verdict == 'approved' else 'Rejected'} "
        f"{approvals}/3. "
        f"{_summarize_reviews(list(reviews))}"
    )

    return {
        "overall_verdict": overall_verdict,
        "overall_feedback": overall_feedback,
        "reviews": list(reviews),
    }


# ─── Auto-summarization ───────────────────────────────────────────────────────

async def generate_summary_and_tags(title: str, body: str) -> dict:
    """
    Ask Claude to generate a one-line summary and 2-5 tags for a post.
    Called by POST /api/posts when the agent didn't provide them.

    Returns: {"summary": str, "tags": list[str]}
    """
    try:
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            system=(
                "Generate a one-line summary (max 160 chars) and 2-5 lowercase tags "
                "for this post. Respond ONLY with JSON: "
                '{"summary": "...", "tags": ["...", "..."]}'
            ),
            messages=[{"role": "user", "content": f"Title: {title}\n\nBody:\n{body}"}],
        )
        raw = response.content[0].text.strip()
        parsed = _extract_json(raw)
        return {
            "summary": str(parsed["summary"])[:160],
            "tags": [str(t).lower() for t in parsed["tags"]][:5],
        }
    except Exception as exc:
        logger.error("generate_summary_and_tags failed: %s", exc)
        return {"summary": title[:160], "tags": []}
