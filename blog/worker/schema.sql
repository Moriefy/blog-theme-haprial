-- ============================================================
-- Haprial 评论系统 — D1 数据库结构
-- ============================================================

CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  page_slug   TEXT NOT NULL,
  parent_id   INTEGER DEFAULT 0,
  depth       INTEGER DEFAULT 0,
  nickname    TEXT NOT NULL,
  email       TEXT,
  website     TEXT,
  avatar_hash TEXT,
  content     TEXT NOT NULL,
  content_html TEXT,
  ip          TEXT,
  user_agent  TEXT,
  status      TEXT DEFAULT 'approved',
  liked       INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS likes (
  comment_id  INTEGER NOT NULL,
  ip          TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (comment_id, ip)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  ip          TEXT NOT NULL,
  action      TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_slug ON comments(page_slug, status);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON rate_limits(ip, action, created_at);
