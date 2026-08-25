CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  host_token_hash TEXT NOT NULL,
  state_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS room_members (
  room_code TEXT NOT NULL,
  member_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  last_seen INTEGER NOT NULL,
  PRIMARY KEY(room_code, member_id)
);
CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms(expires_at);
CREATE INDEX IF NOT EXISTS idx_room_members_room_code ON room_members(room_code);
