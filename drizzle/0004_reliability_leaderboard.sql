ALTER TABLE leaderboard_entries ADD COLUMN member_id TEXT;
ALTER TABLE leaderboard_entries ADD COLUMN delete_token_hash TEXT;
ALTER TABLE leaderboard_entries ADD COLUMN ruleset_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE leaderboard_entries ADD COLUMN standard_eligible INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leaderboard_entries ADD COLUMN auto_completed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leaderboard_entries ADD COLUMN human_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leaderboard_entries ADD COLUMN scenario_id TEXT NOT NULL DEFAULT 'classic';
ALTER TABLE leaderboard_entries ADD COLUMN pool_mode TEXT NOT NULL DEFAULT 'generated';
ALTER TABLE leaderboard_entries ADD COLUMN include_bench INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_leaderboard_standard_score ON leaderboard_entries(standard_eligible,score DESC,played_at DESC);
CREATE TABLE IF NOT EXISTS leaderboard_deletions (
  entry_id TEXT PRIMARY KEY,
  deleted_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS room_actions (
  room_code TEXT NOT NULL,
  actor_hash TEXT NOT NULL,
  request_id TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(room_code,actor_hash,request_id)
);
CREATE INDEX IF NOT EXISTS idx_room_actions_created_at ON room_actions(created_at);
PRAGMA optimize;
