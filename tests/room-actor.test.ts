import test from 'node:test';
import assert from 'node:assert/strict';
import { awardCurrentLot, startAuction } from '../lib/auction-runtime.ts';
import { canPlaceLotBid, auctionOpeningPrice } from '../lib/game-engine.ts';
import { nextRoomAlarm, RoomCoordinator, tickRoomAlarm, viewerSnapshot, withRoomLock } from '../lib/room-actor.ts';
import { defaultSettings, normalizedSettings, type RoomMember, type RoomState } from '../lib/room-types.ts';

function sampleRoom(botIndexes: number[] = [1]): RoomState {
  const members: RoomMember[] = [
    { id: 'm0', name: 'Kurucu', role: 'manager', approved: true, ageBand: 'adult' },
    {
      id: 'm1',
      name: 'AI Menajer 1',
      role: 'manager',
      approved: true,
      isBot: botIndexes.includes(1),
      botStyle: 'balanced',
      ageBand: 'adult',
    },
    { id: 'm2', name: 'Bekleyen', role: 'manager', approved: false, ageBand: 'minor' },
  ];
  return {
    code: 'ACT001',
    status: 'lobby',
    settings: normalizedSettings({ ...defaultSettings, revealRatings: false }),
    members,
    createdAt: 1_700_000_000_000,
  };
}

test('nextRoomAlarm selects the earliest of lot deadline and bot schedule', () => {
  const state = sampleRoom([1]);
  assert.equal(nextRoomAlarm(state), null, 'lobby has no alarm');

  startAuction(state);
  state.game!.deadline = 5_000;
  state.game!.nextBotAt = 2_000;
  assert.equal(nextRoomAlarm(state), 2_000, 'bot schedule wakes first when earlier');

  state.game!.paused = true;
  assert.equal(nextRoomAlarm(state), null, 'paused auction clears alarm');
});

test('tickRoomAlarm advances bot turns and expires overdue lots autonomously', () => {
  const state = sampleRoom([1]);
  startAuction(state);
  state.game!.nextBotAt = 0;
  const botStep = tickRoomAlarm(state);
  assert.equal(botStep.changed, true);
  assert.equal(state.game!.leader, 1);
  assert.ok(typeof botStep.nextAlarm === 'number');

  const lotBefore = state.game!.pool[state.game!.index].id;
  state.game!.deadline = Date.now() - 500;
  const expireStep = tickRoomAlarm(state);
  assert.equal(expireStep.changed, true);
  assert.notEqual(state.game!.pool[state.game!.index].id, lotBefore);
});

test('viewerSnapshot redacts active ratings for approved members and hides game for pending members', () => {
  const state = sampleRoom([1]);
  startAuction(state);

  const pendingView = viewerSnapshot(state, 3, { isHost: false, memberId: 'm2', approved: false }, 10_000);
  assert.equal(pendingView.state.status, 'lobby');
  assert.equal(pendingView.state.game, undefined);
  assert.equal(pendingView.viewerAgeBand, 'minor');

  const approvedView = viewerSnapshot(state, 3, { isHost: true, memberId: 'm0', approved: true }, 10_000);
  assert.equal(approvedView.state.status, 'auction');
  assert.equal(Object.hasOwn(approvedView.state.game!.pool[0], 'rating'), false);
  assert.equal(approvedView.state.game!.pool[1].name, 'Gizli lot');
});

test('RoomCoordinator serialises concurrent mutations, schedules alarms and broadcasts per-role views', async () => {
  const persisted: number[] = [];
  const alarms: Array<number | null> = [];
  const coordinator = new RoomCoordinator(sampleRoom([]), 0, {
    onPersist: (_state, revision) => {
      persisted.push(revision);
    },
    onScheduleAlarm: (timestamp) => {
      alarms.push(timestamp);
    },
  });

  const hostFrames: string[] = [];
  const pendingFrames: string[] = [];
  const hostSocket = { send: (payload: string) => hostFrames.push(payload) };
  const pendingSocket = { send: (payload: string) => pendingFrames.push(payload) };

  coordinator.connect(hostSocket, { isHost: true, memberId: 'm0', approved: true });
  coordinator.connect(pendingSocket, { isHost: false, memberId: 'm2', approved: false });
  assert.equal(coordinator.subscriberCount, 2);
  assert.equal(hostFrames.length, 1);
  assert.equal(pendingFrames.length, 1);

  await coordinator.mutate((state) => {
    startAuction(state);
  });

  // Dispatch two concurrent bids through the single-actor queue
  await Promise.all([
    coordinator.mutate((state) => {
      const g = state.game!;
      const lot = g.pool[g.index];
      const offer = auctionOpeningPrice(lot, g.managers);
      if (canPlaceLotBid(g.managers[0], lot, offer, 0, g.passed)) {
        g.bid = offer;
        g.leader = 0;
      }
    }),
    coordinator.mutate((state) => {
      const g = state.game!;
      const lot = g.pool[g.index];
      const offer = g.bid + 5;
      if (canPlaceLotBid(g.managers[1], lot, offer, 1, g.passed)) {
        g.bid = offer;
        g.leader = 1;
      }
    }),
  ]);

  assert.equal(coordinator.revision, 3);
  assert.deepEqual(persisted, [1, 2, 3]);
  assert.equal(coordinator.state.game!.leader, 1);
  assert.ok(alarms.length >= 3);

  // Pending member still only receives lobby view until approved
  const latestPending = JSON.parse(pendingFrames[pendingFrames.length - 1]) as { state: RoomState };
  assert.equal(latestPending.state.game, undefined);

  // Approve pending member and award current lot
  await coordinator.mutate((state) => {
    const member = state.members.find((m) => m.id === 'm2');
    if (member) member.approved = true;
    awardCurrentLot(state, 1, state.game!.bid);
  });

  const approvedNow = JSON.parse(pendingFrames[pendingFrames.length - 1]) as { state: RoomState };
  assert.equal(approvedNow.state.status, 'auction');
  assert.equal(approvedNow.state.game?.lastSold?.managerId, 1);

  coordinator.disconnect(pendingSocket);
  assert.equal(coordinator.subscriberCount, 1);
});

test('withRoomLock serialises concurrent operations for the same room code', async () => {
  const order: number[] = [];
  await Promise.all([
    withRoomLock('LOCK01', async () => {
      order.push(1);
      await new Promise((r) => setTimeout(r, 15));
      order.push(2);
    }),
    withRoomLock('LOCK01', async () => {
      order.push(3);
    }),
  ]);
  assert.deepEqual(order, [1, 2, 3]);
});
