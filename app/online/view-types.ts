/** Shared view models and presentation helpers for the online room UI. */
import type { AgeBand } from '../../lib/age-policy';
import type { CustomPoolSelection } from '../../lib/club-leagues';
import {
  FORMATION_POSITIONS,
  type AuctionLot,
  type Footballer,
  type Formation,
  type Manager,
  type RatingTier,
  type Slot,
} from '../../lib/game-engine';

export type Member = {
  id: string;
  name: string;
  role: 'manager' | 'spectator';
  approved: boolean;
  isBot?: boolean;
  botStyle?: 'balanced' | 'aggressive' | 'value';
};

export type AuctionMode = 'live' | 'manual';

export type Settings = {
  era: 'current' | 'legends';
  quality: 'best' | 'all';
  revealRatings: boolean;
  selectedTiers: RatingTier[];
  auctionMode?: AuctionMode;
  includeBench?: boolean;
  timerSeconds?: 10 | 15 | 20 | 30;
  bidIncrement?: 5 | 10 | 25;
  secondChance?: boolean;
  seasonLength?: 1 | 3 | 5;
  scenarioId?: 'classic' | 'hidden-gems' | 'stars-and-scrubs' | 'budget-crunch' | 'speed-auction';
  formation?: Formation;
  poolMode?: 'generated' | 'custom';
  customPlayerIds?: string[];
  customPoolSelections?: CustomPoolSelection[];
  managerCountHint?: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  leaderboardOptIn?: boolean;
  leaderboardAlias?: string;
};

export type Game = {
  managers: Manager[];
  pool: AuctionLot[];
  index: number;
  bid: number;
  leader: number | null;
  passed: number[];
  activeTurn: number | null;
  paused: boolean;
  deadline: number | null;
  feed: string[];
  audit?: string[];
  undo?: string;
  bonusReveal?: { name: string; rating: number; role: string; image?: string };
  lastSold?: {
    lotId: string;
    playerName: string;
    role: string;
    managerId: number;
    managerName: string;
    amount: number;
    at: number;
  };
  autoAssignments?: Array<{ managerName: string; player: Footballer; fee: number }>;
  pausedRemainingMs?: number;
  publicMeta?: {
    currentIsBonus: boolean;
    currentPassIsSafe: boolean;
    groupOrdinal: number;
    totalLots: number;
    canUndo: boolean;
    nextGroupLabel?: string;
  };
};

export type Room = {
  code: string;
  status: 'lobby' | 'auction' | 'results';
  settings: Settings;
  members: Member[];
  game?: Game;
  chat?: Array<{ id: string; memberId: string; name: string; text: string; at: number }>;
  season?: {
    round: number;
    length: number;
    standings: Record<string, { name: string; points: number; wins: number; totalScore: number }>;
  };
};

export type Session = { code: string; token: string; memberToken?: string; name?: string; ageBand?: AgeBand };

export const money = (n: number) => `$${n}M`;

export const auctionFormationPoint = (formation: Formation, slot: Slot) => {
  const point = FORMATION_POSITIONS[formation][slot];
  return { left: `${Math.max(6, Math.min(94, 100 - Number.parseFloat(point.top)))}%`, top: point.left };
};

/**
 * Session keys deliberately keep the historical `bidxi-` prefix after the
 * rebrand to Mezat 11: saved room sessions, in-progress games and local error
 * logs live under these keys, so renaming them would silently discard user data.
 */
export const roomSessionKey = (roomCode: string) => `bidxi-room:${roomCode.toUpperCase()}`;

export const coordinates: Record<Slot, { left: string; top: string }> = {
  GK: { left: '50%', top: '91%' },
  RB: { left: '82%', top: '72%' },
  CB1: { left: '61%', top: '77%' },
  CB2: { left: '39%', top: '77%' },
  LB: { left: '18%', top: '72%' },
  DM: { left: '36%', top: '57%' },
  CM: { left: '64%', top: '57%' },
  AM: { left: '50%', top: '32%' },
  RW: { left: '82%', top: '32%' },
  LW: { left: '18%', top: '32%' },
  ST: { left: '50%', top: '13%' },
};
