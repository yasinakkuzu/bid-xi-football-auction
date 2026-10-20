import { NextResponse } from 'next/server';
import { analyticsSummary, isAnalyticsEvent, recordEvent, utcDay } from '../../../lib/analytics';
import { db } from '../../../lib/room-store';
import { digest, rateLimit, RoomError } from '../../../lib/rooms';

/**
 * Cookie-less aggregate counters. Accepts exactly one allowlisted event name and stores only
 * `(event, day, count)` — no room lookup, no auth, no request metadata, no response body.
 * See `lib/analytics.ts` for the storage contract and `docs/kvkk.md` for the rationale.
 */
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 512)
      throw new RoomError('BODY_TOO_LARGE', 'İstek çok büyük', 413);
    // Reuses the room-store limiter so a bot cannot inflate a counter for free. This writes a
    // short-lived request counter (see docs/kvkk.md §2); nothing about the request reaches event_counts.
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    await rateLimit(`analytics:${await digest(ip)}`, 120);
    const body = (await request.json()) as { event?: unknown };
    const event = typeof body?.event === 'string' ? body.event : '';
    if (!isAnalyticsEvent(event) || !(await recordEvent(db(), event, utcDay())))
      throw new RoomError('INVALID_EVENT', 'Bilinmeyen olay adı', 400);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const known = error instanceof RoomError;
    const headers = known && error.status === 429 ? { 'Retry-After': '30' } : undefined;
    return NextResponse.json(
      { error: (error as Error).message, code: known ? error.code : 'ANALYTICS_FAILED' },
      { status: known ? error.status : 500, headers },
    );
  }
}

/** Public aggregate read: totals plus a zero-filled per-day breakdown. Contains no room or member data. */
export async function GET(request: Request) {
  try {
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    await rateLimit(`analytics-read:${await digest(ip)}`, 60);
    return NextResponse.json(
      { ok: true, ...(await analyticsSummary(db())) },
      { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } },
    );
  } catch (error) {
    const known = error instanceof RoomError;
    const headers = known && error.status === 429 ? { 'Retry-After': '30' } : undefined;
    return NextResponse.json(
      { error: (error as Error).message, code: known ? error.code : 'ANALYTICS_FAILED' },
      { status: known ? error.status : 500, headers },
    );
  }
}
