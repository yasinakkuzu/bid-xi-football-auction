'use client';
/**
 * Lot ledger below the lot card (item 5 of the auction-table restructure).
 *
 * Completed lots keep their real identity and `paidPrice` in the public room
 * state, while upcoming lots are redacted server-side (`hidden-N` / "Gizli lot").
 */

import { lotOwnerName, recentSales, remainingLotCount, type RecentSale } from '../../lib/auction-ledger';
import { money, type Game } from './view-types';

export { lotOwnerName, recentSales, remainingLotCount, type RecentSale };

export function LotLedger({ game }: { game: Game }) {
  const sales = recentSales(game),
    remaining = remainingLotCount(game),
    preview = Math.min(remaining, 4);
  return (
    <section className="mz-ledger" aria-label="Satılan ve sıradaki lotlar">
      <div className="mz-ledger__block">
        <p className="eyebrow">SON SATILANLAR</p>
        {sales.length ? (
          <ul className="mz-ledger__sales" role="list">
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
        <ul className="mz-ledger__upcoming" role="list">
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
