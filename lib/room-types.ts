import {
  FORMATIONS,
  RATING_TIERS,
  type AuctionLot,
  type BotStyle,
  type Era,
  type Footballer,
  type Formation,
  type Manager,
  type QualityMode,
  type RatingTier,
} from './game-engine.ts';
import type { CustomPoolSelection } from './club-leagues.ts';

export type RoomMember = {
  id: string;
  name: string;
  role: 'manager' | 'spectator';
  approved: boolean;
  isBot?: boolean;
  botStyle?: BotStyle;
  leaderboardOptIn?: boolean;
  leaderboardAlias?: string;
  /** Derived band only — the declared birth year is never stored. */
  ageBand?: 'adult' | 'minor' | 'unknown';
  /** Which information text was accepted and when (KVKK traceability). */
  consent?: { policyVersion: string; acceptedAt: number; ageBand: 'adult' | 'minor' | 'unknown' };
};
export type RoomSettings = {
  era: Era;
  quality: QualityMode;
  revealRatings: boolean;
  selectedTiers: RatingTier[];
  auctionMode?: 'live' | 'manual';
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
};
export type RoomState = {
  code: string;
  status: 'lobby' | 'auction' | 'results';
  settings: RoomSettings;
  members: RoomMember[];
  createdAt: number;
  completedAt?: number;
  autoCompleted?: boolean;
  recentLotIds?: string[];
  chat?: Array<{ id: string; memberId: string; name: string; text: string; at: number }>;
  season?: {
    round: number;
    length: number;
    standings: Record<string, { name: string; points: number; wins: number; totalScore: number }>;
  };
  game?: {
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
    nextBotAt?: number;
    feed: string[];
    audit?: string[];
    stage?: 'primary' | 'secondChance' | 'coach';
    unsold?: AuctionLot[];
    undo?: string;
    undoStatus?: 'auction' | 'results';
    publicMeta?: {
      currentIsBonus: boolean;
      currentPassIsSafe: boolean;
      groupOrdinal: number;
      totalLots: number;
      canUndo: boolean;
      nextGroupLabel?: string;
    };
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
  };
};
export class RoomError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'RoomError';
    this.code = code;
    this.status = status;
  }
}
export function normalizedSettings(settings: RoomSettings) {
  const tiers = Array.isArray(settings.selectedTiers)
      ? settings.selectedTiers.filter((tier): tier is RatingTier => RATING_TIERS.includes(tier))
      : [],
    scenario = ['hidden-gems', 'stars-and-scrubs', 'budget-crunch', 'speed-auction'].includes(settings.scenarioId || '')
      ? settings.scenarioId!
      : 'classic',
    selectedTiers: RatingTier[] = tiers.length ? tiers : RATING_TIERS,
    customPlayerIds = Array.isArray(settings.customPlayerIds)
      ? [...new Set(settings.customPlayerIds.filter((id) => /^[A-Z0-9]+:\d+$/i.test(id)).slice(0, 200))]
      : [],
    customPoolSelections = Array.isArray(settings.customPoolSelections)
      ? settings.customPoolSelections
          .filter((item): item is CustomPoolSelection =>
            Boolean(
              item && ['club', 'league'].includes(item.type) && typeof item.name === 'string' && item.name.length < 100,
            ),
          )
          .slice(0, 20)
      : [];
  return {
    era: settings.era === 'legends' ? 'legends' : 'current',
    quality: 'all',
    revealRatings: scenario === 'hidden-gems' ? false : Boolean(settings.revealRatings),
    selectedTiers,
    auctionMode: settings.auctionMode === 'manual' ? 'manual' : 'live',
    includeBench: Boolean(settings.includeBench),
    timerSeconds:
      scenario === 'speed-auction'
        ? 10
        : [10, 15, 20, 30].includes(settings.timerSeconds || 0)
          ? settings.timerSeconds
          : 20,
    bidIncrement: [5, 10, 25].includes(settings.bidIncrement || 0) ? settings.bidIncrement : 5,
    secondChance: Boolean(settings.secondChance),
    seasonLength: [1, 3, 5].includes(settings.seasonLength || 0) ? settings.seasonLength : 1,
    scenarioId: scenario,
    formation: FORMATIONS.includes(settings.formation || '4-2-3-1') ? settings.formation : '4-2-3-1',
    poolMode: settings.poolMode === 'custom' ? 'custom' : 'generated',
    customPlayerIds,
    customPoolSelections,
  } satisfies RoomSettings;
}
export const defaultSettings: RoomSettings = {
  era: 'current',
  quality: 'all',
  revealRatings: false,
  selectedTiers: RATING_TIERS,
  auctionMode: 'live',
  includeBench: false,
  timerSeconds: 20,
  bidIncrement: 5,
  secondChance: false,
  seasonLength: 1,
  scenarioId: 'classic',
  formation: '4-2-3-1',
  poolMode: 'generated',
  customPlayerIds: [],
  customPoolSelections: [],
};
