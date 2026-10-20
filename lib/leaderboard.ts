import { FORMATIONS, rankManagers, type Formation, type Manager } from './game-engine.ts';
import { standardEligibility } from './auction-runtime.ts';
import { auth, db, digest, ensure, saveState } from './room-store.ts';
import { RoomError, type RoomState } from './room-types.ts';

let lastLeaderboardPrune = 0;

/**
 * Public leaderboard rows are personal data (display name + full squad). The
 * privacy page promises a bounded retention window, so entries older than this
 * many days are purged. Deleted ids are tombstoned first so a re-persisted
 * room snapshot cannot recreate a deleted entry.
 * Set to 0 to keep entries indefinitely (not recommended).
 */
const rawRetention = process.env.LEADERBOARD_RETENTION_DAYS?.trim();
export const LEADERBOARD_RETENTION_DAYS =
  rawRetention !== undefined && rawRetention !== '' ? Number(rawRetention) : 365;
/** D1 allows at most 100 bound parameters per statement, so keep the batch small. */
export const LEADERBOARD_PRUNE_BATCH = 50;

export type LeaderboardEntry = {
  id: string;
  managerName: string;
  score: number;
  playedAt: number;
  formation: Formation;
  squad: Manager['squad'];
  coach: Manager['coach'] | null;
  standardEligible: boolean;
  autoCompleted: boolean;
  humanCount: number;
  scenarioId: string;
  poolMode: string;
  includeBench: boolean;
};
export async function leaderboard(limit = 10, filter: 'standard' | 'all' = 'standard') {
  await ensure();
  await pruneLeaderboardIfDue();
  const where = filter === 'standard' ? 'WHERE standard_eligible=1' : '',
    rows = await db()
      .prepare(
        `SELECT id,manager_name,score,played_at,formation,squad_json,coach_json,standard_eligible,auto_completed,human_count,scenario_id,pool_mode,include_bench FROM leaderboard_entries ${where} ORDER BY score DESC,played_at DESC LIMIT ?`,
      )
      .bind(Math.max(1, Math.min(10, limit)))
      .all<{
        id: string;
        manager_name: string;
        score: number;
        played_at: number;
        formation: Formation;
        squad_json: string;
        coach_json: string | null;
        standard_eligible: number;
        auto_completed: number;
        human_count: number;
        scenario_id: string;
        pool_mode: string;
        include_bench: number;
      }>();
  return (rows.results || []).map(
    (row) =>
      ({
        id: row.id,
        managerName: row.manager_name,
        score: row.score,
        playedAt: row.played_at,
        formation: FORMATIONS.includes(row.formation) ? row.formation : '4-2-3-1',
        squad: JSON.parse(row.squad_json) as Manager['squad'],
        coach: row.coach_json ? (JSON.parse(row.coach_json) as Manager['coach']) : null,
        standardEligible: Boolean(row.standard_eligible),
        autoCompleted: Boolean(row.auto_completed),
        humanCount: row.human_count,
        scenarioId: row.scenario_id,
        poolMode: row.pool_mode,
        includeBench: Boolean(row.include_bench),
      }) satisfies LeaderboardEntry,
  );
}
export async function persistLeaderboard(state: RoomState) {
  const g = state.game;
  if (state.status !== 'results' || !g) return;
  const playedAt = state.completedAt || state.createdAt,
    round = state.season?.round || 1,
    rules = standardEligibility(state),
    approvedManagers = state.members.filter((member) => member.approved && member.role === 'manager'),
    ranked = rankManagers(g.managers).filter((manager) => !manager.isBot),
    memberRows = await db()
      .prepare('SELECT member_id,token_hash FROM room_members WHERE room_code=?')
      .bind(state.code)
      .all<{ member_id: string; token_hash: string }>(),
    tokenHashes = new Map((memberRows.results || []).map((row) => [row.member_id, row.token_hash])),
    deletedRows = await db()
      .prepare('SELECT entry_id FROM leaderboard_deletions WHERE entry_id LIKE ?')
      .bind(`${state.code}:%`)
      .all<{ entry_id: string }>(),
    deleted = new Set((deletedRows.results || []).map((row) => row.entry_id));
  const statements = ranked.flatMap((manager) => {
    const member = approvedManagers[manager.id],
      entryId = `${state.code}:${round}:${manager.id}`;
    // Defence in depth: even if a preference slipped through, members who are
    // not confirmed adults are never published.
    if (!member?.leaderboardOptIn || member.ageBand !== 'adult' || deleted.has(entryId)) return [];
    const alias = (member.leaderboardAlias || manager.name).trim().slice(0, 24) || 'Anonim Menajer';
    return [
      db()
        .prepare(
          `INSERT INTO leaderboard_entries(id,room_code,member_id,delete_token_hash,manager_name,score,played_at,formation,squad_json,coach_json,ruleset_json,standard_eligible,auto_completed,human_count,scenario_id,pool_mode,include_bench) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET member_id=excluded.member_id,delete_token_hash=excluded.delete_token_hash,manager_name=excluded.manager_name,score=excluded.score,played_at=excluded.played_at,formation=excluded.formation,squad_json=excluded.squad_json,coach_json=excluded.coach_json,ruleset_json=excluded.ruleset_json,standard_eligible=excluded.standard_eligible,auto_completed=excluded.auto_completed,human_count=excluded.human_count,scenario_id=excluded.scenario_id,pool_mode=excluded.pool_mode,include_bench=excluded.include_bench`,
        )
        .bind(
          entryId,
          state.code,
          member.id,
          tokenHashes.get(member.id) || null,
          alias,
          manager.score,
          playedAt,
          manager.formation || '4-2-3-1',
          JSON.stringify(manager.squad),
          manager.coach ? JSON.stringify(manager.coach) : null,
          JSON.stringify(rules),
          Number(rules.standardEligible),
          Number(rules.autoCompleted),
          rules.humanCount,
          rules.scenarioId,
          rules.poolMode,
          Number(rules.includeBench),
        ),
    ];
  });
  if (statements.length) await db().batch(statements);
}
export async function removeMemberLeaderboard(roomCode: string, memberId: string) {
  const entries = await db()
      .prepare('SELECT id FROM leaderboard_entries WHERE room_code=? AND member_id=?')
      .bind(roomCode, memberId)
      .all<{ id: string }>(),
    now = Date.now(),
    statements = (entries.results || []).map((entry) =>
      db().prepare('INSERT OR REPLACE INTO leaderboard_deletions(entry_id,deleted_at) VALUES(?,?)').bind(entry.id, now),
    );
  statements.push(
    db().prepare('DELETE FROM leaderboard_entries WHERE room_code=? AND member_id=?').bind(roomCode, memberId),
  );
  await db().batch(statements);
}
export async function removeRoundLeaderboard(roomCode: string, round: number) {
  await db()
    .prepare('DELETE FROM leaderboard_entries WHERE room_code=? AND id LIKE ?')
    .bind(roomCode, `${roomCode}:${round}:%`)
    .run();
}
/**
 * Purges rows older than the retention window and tombstones the ids first, so
 * that `backfillLeaderboard()` cannot recreate them from a room snapshot.
 */
