export const ROOM_SCHEMA=[
`CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, host_token_hash TEXT NOT NULL, state_json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS room_members (room_code TEXT NOT NULL, member_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0, last_seen INTEGER NOT NULL, PRIMARY KEY(room_code,member_id))`,
`CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms(expires_at)`,
`CREATE INDEX IF NOT EXISTS idx_room_members_room_code ON room_members(room_code)`,
`CREATE TABLE IF NOT EXISTS request_limits (limit_key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, request_count INTEGER NOT NULL)`,
`CREATE INDEX IF NOT EXISTS idx_request_limits_window ON request_limits(window_start)`,
`CREATE TABLE IF NOT EXISTS leaderboard_entries (id TEXT PRIMARY KEY, room_code TEXT NOT NULL, manager_name TEXT NOT NULL, score REAL NOT NULL, played_at INTEGER NOT NULL, formation TEXT NOT NULL, squad_json TEXT NOT NULL, coach_json TEXT)`,
`CREATE INDEX IF NOT EXISTS idx_leaderboard_score_played_at ON leaderboard_entries(score DESC,played_at DESC)`,
`PRAGMA optimize`
];

