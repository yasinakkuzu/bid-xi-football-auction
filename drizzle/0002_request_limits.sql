CREATE TABLE IF NOT EXISTS request_limits (
  limit_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_request_limits_window ON request_limits(window_start);
