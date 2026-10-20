import {
  auctionGroupKey,
  auctionOpeningPrice,
  botMaximumBid,
  canPlaceLotBid,
  hashSeed,
  seededRandom,
  type AuctionLot,
  type BotStyle,
  type Manager,
} from './game-engine.ts';

export type SoloBotProfile = {
  name: string;
  style: BotStyle;
  title: string;
  badge: string;
};

export const SOLO_BOT_PROFILES: ReadonlyArray<SoloBotProfile> = [
  { name: 'AI Taktik Deha', style: 'balanced', title: 'Dengeli Stratejist', badge: 'Dengeli' },
  { name: 'AI Bonkör Başkan', style: 'aggressive', title: 'Yıldız Avcısı', badge: 'Agresif' },
  { name: 'AI Moneyball', style: 'value', title: 'Fiyat/Performans Uzmanı', badge: 'Fırsatçı' },
  { name: 'AI Kurt Hoca', style: 'balanced', title: 'Tecrübeli Taktisyen', badge: 'Dengeli' },
  { name: 'AI Cesur Hücum', style: 'aggressive', title: 'Hücum Tutkunu', badge: 'Agresif' },
  { name: 'AI Kasa Muhafızı', style: 'value', title: 'Disiplinli Ekonomist', badge: 'Fırsatçı' },
  { name: 'AI Şampiyonlar', style: 'balanced', title: 'Turnuva Uzmanı', badge: 'Dengeli' },
];

/** Builds the manager name list for Solo AI mode (index 0 is the human player, 1..count-1 are AI bots). */
export function buildSoloManagerNames(humanName: string, totalCount: number): string[] {
  const safeCount = Math.max(2, Math.min(8, totalCount));
  const cleanHuman = humanName.trim() || 'Sen (Menajer)';
  const bots = SOLO_BOT_PROFILES.slice(0, safeCount - 1).map((profile) => profile.name);
  return [cleanHuman, ...bots];
}

/** Returns the AI personality style for a given manager index in Solo mode. */
export function soloBotStyleForIndex(managerIndex: number): BotStyle {
  if (managerIndex <= 0) return 'balanced';
  return SOLO_BOT_PROFILES[(managerIndex - 1) % SOLO_BOT_PROFILES.length]?.style || 'balanced';
}

/**
 * Decides whether the active AI manager in Solo turn-based mode should place a bid or pass.
 * Returns `{ action: 'bid', increment }` (`0` for opening bid, `5 | 10 | 25` for raise) or `{ action: 'pass' }`.
 */
export function decideSoloBotTurn(params: {
  managers: Manager[];
  pool: AuctionLot[];
  index: number;
  bid: number;
  leader: number | null;
  passed: number[];
  botIndex: number;
  style?: BotStyle;
  seed?: string;
}): { action: 'bid'; increment: 0 | 5 | 10 | 25 } | { action: 'pass' } {
  const { managers, pool, index, bid, leader, passed, botIndex } = params;
  const manager = managers[botIndex];
  const lot = pool[index];
  if (!manager || !lot) return { action: 'pass' };

  const style = params.style || soloBotStyleForIndex(botIndex);
  const seed = params.seed || 'solo';
  const openingPrice = auctionOpeningPrice(lot, managers);
  const nextMinOffer = leader === null ? openingPrice : bid + 5;

  if (leader === manager.id || !canPlaceLotBid(manager, lot, nextMinOffer, manager.id, passed)) {
    return { action: 'pass' };
  }

  const groupKey = auctionGroupKey(lot);
  const remainingLotsForGroup = pool.slice(index).filter((p) => auctionGroupKey(p) === groupKey).length;
  const maxBid = botMaximumBid({ ...manager, botStyle: style }, lot, `${seed}-solo-${lot.id}-${manager.id}`, false, {
    remainingLotsInGroup: remainingLotsForGroup,
    lotIndex: index,
    totalLots: pool.length,
  });
  const random = seededRandom(hashSeed(`${seed}-turn-${lot.id}-${manager.id}-${bid}`));

  if (leader === null) {
    if (maxBid >= openingPrice || remainingLotsForGroup <= 1 || random() < 0.42) {
      return { action: 'bid', increment: 0 };
    }
    return { action: 'pass' };
  }

  if (nextMinOffer > maxBid) {
    return { action: 'pass' };
  }

  const headroom = maxBid - bid;
  if (style === 'aggressive' && headroom >= 35 && canPlaceLotBid(manager, lot, bid + 25, manager.id, passed)) {
    return { action: 'bid', increment: 25 };
  }
  if (headroom >= 18 && random() < 0.45 && canPlaceLotBid(manager, lot, bid + 10, manager.id, passed)) {
    return { action: 'bid', increment: 10 };
  }
  return { action: 'bid', increment: 5 };
}
