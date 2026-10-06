/**
 * Cookie-less aggregate measurement for Mezat 11.
 *
 * Contract — what this module stores, and what it must never store:
 *
 * - **Stored:** an allowlisted event name, the UTC day (`YYYY-MM-DD`) and an integer counter.
 *   One row per `(event, day)`, so the table grows by at most `EVENT_NAMES.length` rows a day.
 * - **Never stored:** room code, manager/display name, IP address (raw or hashed), user agent,
 *   session or device identifier, referrer, cookie, or any timestamp finer than a day. There
 *   is no third-party analytics vendor either: the client posts to our own `/api/analytics`
 *   route and the counters live in the same D1 database as the rooms.
 *
 * Because a counter row cannot be linked back to a person, it is not personal data under KVKK:
 * no consent banner, no cookie notice and no cross-site identifier is involved. The written
 * rationale and the retention expectation live in `docs/kvkk.md` ("Ölçüm (analitik)").
 *
 * The table is created lazily here instead of `db/schema.ts` because it is a self-contained
 * measurement concern: the counters are disposable and must not take part in room retention.
 */

/** The only event names the database will ever accept. Anything else is rejected. */
export const EVENT_NAMES = [
  'room_created',
  'room_joined',
  'auction_started',
  'game_completed',
  'invite_shared',
  'result_shared',
] as const;

export type AnalyticsEvent = (typeof EVENT_NAMES)[number];

/** `ensure()`-style DDL, mirroring `ROOM_SCHEMA` in `db/schema.ts`. */
export const EVENT_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS event_counts (event TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (event, day))`,
];

const UPSERT = `INSERT INTO event_counts(event,day,count) VALUES(?,?,1) ON CONFLICT(event, day) DO UPDATE SET count = count + 1`;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The narrow slice of `D1Database` this module needs. Keeping it structural (instead of
 * importing `cloudflare:workers`) means `tests/analytics.test.ts` can drive the same code
 * with an in-memory SQLite database and the module stays free of workerd-only imports.
 */
export type AnalyticsStatement = {
  bind(...values: unknown[]): AnalyticsStatement;
  run(): Promise<unknown>;
  all<T>(): Promise<{ results?: T[] }>;
};
export type AnalyticsDB = { prepare(sql: string): AnalyticsStatement };

export type AnalyticsDay = { day: string; counts: Record<AnalyticsEvent, number> };
export type AnalyticsSummary = { totals: Record<AnalyticsEvent, number>; days: AnalyticsDay[] };

/** Module-level guard so a warm isolate creates the table once, like `lib/room-store.ts`'s `ensure()`. */
const prepared = new WeakSet<object>();

async function ensure(database: AnalyticsDB) {
  if (prepared.has(database)) return;
  for (const sql of EVENT_SCHEMA) await database.prepare(sql).run();
  prepared.add(database);
}

export function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  return typeof value === 'string' && (EVENT_NAMES as readonly string[]).includes(value);
}

/** UTC day key. Deliberately the coarsest grain we keep: no clock time leaves the client. */
export function utcDay(date: Date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * Increments the counter for one allowlisted event on one UTC day.
 *
 * Returns `true` only when a counter was actually incremented; an unknown event name or a
 * malformed day returns `false` and writes nothing. It never throws for bad input, which keeps
 * the fire-and-forget client path and the route's `400` branch trivial.
 */
export async function recordEvent(database: AnalyticsDB, event: string, day: string = utcDay()) {
  if (!isAnalyticsEvent(event) || !DAY_PATTERN.test(day)) return false;
  await ensure(database);
  await database.prepare(UPSERT).bind(event, day).run();
  return true;
}

function zeroCounts(): Record<AnalyticsEvent, number> {
  return Object.fromEntries(EVENT_NAMES.map((event) => [event, 0])) as Record<AnalyticsEvent, number>;
}

/**
 * Per-event totals plus a per-day breakdown for the last `days` UTC days (today first,
 * zero-filled so the shape is stable for charts). `totals` is therefore the sum of `days`,
 * scoped to the same window. Rows whose event is not on the allowlist are ignored.
 */
export async function analyticsSummary(database: AnalyticsDB, days = 30): Promise<AnalyticsSummary> {
  const window = Number.isFinite(days) ? Math.min(Math.max(Math.floor(days), 1), 365) : 30;
  await ensure(database);
  const buckets: AnalyticsDay[] = Array.from({ length: window }, (_, offset) => ({
    day: utcDay(new Date(Date.now() - offset * 86400000)),
    counts: zeroCounts(),
  }));
  const byDay = new Map(buckets.map((bucket) => [bucket.day, bucket]));
  const { results = [] } = await database
    .prepare('SELECT event, day, count FROM event_counts WHERE day >= ?')
    .bind(buckets[buckets.length - 1].day)
    .all<{ event: string; day: string; count: number }>();
  const totals = zeroCounts();
  for (const row of results) {
    const bucket = byDay.get(String(row.day));
    if (!bucket || !isAnalyticsEvent(row.event)) continue;
    const count = Number(row.count) || 0;
    bucket.counts[row.event] += count;
    totals[row.event] += count;
  }
  return { totals, days: buckets };
}
