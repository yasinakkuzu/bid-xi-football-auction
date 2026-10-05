'use client';
/**
 * Lot ledger below the lot card (item 5 of the auction-table restructure).
 *
 * What the client can honestly know:
 * - Completed lots (`index` and earlier) keep their real identity in the public room
 *   state and every bought lot still points at the pool lot it was awarded from, so
 *   "who bought whom" is derived from real game state.
 * - The paid amount is *not* stored per player on the client. The only record of a
 *   price is the live feed line (`X, Y takımına $34M karşılığında katıldı.`), which is
 *   capped at the last 8 messages. The strip therefore prints the price only while
 *   that feed line is still visible.
 * - Upcoming lots are redacted server-side (`lib/auction-runtime.ts` replaces them with
 *   `hidden-N` / "Gizli lot" placeholders), so the strip renders honest generic
 *   "Gizli lot" pills for the remaining lot count instead of inventing identities.
 */

import type { AuctionLot } from '../../lib/game-engine';
import { money, type Game } from './view-types';

export type RecentSale = { key: string; playerName: string; managerName: string; amount?: number };

const saleLine = /^(.+?), (.+) takımına \$(\d+)M karşılığında katıldı\.$/;

function paidAmounts(feed: string[] = []) {
  const amounts = new Map<string, number>();
  for (const line of feed) {
    const match = saleLine.exec(line);
    if (!match) continue;
    const key = `${match[1]}|${match[2]}`;
    if (!amounts.has(key)) amounts.set(key, Number(match[3]));
  }
  return amounts;
}

function lotOwners(game: Game) {
  const owners = new Map<string, string>();
  for (const manager of game.managers) {
    const lots = [
      ...Object.values(manager.squad || {}),
      ...Object.values(manager.bench || {}),
      ...(manager.coach ? [manager.coach] : []),
    ].filter((lot): lot is AuctionLot => Boolean(lot));
    for (const lot of lots) owners.set(lot.id, manager.name);
  }
  return owners;
}

/**
 * Name of the manager who owns this lot id, if any. A lot that a manager already
 * holds was awarded for real, which is the only client-side proof that a sale
 * happened (the auction itself advances to the next lot in the same action).
 */
export function lotOwnerName(game: Game, lotId: string) {
  return lotOwners(game).get(lotId);
}

/** Most recently sold lots, newest first, derived from the pool order and squad ownership. */
export function recentSales(game: Game, limit = 6): RecentSale[] {
  const amounts = paidAmounts(game.feed),
    owners = lotOwners(game),
    sales: RecentSale[] = [];
  for (let index = Math.min(game.index, game.pool.length) - 1; index >= 0 && sales.length < limit; index -= 1) {
    const lot = game.pool[index],
      managerName = owners.get(lot.id);
    if (!managerName) continue;
    sales.push({ key: lot.id, playerName: lot.name, managerName, amount: amounts.get(`${lot.name}|${managerName}`) });
  }
  return sales;
}

export function remainingLotCount(game: Game) {
  const total = game.publicMeta?.totalLots ?? game.pool.length;
  return Math.max(0, total - game.index - 1);
}

export function LotLedger({ game }: { game: Game }) {
  const sales = recentSales(game),
    remaining = remainingLotCount(game),
    preview = Math.min(remaining, 4);
  return (
    <section className="mz-ledger" aria-label="Satılan ve sıradaki lotlar">
      <div className="mz-ledger__block">
        <p className="eyebrow">SON SATILANLAR</p>
        {sales.length ? (
          <ul className="mz-ledger__sales">
            {sales.map((sale) => (
              <li key={sale.key}>
                <b>{sale.playerName}</b>
                <span aria-hidden="true">→</span>
                <em>{sale.managerName}</em>
                {typeof sale.amount === 'number' ? <strong>{money(sale.amount)}</strong> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mz-ledger__empty">Henüz satış yok.</p>
        )}
      </div>
      <div className="mz-ledger__block mz-ledger__block--upcoming">
        <p className="eyebrow">SIRADAKİ</p>
        <ul className="mz-ledger__upcoming">
          {Array.from({ length: preview }, (_, index) => (
            <li className="mz-lot-pill" key={`upcoming-${index}`}>
              Gizli lot
            </li>
          ))}
          {remaining > preview ? <li className="mz-lot-pill mz-lot-pill--more">+{remaining - preview}</li> : null}
          {!remaining ? <li className="mz-ledger__empty">Sırada lot yok.</li> : null}
        </ul>
      </div>
    </section>
  );
}