export async function pruneLeaderboard(retentionDays = LEADERBOARD_RETENTION_DAYS, now = Date.now()) {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return 0;
  const cutoff = now - retentionDays * 86400000;
  const rows = await db()
    .prepare('SELECT id FROM leaderboard_entries WHERE played_at < ? LIMIT ?')
    .bind(cutoff, LEADERBOARD_PRUNE_BATCH)
    .all<{ id: string }>();
  const ids = (rows.results || []).map((row) => row.id);
  if (!ids.length) return 0;
  await db().batch([
    ...ids.map((id) =>
      db().prepare('INSERT OR REPLACE INTO leaderboard_deletions(entry_id,deleted_at) VALUES(?,?)').bind(id, now),
    ),
    db()
      .prepare(`DELETE FROM leaderboard_entries WHERE id IN (${ids.map(() => '?').join(',')})`)
      .bind(...ids),
  ]);
  return ids.length;
}

/** Runs at most once per hour per isolate. Called on room creation and leaderboard reads. */
export async function pruneLeaderboardIfDue(now = Date.now()) {
  if (now - lastLeaderboardPrune < 60 * 60000) return 0;
  lastLeaderboardPrune = now;
  try {
    return await pruneLeaderboard(LEADERBOARD_RETENTION_DAYS, now);
  } catch {
    return 0;
  }
}
export async function deleteLeaderboardEntry(roomCode: string, plain: string, entryId: string) {
  await ensure();
  const tokenHash = await digest(plain),
    entry = await db()
      .prepare('SELECT member_id,delete_token_hash FROM leaderboard_entries WHERE id=? AND room_code=?')
      .bind(entryId, roomCode)
      .first<{ member_id: string | null; delete_token_hash: string | null }>();
  if (!entry) throw new RoomError('ENTRY_NOT_FOUND', 'Başarı kaydı bulunamadı', 404);
  let ctx: Awaited<ReturnType<typeof auth>> | undefined;
  if (entry.delete_token_hash !== tokenHash) {
    ctx = await auth(roomCode, plain);
    if (!ctx.isHost && entry.member_id !== ctx.member?.member_id)
      throw new RoomError('FORBIDDEN', 'Bu başarı kaydını silemezsiniz', 403);
  } else
    try {
      ctx = await auth(roomCode, plain);
    } catch {}
  if (ctx) {
    const member = ctx.state.members.find((item) => item.id === entry.member_id);
    if (member) {
      member.leaderboardOptIn = false;
      try {
        await saveState(roomCode, ctx.state, ctx.room.revision);
      } catch {}
    }
  }
  await db().batch([
    db()
      .prepare('INSERT OR REPLACE INTO leaderboard_deletions(entry_id,deleted_at) VALUES(?,?)')
      .bind(entryId, Date.now()),
    db().prepare('DELETE FROM leaderboard_entries WHERE id=? AND room_code=?').bind(entryId, roomCode),
  ]);
  return { deleted: true };
}
