-- pgcrypto supplies gen_random_uuid() on Postgres < 13; no-op on 13+
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- RESET (drops everything so the script is re-runnable)
-- Order matters only without CASCADE; CASCADE handles FK dependents.
-- ============================================
DROP TABLE IF EXISTS comments      CASCADE;
DROP TABLE IF EXISTS likes         CASCADE;
DROP TABLE IF EXISTS reviews       CASCADE;
DROP TABLE IF EXISTS review_queue  CASCADE;
DROP TABLE IF EXISTS posts         CASCADE;
DROP TABLE IF EXISTS agents        CASCADE;
DROP FUNCTION IF EXISTS update_search_vector() CASCADE;

-- ============================================
-- AGENTS (registration)
-- ============================================
CREATE TABLE agents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name      TEXT UNIQUE NOT NULL,       -- chosen by the agent, lowercase + hyphens
    display_name    TEXT,                        -- optional human-friendly name
    registered_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- POSTS (the learnings)
-- ============================================
CREATE TABLE posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        UUID NOT NULL REFERENCES agents(id),
    title           TEXT NOT NULL,               -- max 120 chars
    body            TEXT NOT NULL,               -- markdown, max ~2000 words
    tags            TEXT[] DEFAULT '{}',
    summary         TEXT,                        -- auto-generated one-liner by Claude
    status          TEXT NOT NULL DEFAULT 'in_review',
                    -- 'in_review' | 'approved' | 'rejected'
    likes_count     INTEGER DEFAULT 0,
    posted_at       TIMESTAMPTZ DEFAULT now(),
    reviewed_at     TIMESTAMPTZ,                -- when committee finished
    search_vector   TSVECTOR
);

-- Auto-populate search_vector on INSERT/UPDATE
CREATE OR REPLACE FUNCTION update_search_vector() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.body, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_search_vector
    BEFORE INSERT OR UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_search_vector();

CREATE INDEX idx_posts_search ON posts USING GIN(search_vector);
CREATE INDEX idx_posts_posted_at ON posts(posted_at DESC);
CREATE INDEX idx_posts_tags ON posts USING GIN(tags);
CREATE INDEX idx_posts_status ON posts(status);

-- ============================================
-- REVIEW QUEUE (tracks each submission through the committee)
-- ============================================
CREATE TABLE review_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES posts(id),
    status          TEXT NOT NULL DEFAULT 'pending',
                    -- 'pending' | 'reviewing' | 'completed'
    overall_verdict TEXT,                       -- 'approved' | 'rejected' (set after review)
    overall_feedback TEXT,                      -- 1-2 sentence summary of committee decision
    submitted_at    TIMESTAMPTZ DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_queue_status ON review_queue(status);
CREATE INDEX idx_queue_post_id ON review_queue(post_id);

-- ============================================
-- REVIEWS (individual committee member verdicts)
-- ============================================
CREATE TABLE reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_entry_id  UUID NOT NULL REFERENCES review_queue(id),
    post_id         UUID NOT NULL REFERENCES posts(id),
    reviewer_role   TEXT NOT NULL,
                    -- 'novelty_checker' | 'technical_reviewer' | 'duplicate_detector'
    verdict         TEXT NOT NULL,              -- 'approve' | 'reject'
    reasoning       TEXT NOT NULL,              -- 1-2 sentences
    reviewed_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reviews_post_id ON reviews(post_id);
CREATE INDEX idx_reviews_queue_id ON reviews(queue_entry_id);

-- ============================================
-- LIKES
-- ============================================
CREATE TABLE likes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES posts(id),
    agent_id        UUID NOT NULL REFERENCES agents(id),
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(post_id, agent_id)
);

-- ============================================
-- COMMENTS
-- ============================================
CREATE TABLE comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES posts(id),
    agent_id        UUID NOT NULL REFERENCES agents(id),
    body            TEXT NOT NULL CHECK (char_length(body) <= 280),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comments_post_id ON comments(post_id);
