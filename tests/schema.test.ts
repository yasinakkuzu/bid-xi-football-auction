import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { ROOM_SCHEMA } from '../db/schema.ts';

const MIGRATIONS = [
  'drizzle/0001_rooms.sql',
  'drizzle/0002_request_limits.sql',
  'drizzle/0003_leaderboard.sql',
  'drizzle/0004_reliability_leaderboard.sql',
];
const TABLES = [
  'rooms',
  'room_members',
  'request_limits',
  'leaderboard_entries',
  'leaderboard_deletions',
  'room_actions',
];

type Row = Record<string, unknown>;

const columns = (database: DatabaseSync, table: string) =>
  (database.prepare(`PRAGMA table_info(${table})`).all() as Row[]).map((row) => String(row.name)).sort();

const indexes = (database: DatabaseSync) =>
  (database.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all() as Row[])
    .map((row) => String(row.name))
    .sort();

function migratedDatabase() {
  const database = new DatabaseSync(':memory:');
  for (const file of MIGRATIONS) database.exec(readFileSync(file, 'utf8'));
  return database;
}

test('the runtime schema and the D1 migrations describe the same database', () => {
  const migrated = migratedDatabase();
  const runtime = new DatabaseSync(':memory:');
  for (const statement of ROOM_SCHEMA) runtime.exec(statement);
  for (const table of TABLES) {
    assert.deepEqual(columns(runtime, table), columns(migrated, table), `${table} columns drifted`);
  }
  assert.deepEqual(indexes(runtime), indexes(migrated), 'indexes drifted');
  migrated.close();
  runtime.close();
});

test('the runtime schema is idempotent, so a cold isolate can always re-run it', () => {
  const database = new DatabaseSync(':memory:');
  for (const statement of ROOM_SCHEMA) database.exec(statement);
  for (const statement of ROOM_SCHEMA) database.exec(statement);
  assert.deepEqual(columns(database, 'leaderboard_entries').includes('standard_eligible'), true);
  database.close();
});

test('the rate-limit upsert keeps its window semantics on the real schema', () => {
  const database = migratedDatabase();
  const upsert = database.prepare(
    `INSERT INTO request_limits(limit_key,window_start,request_count) VALUES(?,?,1)
     ON CONFLICT(limit_key) DO UPDATE SET
       window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END,
       request_count=CASE WHEN window_start<? THEN 1 ELSE request_count+1 END
     RETURNING request_count`,
  );
  assert.equal(Number((upsert.get('room:1', 1_000, 0, 0) as Row).request_count), 1);
  assert.equal(Number((upsert.get('room:1', 1_500, 0, 0) as Row).request_count), 2, 'same window increments');
  assert.equal(Number((upsert.get('room:1', 90_000, 60_000, 60_000) as Row).request_count), 1, 'new window resets');
  database.close();
});

test('leaderboard retention tombstones rows before deleting them', () => {
  const database = migratedDatabase();
  const insert = database.prepare(
    'INSERT INTO leaderboard_entries(id,room_code,manager_name,score,played_at,formation,squad_json) VALUES(?,?,?,?,?,?,?)',
  );
  insert.run('ROOM01:1:0', 'ROOM01', 'Eski', 90, 1_000, '4-2-3-1', '{}');
  insert.run('ROOM01:1:1', 'ROOM01', 'Yeni', 80, 9_000_000_000, '4-2-3-1', '{}');

  const cutoff = 5_000_000_000;
  const stale = (
    database.prepare('SELECT id FROM leaderboard_entries WHERE played_at < ? LIMIT ?').all(cutoff, 50) as Row[]
  ).map((row) => String(row.id));
  assert.deepEqual(stale, ['ROOM01:1:0']);

  const tombstone = database.prepare('INSERT OR REPLACE INTO leaderboard_deletions(entry_id,deleted_at) VALUES(?,?)');
  for (const id of stale) tombstone.run(id, cutoff);
  database.prepare(`DELETE FROM leaderboard_entries WHERE id IN (${stale.map(() => '?').join(',')})`).run(...stale);

  assert.equal(Number((database.prepare('SELECT COUNT(*) count FROM leaderboard_entries').get() as Row).count), 1);
  assert.equal(Number((database.prepare('SELECT COUNT(*) count FROM leaderboard_deletions').get() as Row).count), 1);
  database.close();
});

test('room action idempotency keys are unique per actor and request', () => {
  const database = migratedDatabase();
  const claim = database.prepare(
    'INSERT OR IGNORE INTO room_actions(room_code,actor_hash,request_id,result_json,created_at) VALUES(?,?,?,?,?)',
  );
  assert.equal(Number(claim.run('ROOM01', 'actor', 'req-1', '__PENDING__:x', 1).changes), 1);
  assert.equal(Number(claim.run('ROOM01', 'actor', 'req-1', '__PENDING__:y', 2).changes), 0, 'duplicate claim ignored');
  assert.equal(Number(claim.run('ROOM01', 'other', 'req-1', '__PENDING__:x', 3).changes), 1);
  database.close();
});
