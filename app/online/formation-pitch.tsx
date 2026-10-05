'use client';
/**
 * The formation pitch is shared by the full squad screen, the manager drawer and the
 * live auction's squad rail. `compact` renders the same slots as small dots for the
 * narrow rail instead of the full photo cards.
 */

import { FORMATION_POSITIONS, SLOT_KEYS, type Manager } from '../../lib/game-engine';
import { PlayerImage } from './player-image';
import { coordinates } from './view-types';

export function FormationPitch({ manager, compact = false }: { manager: Manager; compact?: boolean }) {
  const formation =
    manager.formation && manager.formation !== '4-2-3-1' ? FORMATION_POSITIONS[manager.formation] : coordinates;
  const filled = Object.keys(manager.squad).length;
  return (
    <div
      className={`online-squad-formation ${compact ? 'mz-pitch mz-pitch--compact' : ''}`}
      aria-label={`${manager.name} kadro dizilimi: 11 pozisyondan ${filled} tanesi dolu`}
    >
      <span className="online-halfway" />
      <span className="online-center-circle" />
      {SLOT_KEYS.map((slot) => {
        const player = manager.squad[slot];
        if (compact)
          return (
            <div
              className={`online-formation-player ${player ? 'filled' : ''}`}
              style={formation[slot]}
              key={slot}
              title={player ? `${slot} · ${player.name}` : `${slot} boş`}
            >
              {player ? <b>{slot}</b> : <span>{slot}</span>}
            </div>
          );
        return (
          <div className={`online-formation-player ${player ? 'filled' : ''}`} style={formation[slot]} key={slot}>
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
  );
}
