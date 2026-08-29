import {canPlaceLotBid, type AuctionLot, type Manager} from './game-engine.ts';

export const LOT_SCOPED_ACTIONS = ['bid', 'pass', 'sell', 'close', 'skip', 'reopen', 'manualSell', 'manualSkip'] as const;

export function currentLotId(game: {pool: AuctionLot[]; index: number} | undefined) {
  return game?.pool[game.index]?.id;
}

export function validateLotAction(type: string, lotId: unknown, game: {pool: AuctionLot[]; index: number} | undefined) {
  if (!(LOT_SCOPED_ACTIONS as readonly string[]).includes(type)) return;
  if (typeof lotId !== 'string' || !lotId) throw new Error('LOT_ID_REQUIRED');
  if (lotId !== currentLotId(game)) throw new Error('STALE_LOT');
}

type ReopenableGame = {
  managers: Manager[];
  pool: AuctionLot[];
  index: number;
  bid: number;
  leader: number | null;
  passed: number[];
  activeTurn: number | null;
  paused: boolean;
  pausedRemainingMs?: number;
  deadline: number | null;
};

export function reopenLiveLot(game: ReopenableGame, timerSeconds: number, now = Date.now()) {
  const lot = game.pool[game.index];
  if (!lot || game.activeTurn !== null || game.leader === null) return false;
  game.passed = [];
  const offer = game.bid + 1;
  const challenger = game.managers.findIndex((manager, index) => index !== game.leader && canPlaceLotBid(manager, lot, offer, index, game.passed));
  if (challenger < 0) return false;
  game.activeTurn = challenger;
  game.deadline = now + timerSeconds * 1000;
  game.paused = false;
  game.pausedRemainingMs = undefined;
  return true;
}
