'use client';
/**
 * The formation pitch is shared by the full squad screen, the manager drawer and the
 * live auction's squad rail. `compact` renders the same slots as small dots for the
 * narrow rail instead of the full photo cards.
 */

import { FORMATION_POSITIONS, SLOT_KEYS, type Manager } from '../../lib/game-engine';
import { computePitchChemistry, nationFlag } from '../../lib/player-card-flair';
import { PlayerImage } from './player-image';
import { coordinates } from './view-types';

export function FormationPitch({ manager, compact = false }: { manager: Manager; compact?: boolean }) {
  const formationKey = manager.formation || '4-2-3-1';
  const formation =
    manager.formation && manager.formation !== '4-2-3-1' ? FORMATION_POSITIONS[manager.formation] : coordinates;
  const filled = Object.keys(manager.squad).length;
  const chemistry = computePitchChemistry(manager.squad, formationKey, manager.coach);
  return (
    <div
      className={`online-squad-formation ${compact ? 'mz-pitch mz-pitch--compact' : ''}`}
      aria-label={`${manager.name} kadro dizilimi: 11 pozisyondan ${filled} tanesi dolu, kimya uyumu %${chemistry.score}`}
    >
      <span className="online-halfway" />
      <span className="online-center-circle" />
      {chemistry.links.length > 0 && (
        <svg className="mz-chemistry-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {chemistry.links.map((link) => (
            <line
              key={`${link.from}-${link.to}`}
              x1={link.x1}
              y1={link.y1}
              x2={link.x2}
              y2={link.y2}
              className={`mz-chem-line mz-chem-line--${link.strength}`}
            />
          ))}
        </svg>
      )}
      {filled >= 2 && (
        <div
          className="mz-chemistry-badge"
          title={chemistry.links.map((l) => `${l.from}–${l.to}: ${l.reason}`).join(' · ') || chemistry.label}
        >
          <span>⚡ KİMYA %{chemistry.score}</span>
          {!compact && <small>{chemistry.label}</small>}
        </div>
      )}
      {SLOT_KEYS.map((slot) => {
        const player = manager.squad[slot];
        if (compact)
          return (
            <div
              className={`online-formation-player ${player ? 'filled' : ''}`}
              style={formation[slot]}
              key={slot}
              title={player ? `${slot} · ${player.name} (${player.club || player.nation})` : `${slot} boş`}
            >
              {player ? <b>{slot}</b> : <span>{slot}</span>}
            </div>
          );
        return (
          <div className={`online-formation-player ${player ? 'filled' : ''}`} style={formation[slot]} key={slot}>
            {player ? (
              <>
                <PlayerImage player={player} className="squad-player-photo" />
                <b>
                  <span aria-hidden="true">{nationFlag(player.nation)} </span>
                  {player.name}
                </b>
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
  );
}
