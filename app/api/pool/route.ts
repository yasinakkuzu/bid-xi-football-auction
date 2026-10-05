import { NextResponse } from 'next/server';
import generated from '../../data/auction-pool.generated.json';
import type { PoolSourceEntry } from '../../../lib/game-engine';
import { sanitizePool } from '../../../lib/media-rights';

export async function GET(request: Request) {
  const era = new URL(request.url).searchParams.get('era') === 'legends' ? 'legends' : 'current';
  // The shipped pool carries no media; the policy layer stays in place so that a
  // future licensed source can be added without ever shipping unverified assets.
  const safe = Object.fromEntries(
    Object.entries(generated[era]).map(([slot, players]) => [slot, sanitizePool(players as PoolSourceEntry[])]),
  );
  return NextResponse.json(safe, {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
  });
}
