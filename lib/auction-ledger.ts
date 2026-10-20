import type { AuctionLot } from './game-engine.ts';
import type { RoomState } from './room-types.ts';

export type RecentSale = { key: string; playerName: string; managerName: string; amount?: number };

const saleLine = /^(.+?), (.+) takımına \$(\d+)M karşılığında katıldı\.$/;

function paidAmountsFromFeed(feed: string[] = []) {
  const amounts = new Map<string, number>();
  for (const line of feed) {
    const match = saleLine.exec(line);
    if (!match) continue;
    const key = `${match[1]}|${match[2]}`;
    if (!amounts.has(key)) amounts.set(key, Number(match[3]));
  }
  return amounts;
}

type LedgerGame = Pick<NonNullable<RoomState['game']>, 'managers' | 'pool' | 'index' | 'feed' | 'publicMeta'>;

function lotOwners(game: LedgerGame) {
  const owners = new Map<string, { managerName: string; paidPrice?: number }>();
  for (const manager of game.managers) {
    const lots = [
      ...Object.values(manager.squad || {}),
      ...Object.values(manager.bench || {}),
      ...(manager.coach ? [manager.coach] : []),
    ].filter((lot): lot is AuctionLot => Boolean(lot));
    for (const lot of lots) owners.set(lot.id, { managerName: manager.name, paidPrice: lot.paidPrice });
  }
  return owners;
}

export function lotOwnerName(game: LedgerGame, lotId: string) {
  return lotOwners(game).get(lotId)?.managerName;
}

export function recentSales(game: LedgerGame, limit = 6): RecentSale[] {
  const amounts = paidAmountsFromFeed(game.feed),
    owners = lotOwners(game),
    sales: RecentSale[] = [];
  for (let index = Math.min(game.index, game.pool.length) - 1; index >= 0 && sales.length < limit; index -= 1) {
    const lot = game.pool[index],
      owned = owners.get(lot.id);
    if (!owned) continue;
    const amount = owned.paidPrice ?? lot.paidPrice ?? amounts.get(`${lot.name}|${owned.managerName}`);
    sales.push({ key: lot.id, playerName: lot.name, managerName: owned.managerName, amount });
  }
  return sales;
}

export function remainingLotCount(game: LedgerGame) {
  const total = game.publicMeta?.totalLots ?? game.pool.length;
  return Math.max(0, total - game.index - 1);
}
