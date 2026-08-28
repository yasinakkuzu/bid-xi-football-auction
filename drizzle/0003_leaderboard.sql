CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  manager_name TEXT NOT NULL,
  score REAL NOT NULL,
  played_at INTEGER NOT NULL,
  formation TEXT NOT NULL,
  squad_json TEXT NOT NULL,
  coach_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_score_played_at
ON leaderboard_entries(score DESC, played_at DESC);
PRAGMA optimize;
