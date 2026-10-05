'use client';
/**
 * Third column of the auction table: the bidding manager's own squad at a glance.
 * It reuses the shared formation pitch (compact mode) plus the budget and the
 * filled-slot count, so the full "Kadrom" tab keeps owning the detailed view.
 */

import type { Manager } from '../../lib/game-engine';
import { FormationPitch } from './formation-pitch';
import { money } from './view-types';

export function SquadRail({ manager }: { manager: Manager }) {
  const filled = Object.keys(manager.squad).length,
    benchFilled = manager.bench ? Object.keys(manager.bench).length : 0;
  return (
    <section className="mz-rail-card" aria-label={`${manager.name} kadro özeti`}>
      <header className="mz-rail-card__head">
        <p className="eyebrow">SENİN KADRON · {manager.formation || '4-2-3-1'}</p>
        <h2>{manager.name}</h2>
      </header>
      <FormationPitch manager={manager} compact />
      <div className="mz-rail-stats">
        <div>
          <small>KALAN BÜTÇE</small>
          <strong>{money(manager.budget)}</strong>
        </div>
        <div>
          <small>KADRO</small>
          <strong>
            {filled}
            <span>/11</span>
          </strong>
        </div>
        {manager.bench ? (
          <div>
            <small>YEDEK</small>
            <strong>
              {benchFilled}
              <span>/4</span>
            </strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}
