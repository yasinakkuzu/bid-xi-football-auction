'use client';

import { BENCH_SLOTS, SLOT_KEYS, type Manager } from '../../lib/game-engine';
import { FormationPitch } from './formation-pitch';
import { PlayerImage } from './player-image';
import { money } from './view-types';

export function SquadPanel({ manager, compact = false }: { manager: Manager; compact?: boolean }) {
  return (
    <section className={`online-squad-panel ${compact ? 'compact' : ''}`}>
      <div className="online-squad-summary">
        <div>
          <p className="eyebrow">{manager.formation || '4-2-3-1'} KADRO</p>
          <h2>{manager.name}</h2>
        </div>
        <div>
          <small>KALAN BÜTÇE</small>
          <strong>{money(manager.budget)}</strong>
          <span>
            {Object.keys(manager.squad).length}/11 oyuncu{' '}
            {manager.bench ? `· ${Object.keys(manager.bench).length}/4 yedek` : ''}
          </span>
        </div>
      </div>
      <FormationPitch manager={manager} />
      <div className="online-squad-list">
        {SLOT_KEYS.map((slot) => {
          const player = manager.squad[slot];
          return (
            <article key={slot}>
              <span>{slot}</span>
              {player ? (
                <>
                  <PlayerImage player={player} className="squad-list-photo" />
                  <div>
                    <b>{player.name}</b>
                    <small>
                      {player.club || player.role}
                      {typeof player.paidPrice === 'number' ? ` · ${money(player.paidPrice)}` : ''}
                    </small>
                  </div>
                  <em>{player.rating}</em>
                </>
              ) : (
                <div>
                  <b>Henüz boş</b>
                  <small>{slot}</small>
                </div>
              )}
            </article>
          );
        })}
        {manager.bench &&
          BENCH_SLOTS.map((group) => {
            const player = manager.bench?.[group.key];
            return (
              <article className="bench-row" key={group.key}>
                <span>{group.short}</span>
                {player ? (
                  <>
                    <PlayerImage player={player} className="squad-list-photo" />
                    <div>
                      <b>{player.name}</b>
                      <small>
                        {group.label} · {player.club || player.role}
                        {typeof player.paidPrice === 'number' ? ` · ${money(player.paidPrice)}` : ''}
                      </small>
                    </div>
                    <em>{player.rating}</em>
                  </>
                ) : (
                  <div>
                    <b>Henüz boş</b>
                    <small>{group.label}</small>
                  </div>
                )}
              </article>
            );
          })}
        {manager.coach ? (
          <article className="coach-row">
            <span>TD</span>
            <div>
              <b>{manager.coach.name}</b>
              <small>
                {manager.coach.preferredFormation} · Taktik {manager.coach.tactics} · Motivasyon{' '}
                {manager.coach.motivation}
                {typeof manager.coach.paidPrice === 'number' ? ` · ${money(manager.coach.paidPrice)}` : ''}
              </small>
            </div>
            <em>{manager.coach.rating}</em>
          </article>
        ) : (
          <article className="coach-row">
            <span>TD</span>
            <div>
              <b>Teknik direktör bekleniyor</b>
              <small>Oyuncu kadroları tamamlandıktan sonra</small>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
