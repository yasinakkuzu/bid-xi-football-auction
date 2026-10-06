/**
 * Measurement-layer contract.
 *
 * The counters are deliberately tiny: an allowlisted event name, a UTC day and an integer.
 * These tests pin that shape down, because "we do not store anything else" is a product
 * promise (`docs/kvkk.md`, "Ölçüm (analitik)"), not just an implementation detail.
 *
 * D1 is not available under `node --test`, so the same structural `AnalyticsDB` interface is
 * satisfied by a thin adapter over an in-memory `node:sqlite` database — the pattern
 * `tests/schema.test.ts` uses for the room schema.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  analyticsSummary,
  EVENT_NAMES,
  EVENT_SCHEMA,
  isAnalyticsEvent,
  recordEvent,
  utcDay,
  type AnalyticsDB,
} from '../lib/analytics.ts';

type Row = Record<string, unknown>;

function testDatabase() {
  const database = new DatabaseSync(':memory:');
  const db: AnalyticsDB = {
    prepare(sql: string) {
      const statement = database.prepare(sql);
      let values: unknown[] = [];
      const prepared = {
        bind: (...next: unknown[]) => {
          values = next;
          return prepared;
        },
        run: async () => {
          statement.run(...(values as never[]));
        },
        all: async <T>() => ({ results: statement.all(...(values as never[])) as T[] }),
      };
      return prepared;
    },
  };
  return { database, db };
}

const rows = (database: DatabaseSync, event: string, day: string) =>
  database.prepare('SELECT event,day,count FROM event_counts WHERE event=? AND day=?').all(event, day) as Row[];

test('only the allowlisted event names are accepted, and a rejection writes nothing', async () => {
  const { database, db } = testDatabase();
  assert.equal(isAnalyticsEvent('room_created'), true);
  assert.equal(isAnalyticsEvent('room_code_abc123'), false);
  assert.equal(isAnalyticsEvent(''), false);
  assert.equal(isAnalyticsEvent(7), false);

  assert.equal(await recordEvent(db, 'room_created', '2026-05-01'), true);
  assert.equal(await recordEvent(db, 'room_code_abc123', '2026-05-01'), false, 'unknown event rejected');
  assert.equal(await recordEvent(db, 'ROOM_CREATED', '2026-05-01'), false, 'names are case-sensitive');
  assert.equal(await recordEvent(db, 'room_created', '01.05.2026'), false, 'malformed day rejected');
  assert.equal(await recordEvent(db, 'room_created', '2026-05-01T10:00:00Z'), false, 'no time of day is stored');

  assert.equal(
    Number((database.prepare('SELECT COUNT(*) count FROM event_counts').get() as Row).count),
    1,
    'only the single valid call reached the table',
  );
  database.close();
});

test('the counter table only ever holds an event, a day and a count', async () => {
  const { database, db } = testDatabase();
  await recordEvent(db, 'room_joined', '2026-05-02');
  const columns = (database.prepare('PRAGMA table_info(event_counts)').all() as Row[]).map((row) => String(row.name));
  assert.deepEqual(columns, ['event', 'day', 'count']);
  assert.equal(EVENT_SCHEMA.length, 1);
  assert.deepEqual([...EVENT_NAMES].sort(), [
    'auction_started',
    'game_completed',
    'invite_shared',
    'result_shared',
    'room_created',
    'room_joined',
  ]);
  database.close();
});

test('repeated calls on the same day increment a single row', async () => {
  const { database, db } = testDatabase();
  assert.equal(utcDay(new Date('2026-05-03T23:59:59.000Z')), '2026-05-03');
  await recordEvent(db, 'auction_started', '2026-05-03');
  await recordEvent(db, 'auction_started', '2026-05-03');
  await recordEvent(db, 'auction_started', '2026-05-04');

  const sameDay = rows(database, 'auction_started', '2026-05-03');
  assert.equal(sameDay.length, 1, 'one row per (event, day)');
  assert.equal(Number(sameDay[0].count), 2, 'two calls on the same day sum to 2');
  assert.equal(Number((rows(database, 'auction_started', '2026-05-04')[0] as Row).count), 1);
  database.close();
});

test('the summary exposes zero-filled totals and a per-day breakdown for the window', async () => {
  const { database, db } = testDatabase();
  const today = utcDay();
  await recordEvent(db, 'room_created', today);
  await recordEvent(db, 'room_joined', today);
  await recordEvent(db, 'room_joined', today);
  await recordEvent(db, 'game_completed', '2000-01-01');

  const summary = await analyticsSummary(db, 7);
  assert.deepEqual(Object.keys(summary.totals).sort(), [...EVENT_NAMES].sort());
  assert.equal(summary.totals.room_created, 1);
  assert.equal(summary.totals.room_joined, 2);
  assert.equal(summary.totals.auction_started, 0, 'events without data still report 0');
  assert.equal(summary.totals.game_completed, 0, 'days outside the window are excluded');

  assert.equal(summary.days.length, 7);
  assert.equal(summary.days[0].day, today, 'newest day first');
  assert.equal(summary.days[0].counts.room_joined, 2);
  for (const bucket of summary.days) {
    assert.match(bucket.day, /^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(Object.keys(bucket.counts).sort(), [...EVENT_NAMES].sort());
  }
  assert.deepEqual(
    summary.days.map((bucket) => bucket.day),
    Array.from({ length: 7 }, (_, offset) => utcDay(new Date(Date.now() - offset * 86400000))),
    'UTC days are contiguous and include empty ones',
  );
  assert.equal(
    Object.values(summary.totals).reduce((sum, value) => sum + value, 0),
    summary.days.reduce((sum, bucket) => sum + Object.values(bucket.counts).reduce((a, b) => a + b, 0), 0),
    'totals are the sum of the day breakdown',
  );

  const empty = await analyticsSummary(db, 1);
  assert.equal(empty.days.length, 1);
  assert.equal(
    Object.values(empty.totals).reduce((sum, value) => sum + value, 0),
    3,
    'a one-day window still sees today',
  );
  database.close();
});
