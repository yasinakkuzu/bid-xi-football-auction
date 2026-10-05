import { NextResponse } from 'next/server';
import { digest, publicRoom, rateLimit, RoomError } from '../../../../lib/rooms';

/**
 * Room polling is the highest-volume endpoint in the app (every client polls
 * this while an auction runs) and D1 serialises writes per database, so the read
 * path intentionally uses a *single* rate-limit counter instead of the two used
 * for mutations. The key includes the caller IP, which keeps token-rotating
 * abuse from fanning out into unlimited buckets.
 */
const POLLS_PER_MINUTE_PER_ROOM_IP = 900;

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params,
      roomCode = code.toUpperCase(),
      token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '',
      ip = request.headers.get('cf-connecting-ip') || 'unknown';
    await rateLimit(`poll:${roomCode}:${(await digest(ip)).slice(0, 16)}`, POLLS_PER_MINUTE_PER_ROOM_IP);
    return NextResponse.json(await publicRoom(roomCode, token), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const known = error instanceof RoomError;
    const headers = known && error.status === 429 ? { 'Retry-After': '30' } : undefined;
    return NextResponse.json(
      { error: (error as Error).message, code: known ? error.code : 'ROOM_READ_FAILED' },
      { status: known ? error.status : 500, headers },
    );
  }
}
