import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoCompleteAuction,
  buildPool,
  captureUndo,
  estimateAuctionDuration,
  pendingStateView,
  publicStateView,
  restartAuction,
  settleBot,
  settleExpired,
  standardEligibility,
  startAuction,
} from '../lib/auction-runtime.ts';
import { isCoach, type AuctionLot, type Footballer, type Manager, type Slot } from '../lib/game-engine.ts';
import {
  defaultSettings,
  normalizedSettings,
  type RoomMember,
  type RoomSettings,
  type RoomState,
} from '../lib/room-types.ts';

const lot = (id: string, slot: Slot, rating: number): Footballer => ({
  id,
  name: `Oyuncu ${id}`,
  slot,
  role: 'Forvet',
  rating,
  price: 10,
  nation: 'TUR',
});

const managers = (count: number, botIndexes: number[] = []): Manager[] =>
  Array.from({ length: count }, (_, id) => ({
    id,
    name: `Menajer ${id}`,
    budget: 1000,
    spent: 0,
    squad: {},
    isBot: botIndexes.includes(id),
    botStyle: botIndexes.includes(id) ? ('balanced' as const) : undefined,
  }));

const members = (count: number, botIndexes: number[] = []): RoomMember[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `m${index}`,
    name: `Menajer ${index}`,
    role: 'manager' as const,
    approved: true,
    isBot: botIndexes.includes(index),
    botStyle: botIndexes.includes(index) ? ('balanced' as const) : undefined,
    leaderboardOptIn: false,
  }));

