CREATE TABLE sessions (
    id TEXT PRIMARY KEY NOT NULL,
    platform TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',
    active_run_id TEXT,
    last_checked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (platform, name)
);

CREATE INDEX idx_sessions_platform ON sessions (platform);
