CREATE TABLE linkedin_posts_runs (
    id TEXT PRIMARY KEY NOT NULL,
    profile_url TEXT NOT NULL,
    session_ids TEXT NOT NULL,
    post_count INTEGER,
    start_from INTEGER NOT NULL DEFAULT 1,
    post_matcher TEXT,
    headless INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    initial_top_post_id TEXT,
    initial_post_ids TEXT,
    collected_count INTEGER NOT NULL DEFAULT 0,
    matched_count INTEGER NOT NULL DEFAULT 0,
    current_session_index INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
);

CREATE TABLE linkedin_posts_runs_item (
    id TEXT PRIMARY KEY NOT NULL,
    run_id TEXT NOT NULL REFERENCES linkedin_posts_runs(id) ON DELETE CASCADE,
    post_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    text TEXT,
    posted_at TEXT,
    author_name TEXT,
    author_url TEXT,
    post_url TEXT,
    like_count INTEGER,
    comment_count INTEGER,
    repost_count INTEGER,
    impression_count INTEGER,
    media_urls TEXT,
    raw_data TEXT,
    matched INTEGER NOT NULL DEFAULT 1,
    session_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (run_id, post_id)
);

CREATE INDEX idx_linkedin_posts_runs_status ON linkedin_posts_runs (status);
CREATE INDEX idx_linkedin_posts_runs_created ON linkedin_posts_runs (created_at DESC);
CREATE INDEX idx_linkedin_posts_runs_item_run ON linkedin_posts_runs_item (run_id);
CREATE INDEX idx_linkedin_posts_runs_item_run_ordinal ON linkedin_posts_runs_item (run_id, ordinal);
