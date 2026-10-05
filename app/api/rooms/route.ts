import { NextResponse } from 'next/server';
import {
  createRoom,
  defaultSettings,
  digest,
  joinRoom,
  rateLimit,
  RoomError,
  type RoomSettings,
} from '../../../lib/rooms';

type CreateBody = {
  action?: string;
  code?: string;
  name?: string;
  role?: 'manager' | 'spectator';
  settings?: RoomSettings;
  /** Age/consent declaration; validated server-side by `lib/age-policy.ts`. */
  birthYear?: unknown;
  consentAccepted?: unknown;
};

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 8192)
      throw new RoomError('BODY_TOO_LARGE', 'İstek çok büyük', 413);
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    await rateLimit(`entry:${await digest(ip)}`, 20);
    const body = (await request.json()) as CreateBody;
    const declaration = { birthYear: body.birthYear, consentAccepted: body.consentAccepted };
    if (body.action === 'join') {
      const code = String(body.code || '')
        .trim()
        .toUpperCase();
      if (!/^[A-Z2-9]{6}$/.test(code)) throw new RoomError('INVALID_CODE', 'Oda kodu geçersiz', 400);
      return NextResponse.json(
        await joinRoom(code, body.name ?? '', body.role === 'spectator' ? 'spectator' : 'manager', declaration),
      );
    }
    return NextResponse.json(await createRoom(body.name ?? '', body.settings || defaultSettings, declaration));
  } catch (error) {
    const known = error instanceof RoomError;
    const headers = known && error.status === 429 ? { 'Retry-After': '30' } : undefined;
    return NextResponse.json(
      { error: (error as Error).message, code: known ? error.code : 'REQUEST_FAILED' },
      { status: known ? error.status : 400, headers },
    );
  }
}
