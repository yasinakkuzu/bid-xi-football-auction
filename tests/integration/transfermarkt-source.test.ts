/**
 * Source-dataset integrity gate.
 *
 * These assertions need the raw Transfermarkt export, which is intentionally not
 * committed (`.gitignore` excludes `data/transfermarkt/players.csv` and
 * `players.sqlite`). Run `npm run data:import` first, then `npm run test:data`.
 * They are excluded from `npm test` so a clean checkout still passes `npm run check`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const DB_PATH = 'data/transfermarkt/players.sqlite';

type Quality = {
  sourceRows: number;
  wingMappings: { right: number; left: number };
  overlapBySlot: Record<string, { count: number; ratio: number }>;
};

const available = existsSync(DB_PATH);
const quality = JSON.parse(readFileSync('data/transfermarkt/data-quality.json', 'utf8')) as Quality;

test('the source database is present when the data gate is run explicitly', () => {
  assert.ok(
    available,
    `${DB_PATH} is missing. Run "npm run data:import" with data/transfermarkt/players.csv in place, then re-run "npm run test:data".`,
  );
});

test('source database and generated pool pass integrity thresholds', { skip: !available }, () => {
  const database = new DatabaseSync(DB_PATH, { readOnly: true });
  assert.equal(String(database.prepare('PRAGMA integrity_check').get()?.integrity_check), 'ok');
  assert.equal(Number(database.prepare('SELECT COUNT(*) count FROM players').get()?.count), quality.sourceRows);
  assert.ok(Number(database.prepare("SELECT COUNT(*) count FROM players WHERE auction_slot='RW'").get()?.count) > 1000);
  assert.ok(Number(database.prepare("SELECT COUNT(*) count FROM players WHERE auction_slot='LW'").get()?.count) > 1000);
  database.close();
});

test('every published tier can supply a full table', { skip: !available }, () => {
  const database = new DatabaseSync(DB_PATH, { readOnly: true });
  const rows = database
    .prepare(
      `SELECT last_season >= 2025 AS current, auction_slot AS slot, COUNT(*) AS total
       FROM players
       WHERE auction_slot IS NOT NULL AND current_value_eur > 0
       GROUP BY current, slot`,
    )
    .all() as Array<{ current: number; slot: string; total: number }>;
  database.close();
  assert.ok(rows.length > 0);
  for (const row of rows) assert.ok(row.total >= 9, `${row.current ? 'current' : 'legends'}/${row.slot}: ${row.total}`);
});
