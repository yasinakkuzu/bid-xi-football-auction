import { env } from 'cloudflare:workers';
import { ROOM_SCHEMA } from '../db/schema.ts';
import { RoomError, type RoomState } from './room-types.ts';

type DBEnv = { DB: D1Database };
export const db = () => (env as unknown as DBEnv).DB;
let ready = false;
let lastMaintenance = 0;
export async function ensure() {
  if (ready) return;
  for (const sql of ROOM_SCHEMA) await db().prepare(sql).run();
  ready = true;
}
export async function digest(v: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return [...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export const token = () => crypto.randomUUID() + crypto.randomUUID();
export function code() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((x) => chars[x % chars.length]).join('');
}
export async function cleanup() {
  await ensure();
  const now = Date.now();
  await db()
    .prepare('DELETE FROM room_members WHERE room_code IN (SELECT code FROM rooms WHERE expires_at < ?)')
    .bind(now)
    .run();
  await db().prepare('DELETE FROM rooms WHERE expires_at < ?').bind(now).run();
  await db()
    .prepare('DELETE FROM room_actions WHERE created_at < ?')
    .bind(now - 7 * 86400000)
    .run();
  await db()
    .prepare('DELETE FROM request_limits WHERE window_start < ?')
    .bind(now - 10 * 60000)
    .run();
  lastMaintenance = now;
}
const pollWindowCache = new Map<string, { windowStart: number; count: number }>();

export function checkMemoryRateLimit(key: string, max = 40, windowMs = 60000, now = Date.now()): number {
  const start = now - windowMs;
  if (pollWindowCache.size > 5000) {
    for (const [k, v] of pollWindowCache) {
      if (v.windowStart < start) pollWindowCache.delete(k);
    }
  }
  const existing = pollWindowCache.get(key);
  if (!existing || existing.windowStart < start) {
    pollWindowCache.set(key, { windowStart: now, count: 1 });
    return 1;
  }
  existing.count += 1;
  return existing.count;
}

export async function rateLimit(key: string, max = 40, windowMs = 60000) {
  if (key.startsWith('poll:')) {
    if (checkMemoryRateLimit(key, max, windowMs) > max)
      throw new RoomError('RATE_LIMITED', 'Çok fazla istek gönderildi. Lütfen kısa süre sonra tekrar deneyin.', 429);
    return;
  }
  await ensure();
  const now = Date.now(),
    start = now - windowMs;
  if (now - lastMaintenance > 5 * 60000) {
    await db()
      .prepare('DELETE FROM request_limits WHERE window_start < ?')
      .bind(now - 10 * 60000)
      .run();
    await db()
      .prepare('DELETE FROM room_actions WHERE created_at < ?')
      .bind(now - 7 * 86400000)
      .run();
    lastMaintenance = now;
  }
  const row = await db()
    .prepare(
      `INSERT INTO request_limits(limit_key,window_start,request_count) VALUES(?,?,1) ON CONFLICT(limit_key) DO UPDATE SET window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END,request_count=CASE WHEN window_start<? THEN 1 ELSE request_count+1 END RETURNING request_count`,
    )
    .bind(key, now, start, start)
    .first<{ request_count: number }>();
  if ((row?.request_count || 1) > max)
    throw new RoomError('RATE_LIMITED', 'Çok fazla istek gönderildi. Lütfen kısa süre sonra tekrar deneyin.', 429);
}
export async function auth(roomCode: string, plain: string) {
  await ensure();
  const hash = await digest(plain);
  const room = await db()
    .prepare('SELECT state_json,revision,host_token_hash FROM rooms WHERE code=? AND expires_at>?')
    .bind(roomCode, Date.now())
    .first<{ state_json: string; revision: number; host_token_hash: string }>();
  if (!room) throw new RoomError('ROOM_EXPIRED', 'Oda bulunamadı veya süresi doldu', 410);
  const state = JSON.parse(room.state_json) as RoomState;
  if (room.host_token_hash === hash) {
    const hostId = state.members[0]?.id,
      projected = hostId
        ? await db()
            .prepare(
              "SELECT member_id,name,role,approved FROM room_members WHERE room_code=? AND member_id=? AND role='manager' LIMIT 1",
            )
            .bind(roomCode, hostId)
            .first<{ member_id: string; name: string; role: 'manager'; approved: number }>()
        : await db()
            .prepare(
              "SELECT member_id,name,role,approved FROM room_members WHERE room_code=? AND role='manager' ORDER BY rowid LIMIT 1",
            )
            .bind(roomCode)
            .first<{ member_id: string; name: string; role: 'manager'; approved: number }>(),
      authoritative = state.members.find((item) => item.id === projected?.member_id) ?? state.members[0];
    const member =
      projected && authoritative
        ? { ...projected, name: authoritative.name, role: authoritative.role, approved: Number(authoritative.approved) }
        : authoritative
          ? {
              member_id: authoritative.id,
              name: authoritative.name,
              role: 'manager' as const,
              approved: Number(authoritative.approved),
            }
          : projected;
    return { room, state, isHost: true, member };
  }
  const projected = await db()
    .prepare('SELECT member_id,name,role,approved,last_seen FROM room_members WHERE room_code=? AND token_hash=?')
    .bind(roomCode, hash)
    .first<{ member_id: string; name: string; role: 'manager' | 'spectator'; approved: number; last_seen: number }>();
  const authoritative = state.members.find((item) => item.id === projected?.member_id);
  if (!projected || !authoritative) throw new RoomError('AUTH_INVALID', 'Bağlantı yetkisi geçersiz', 401);
  const member = {
    ...projected,
    name: authoritative.name,
    role: authoritative.role,
    approved: Number(authoritative.approved),
  };
  if (Date.now() - projected.last_seen > 30000)
    await db()
      .prepare('UPDATE room_members SET last_seen=? WHERE room_code=? AND member_id=?')
      .bind(Date.now(), roomCode, projected.member_id)
      .run();
  return { room, state, isHost: false, member };
}
export async function saveState(roomCode: string, state: RoomState, revision: number) {
  const result = await db()
    .prepare('UPDATE rooms SET state_json=?,revision=revision+1,expires_at=? WHERE code=? AND revision=?')
    .bind(JSON.stringify(state), Date.now() + 7 * 86400000, roomCode, revision)
    .run();
  if (!result.meta.changes) throw new RoomError('REVISION_CONFLICT', 'Durum değişti; tekrar deneyin', 409);
}
