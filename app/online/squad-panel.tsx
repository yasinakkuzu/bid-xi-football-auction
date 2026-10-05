'use client';
/* Remote player photos are optional enhancements; a letter placeholder keeps the card readable when they fail. */
/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import { BENCH_SLOTS, FORMATION_POSITIONS, SLOT_KEYS, type Manager } from '../../lib/game-engine';
import { coordinates, money } from './view-types';

export function PlayerImage({ player, className }: { player: { name: string; image?: string }; className: string }) {
  const [failedUrl, setFailedUrl] = useState<string | undefined>();
  if (!player.image || failedUrl === player.image)
    return (
      <span
        className={`${className} player-image-placeholder`}
        role="img"
        aria-label={`${player.name} için fotoğraf bulunamadı`}
      >
        {player.name[0]?.toUpperCase() || '?'}
      </span>
    );
  return (
    <img
      className={className}
      src={player.image}
      alt={`${player.name} fotoğrafı`}
      width="240"
      height="300"
      loading={className.includes('online-player-photo') ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(player.image)}
    />
  );
}

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
      <div className="online-squad-formation" aria-label={`${manager.name} kadro dizilimi`}>
        <span className="online-halfway" />
        <span className="online-center-circle" />
        {SLOT_KEYS.map((slot) => {
          const player = manager.squad[slot];
          return (
            <div
              className={`online-formation-player ${player ? 'filled' : ''}`}
              style={
                (manager.formation && manager.formation !== '4-2-3-1'
                  ? FORMATION_POSITIONS[manager.formation]
                  : coordinates)[slot]
              }
              key={slot}
            >
              {player ? (
                <>
                  <PlayerImage player={player} className="squad-player-photo" />
                  <b>{player.name}</b>
                  <small>
                    {slot} · {player.rating.toFixed(1)} puan
                  </small>
                </>
              ) : (
                <>
                  <span>{slot}</span>
                  <b>Boş</b>
                </>
              )}
            </div>
          );
        })}
      </div>
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
                    <small>{player.club || player.role}</small>
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
