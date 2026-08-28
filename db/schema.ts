export const ROOM_SCHEMA=[
`CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, host_token_hash TEXT NOT NULL, state_json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS room_members (room_code TEXT NOT NULL, member_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0, last_seen INTEGER NOT NULL, PRIMARY KEY(room_code,member_id))`,
`CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms(expires_at)`,
`CREATE INDEX IF NOT EXISTS idx_room_members_room_code ON room_members(room_code)`,
`CREATE TABLE IF NOT EXISTS request_limits (limit_key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, request_count INTEGER NOT NULL)`,
`CREATE INDEX IF NOT EXISTS idx_request_limits_window ON request_limits(window_start)`,
`CREATE TABLE IF NOT EXISTS leaderboard_entries (id TEXT PRIMARY KEY, room_code TEXT NOT NULL, member_id TEXT, delete_token_hash TEXT, manager_name TEXT NOT NULL, score REAL NOT NULL, played_at INTEGER NOT NULL, formation TEXT NOT NULL, squad_json TEXT NOT NULL, coach_json TEXT, ruleset_json TEXT NOT NULL DEFAULT '{}', standard_eligible INTEGER NOT NULL DEFAULT 0, auto_completed INTEGER NOT NULL DEFAULT 0, human_count INTEGER NOT NULL DEFAULT 0, scenario_id TEXT NOT NULL DEFAULT 'classic', pool_mode TEXT NOT NULL DEFAULT 'generated', include_bench INTEGER NOT NULL DEFAULT 0)`,
`CREATE INDEX IF NOT EXISTS idx_leaderboard_score_played_at ON leaderboard_entries(score DESC,played_at DESC)`,
`CREATE INDEX IF NOT EXISTS idx_leaderboard_standard_score ON leaderboard_entries(standard_eligible,score DESC,played_at DESC)`,
`CREATE TABLE IF NOT EXISTS leaderboard_deletions (entry_id TEXT PRIMARY KEY, deleted_at INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS room_actions (room_code TEXT NOT NULL, actor_hash TEXT NOT NULL, request_id TEXT NOT NULL, result_json TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(room_code,actor_hash,request_id))`,
`CREATE INDEX IF NOT EXISTS idx_room_actions_created_at ON room_actions(created_at)`,
`PRAGMA optimize`
];