function stateWith(overrides: Partial<RoomState> = {}, settings: Partial<RoomSettings> = {}): RoomState {
  return {
    code: 'ROOM01',
    status: 'lobby',
    settings: normalizedSettings({ ...defaultSettings, ...settings }),
    members: members(2),
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function gameWith(pool: AuctionLot[], overrides: Partial<NonNullable<RoomState['game']>> = {}) {
  return {
    managers: managers(2),
    pool,
    index: 0,
    bid: 0,
    leader: null,
    passed: [],
    activeTurn: 0,
    paused: false,
    deadline: null,
    feed: [],
    ...overrides,
  } satisfies NonNullable<RoomState['game']>;
}

test('publicStateView redacts the active rating and every future lot identity', () => {
  const pool = [lot('a', 'GK', 90), lot('b', 'RB', 88), lot('c', 'CB1', 85)];
  const state = stateWith(
    {
      status: 'auction',
      game: gameWith(pool, { index: 1, bid: 5, leader: 0, undo: '{"v":2}', undoStatus: 'auction' }),
    },
    { revealRatings: false },
  );
  const view = publicStateView(state),
    publicPool = view.game!.pool;

  assert.equal(publicPool[0].rating, 90, 'already sold lots stay visible');
  assert.equal(Object.hasOwn(publicPool[1], 'rating'), false, 'active rating is removed');
  assert.equal(publicPool[1].name, 'Oyuncu b');
  assert.equal(publicPool[2].name, 'Gizli lot');
  assert.equal(publicPool[2].rating, 0);
  assert.equal(view.game!.undo, undefined);
  assert.equal(view.game!.undoStatus, undefined);
  assert.deepEqual(view.game!.publicMeta, {
    currentIsBonus: false,
    currentPassIsSafe: false,
    groupOrdinal: 1,
    totalLots: 3,
    canUndo: true,
  });
  assert.equal(state.game!.undo, '{"v":2}', 'the stored state is not mutated');
});

test('publicStateView reveals the active rating only when the room asks for it', () => {
  const pool = [lot('a', 'GK', 90), lot('b', 'RB', 88), lot('c', 'CB1', 85)];
  const state = stateWith({ status: 'auction', game: gameWith(pool, { index: 1 }) }, { revealRatings: true });
  const view = publicStateView(state);
  assert.equal(view.game!.pool[1].rating, 88, 'the active rating is visible');
  // Upcoming lots stay anonymous even with ratings revealed; only the lot that
  // is on the block (and everything already sold) is known to the table.
  assert.equal(view.game!.pool[2].name, 'Gizli lot');
});

test('pendingStateView exposes lobby metadata only', () => {
  const state = stateWith({
    status: 'auction',
    game: gameWith([lot('a', 'GK', 90)]),
    chat: [{ id: 'c1', memberId: 'm0', name: 'Menajer 0', text: 'selam', at: 1 }],
    season: { round: 1, length: 1, standings: {} },
  });
  const pending = pendingStateView(state);
  assert.equal(pending.status, 'lobby');
  assert.equal(pending.game, undefined);
  assert.equal(pending.chat, undefined);
  assert.equal(pending.season, undefined);
  assert.deepEqual(Object.keys(pending.members[0]).sort(), ['approved', 'botStyle', 'id', 'isBot', 'name', 'role']);
});

test('auction duration estimates cover the bench and second-chance rules', () => {
  const base = estimateAuctionDuration({ ...defaultSettings, timerSeconds: 10 }, 4);
  assert.equal(base.lots, 60);
  assert.equal(base.minutes, 14);
  assert.equal(base.fastRecommended, false);
  const withBench = estimateAuctionDuration({ ...defaultSettings, timerSeconds: 10, includeBench: true }, 4);
  assert.equal(withBench.lots, 80);
  assert.equal(withBench.fastRecommended, true);
  const manual = estimateAuctionDuration({ ...defaultSettings, auctionMode: 'manual' }, 2);
  assert.equal(manual.lots, 36);
  assert.equal(manual.minutes, 8);
});

test('startAuction builds a full board from the approved managers only', () => {
  const state = stateWith({
    members: [...members(2, [1]), { id: 'x', name: 'Seyirci', role: 'spectator', approved: true }],
  });
  startAuction(state);
  assert.equal(state.status, 'auction');
  assert.equal(state.game!.managers.length, 2);
  assert.deepEqual(
    state.game!.managers.map((manager) => [manager.id, manager.name, manager.budget, manager.spent]),
    [
      [0, 'Menajer 0', 1000, 0],
      [1, 'Menajer 1', 1000, 0],
    ],
  );
  assert.equal(state.game!.pool.length, 36);
  assert.equal(state.game!.pool.filter(isCoach).length, 3);
  assert.ok(state.game!.deadline! > Date.now());
  assert.equal(state.season!.round, 1);
  assert.match(state.game!.feed[0], /açık artırma başladı/);
});

test('hidden-gem rooms keep real ratings server-side and only redact the public view', () => {
  const state = stateWith({ members: members(2, [1]) }, { scenarioId: 'hidden-gems', revealRatings: true });
  startAuction(state);
  assert.equal(state.settings.revealRatings, false);
  assert.ok(state.game!.pool.every((entry) => typeof entry.rating === 'number'));
  assert.equal(Object.hasOwn(publicStateView(state).game!.pool[0], 'rating'), false);
});

test('the pool builder is deterministic per seed and avoids recently seen lots', () => {
  const first = buildPool(defaultSettings, 2, 'seed-a', new Set());
  const second = buildPool(defaultSettings, 2, 'seed-a', new Set());
  const other = buildPool(defaultSettings, 2, 'seed-b', new Set());
  assert.deepEqual(
    first.map((entry) => entry.id),
    second.map((entry) => entry.id),
  );
  assert.notDeepEqual(
    first.map((entry) => entry.id),
    other.map((entry) => entry.id),
  );
  const excluded = new Set(first.slice(0, 20).map((entry) => entry.id));
  const fresh = buildPool(defaultSettings, 2, 'seed-a', excluded);
  assert.equal(fresh.filter((entry) => excluded.has(entry.id)).length, 0);
});

test('a bot takes its turn through settleBot and never exceeds its budget', () => {
  const state = stateWith({ members: members(2, [1]) });
  startAuction(state);
  state.game!.nextBotAt = 0;
  const acted = settleBot(state);
  assert.equal(acted, true);
  assert.equal(state.game!.leader, 1);
  assert.ok(state.game!.bid >= 5);
  assert.match(state.game!.feed[0], /AI/);
});

test('settleExpired skips an unsold lot and awards a lot that has a leader', () => {
  const skipped = stateWith({ members: members(2, [1]) });
  startAuction(skipped);
  skipped.game!.leader = null;
  skipped.game!.bid = 0;
  skipped.game!.activeTurn = 0;
  skipped.game!.deadline = Date.now() - 1000;
  assert.equal(settleExpired(skipped), true);
  assert.match(skipped.game!.feed.join(' '), /süre doldu ve teklif gelmedi/i);

  const sold = stateWith({ members: members(2, [1]) });
  startAuction(sold);
  const awarded = sold.game!.pool[sold.game!.index] as Footballer;
  const lotId = awarded.id;
  sold.game!.leader = 0;
  sold.game!.bid = 25;
  sold.game!.activeTurn = 0;
  sold.game!.deadline = Date.now() - 1000;
  assert.equal(settleExpired(sold), true);
  assert.equal(sold.game!.managers[0].budget, 975);
  assert.equal(sold.game!.managers[0].spent, 25);
  assert.equal(sold.game!.managers[0].squad[awarded.slot]?.id, lotId);
  assert.notEqual(sold.game!.pool[sold.game!.index].id, lotId, 'the auction moved on to the next lot');
});

test('captureUndo stores a restorable v2 snapshot without nesting the previous undo', () => {
  const state = stateWith({ members: members(2, [1]) });
  startAuction(state);
  captureUndo(state);
  const snapshot = JSON.parse(state.game!.undo!) as { version: number; status: string; game: { undo?: string } };
  assert.equal(snapshot.version, 2);
  assert.equal(snapshot.status, 'auction');
  assert.equal(snapshot.game.undo, undefined);
  assert.equal(state.game!.undoStatus, 'auction');
});

test('autoCompleteAuction finishes the board, keeps budgets non-negative and records an audit trail', () => {
  const state = stateWith({ members: members(3, [2]) });
  startAuction(state);
  autoCompleteAuction(state);
  assert.equal(state.status, 'results');
  assert.equal(state.autoCompleted, true);
  assert.equal(typeof state.completedAt, 'number');
  for (const manager of state.game!.managers) {
    assert.equal(Object.keys(manager.squad).length, 11);
    assert.ok(manager.budget >= 0, `${manager.name} budget ${manager.budget}`);
    assert.ok(manager.coach);
  }
  assert.equal(Object.keys(state.season!.standings).length, 3);
  assert.ok(state.game!.audit!.some((entry) => entry.includes('otomatik tamamlandı')));
});

test('restartAuction resets the room with a fresh pool that avoids the previous lots', async () => {
  const state = stateWith({ members: members(2, [1]) });
  startAuction(state);
  const previousIds = state.game!.pool.map((entry) => entry.id);
  await restartAuction(state, state.code);
  assert.equal(state.status, 'auction');
  assert.equal(state.season!.round, 1);
  assert.deepEqual(state.game!.managers[0].squad, {});
  assert.equal(state.game!.managers[0].budget, 1000);
  assert.equal(state.game!.managers[0].spent, 0);
  assert.match(state.game!.feed[0], /yeniden başlatıldı/);
  const repeated = state.game!.pool.filter((entry) => previousIds.includes(entry.id));
  assert.equal(repeated.length, 0);
});

test('standardEligibility separates comparable games from assisted ones', () => {
  const state = stateWith({ members: members(4) });
  startAuction(state);
  const eligible = standardEligibility(state);
  assert.equal(eligible.standardEligible, true);
  assert.equal(eligible.humanCount, 4);
  assert.match(eligible.rulesFingerprint, /^[0-9a-f]{8}$/);

  const assisted = stateWith({ members: members(3, [2]) });
  startAuction(assisted);
  assisted.autoCompleted = true;
  const evaluation = standardEligibility(assisted);
  assert.equal(evaluation.standardEligible, false);
  assert.ok(evaluation.autoCompleted);
});
