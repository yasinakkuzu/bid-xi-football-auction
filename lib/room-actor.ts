/**
 * Durable-Object-ready single-room coordinator (`RoomActor` core).
 *
 * Keeps the authoritative room state in memory, schedules autonomous server
 * alarms for lot deadlines and AI bot turns (`nextRoomAlarm` / `tickRoomAlarm`),
 * serialises concurrent mutations without D1 optimistic-lock collisions, and
 * pushes role-scoped snapshots (`publicStateView` vs `pendingStateView`) to
 * connected WebSocket clients.
 *
 * This module stays free of `cloudflare:workers` runtime imports so the entire
 * state/alarm/broadcast lifecycle is deterministic and testable under
 * `node --experimental-strip-types --test`.
 */

import {
  auctionMode,
  estimateAuctionDuration,
  pendingStateView,
  publicStateView,
  settleBot,
  settleExpired,
} from './auction-runtime.ts';
import type { AgeBand } from './age-policy.ts';
import type { RoomState } from './room-types.ts';

export type ViewerIdentity = {
  isHost: boolean;
  memberId: string | null;
  approved: boolean;
};

export type RoomEnvelope = {
  state: RoomState;
  revision: number;
  isHost: boolean;
  memberId: string | null;
  viewerAgeBand: AgeBand;
  serverTime: number;
  estimatedDuration: ReturnType<typeof estimateAuctionDuration>;
};

export type WebSocketClient = {
  send(payload: string): void;
  close?(code?: number, reason?: string): void;
};

/**
 * Computes the next server alarm timestamp (ms since epoch) for a live auction.
 * Returns `null` when the room is not in an active, unpaused live auction.
 */
export function nextRoomAlarm(state: RoomState): number | null {
  const g = state.game;
  if (state.status !== 'auction' || !g || auctionMode(state) !== 'live' || g.paused || g.activeTurn === null) {
    return null;
  }
  const candidates: number[] = [];
  if (typeof g.deadline === 'number' && Number.isFinite(g.deadline)) {
    candidates.push(g.deadline);
  }
  const hasBots = g.managers.some((manager) => manager.isBot);
  if (hasBots && typeof g.nextBotAt === 'number' && Number.isFinite(g.nextBotAt)) {
    candidates.push(g.nextBotAt);
  }
  if (!candidates.length) return null;
  return Math.min(...candidates);
}

/**
 * Advances expired lot timers and due bot bids autonomously on an alarm tick.
 */
export function tickRoomAlarm(state: RoomState): { changed: boolean; nextAlarm: number | null } {
  const expiredChanged = settleExpired(state);
  const botChanged = state.status === 'auction' ? settleBot(state) : false;
  const changed = expiredChanged || botChanged;
  return { changed, nextAlarm: nextRoomAlarm(state) };
}

/**
 * Builds the role-appropriate room envelope for a specific connected viewer.
 * Pending (unapproved) non-host members receive lobby metadata only.
 */
export function viewerSnapshot(
  state: RoomState,
  revision: number,
  viewer: ViewerIdentity,
  now = Date.now(),
): RoomEnvelope {
  const approvedManagers = state.members.filter((member) => member.approved && member.role === 'manager').length;
  const estimatedDuration = estimateAuctionDuration(state.settings, approvedManagers);
  const viewerAgeBand: AgeBand = state.members.find((item) => item.id === viewer.memberId)?.ageBand ?? 'unknown';

  if (!viewer.isHost && viewer.memberId && !viewer.approved) {
    return {
      state: pendingStateView(state),
      revision,
      isHost: false,
      memberId: viewer.memberId,
      viewerAgeBand,
      serverTime: now,
      estimatedDuration,
    };
  }

  return {
    state: publicStateView(state),
    revision,
    isHost: viewer.isHost,
    memberId: viewer.memberId,
    viewerAgeBand,
    serverTime: now,
    estimatedDuration,
  };
}

export type CoordinatorHooks = {
  onPersist?: (state: RoomState, revision: number) => Promise<void> | void;
  onScheduleAlarm?: (timestamp: number | null) => Promise<void> | void;
};

/**
 * Single-threaded room actor that serialises state transitions, manages
 * WebSocket subscribers, and coordinates Durable Object alarms.
 */
export class RoomCoordinator {
  #state: RoomState;
  #revision: number;
  #clients = new Map<WebSocketClient, ViewerIdentity>();
  #hooks: CoordinatorHooks;
  #queue: Promise<unknown> = Promise.resolve();

  constructor(initialState: RoomState, initialRevision = 0, hooks: CoordinatorHooks = {}) {
    this.#state = structuredClone(initialState);
    this.#revision = initialRevision;
    this.#hooks = hooks;
  }

  get state(): RoomState {
    return this.#state;
  }

  get revision(): number {
    return this.#revision;
  }

  get subscriberCount(): number {
    return this.#clients.size;
  }

  connect(client: WebSocketClient, viewer: ViewerIdentity, now = Date.now()): RoomEnvelope {
    this.#clients.set(client, viewer);
    const snapshot = viewerSnapshot(this.#state, this.#revision, viewer, now);
    client.send(JSON.stringify({ type: 'room:snapshot', ...snapshot }));
    return snapshot;
  }

  disconnect(client: WebSocketClient) {
    this.#clients.delete(client);
  }

  /**
   * Serialises a mutation through the single-actor queue, increments revision
   * when the state changes, updates the next alarm, persists, and broadcasts
   * role-scoped snapshots to all connected WebSocket clients.
   */
  mutate<T>(fn: (state: RoomState) => Promise<T> | T): Promise<T> {
    const task = this.#queue.then(async () => {
      const result = await fn(this.#state);
      if (this.#state.status === 'auction') {
        settleBot(this.#state);
      }
      this.#revision += 1;
      await this.#syncPersistenceAndAlarm();
      this.broadcast();
      return result;
    });
    this.#queue = task.catch(() => {});
    return task;
  }

  /**
   * Invoked when the Durable Object alarm fires.
   */
  alarm(): Promise<{ changed: boolean; nextAlarm: number | null }> {
    const task = this.#queue.then(async () => {
      const outcome = tickRoomAlarm(this.#state);
      if (outcome.changed) {
        this.#revision += 1;
        await this.#syncPersistenceAndAlarm();
        this.broadcast();
      } else if (this.#hooks.onScheduleAlarm) {
        await this.#hooks.onScheduleAlarm(outcome.nextAlarm);
      }
      return outcome;
    });
    this.#queue = task.catch(() => {});
    return task;
  }

  broadcast(now = Date.now()) {
    for (const [client, viewer] of this.#clients.entries()) {
      const latestMember = viewer.memberId ? this.#state.members.find((m) => m.id === viewer.memberId) : undefined;
      const effectiveViewer: ViewerIdentity = {
        isHost: viewer.isHost,
        memberId: viewer.memberId,
        approved: viewer.isHost || Boolean(latestMember?.approved),
      };
      this.#clients.set(client, effectiveViewer);
      try {
        const snapshot = viewerSnapshot(this.#state, this.#revision, effectiveViewer, now);
        client.send(JSON.stringify({ type: 'room:snapshot', ...snapshot }));
      } catch {
        this.#clients.delete(client);
      }
    }
  }

  async #syncPersistenceAndAlarm() {
    if (this.#hooks.onPersist) {
      await this.#hooks.onPersist(this.#state, this.#revision);
    }
    if (this.#hooks.onScheduleAlarm) {
      await this.#hooks.onScheduleAlarm(nextRoomAlarm(this.#state));
    }
  }
}
