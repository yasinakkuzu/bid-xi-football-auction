'use client';

import { useState } from 'react';
import { auctionPassIsSafe, isCoach, lotFilled, type AuctionLot, type Manager } from '../../lib/game-engine';
import { money, type Game } from './view-types';

export function ManualControls({
  game,
  current,
  busy,
  onAction,
}: {
  game: Game;
  current: AuctionLot;
  busy: boolean;
  onAction: (type: string, payload?: Record<string, unknown>) => Promise<boolean>;
}) {
  const eligible = (manager: Manager) => !lotFilled(manager, current);
  const first = game.managers.findIndex(eligible);
  const triggersFallback =
    !isCoach(current) &&
    !(game.publicMeta?.currentPassIsSafe ?? auctionPassIsSafe(game.pool, game.index, game.managers));
  const [managerIndex, setManagerIndex] = useState(first >= 0 ? String(first) : '');
  const [amount, setAmount] = useState(String(current.price));
  return (
    <div className="manual-controls">
      <select
        value={managerIndex}
        onChange={(event) => setManagerIndex(event.target.value)}
        aria-label={`${isCoach(current) ? 'Teknik direktörü' : 'Oyuncuyu'} alacak menajer`}
      >
        {game.managers.map((manager, index) => (
          <option value={index} disabled={!eligible(manager)} key={manager.id}>
            {manager.name} · {money(manager.budget)}
          </option>
        ))}
      </select>
      <div>
        <input
          type="number"
          min="5"
          step="1"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          aria-label="Satış tutarı"
        />
        <span>M</span>
      </div>
      <button
        className="manual-award"
        disabled={busy || managerIndex === ''}
        onClick={() =>
          onAction('manualSell', {
            managerIndex: Number(managerIndex),
            amount: Number(amount),
          })
        }
      >
        {isCoach(current) ? 'Teknik direktörü ata' : 'Oyuncuyu ata'}
      </button>
      <button disabled={busy} onClick={() => onAction('manualSkip')}>
        {triggersFallback ? 'Geç · eksikleri otomatik tamamla' : 'Satılmadı · Geç'}
      </button>
      <button
        className="undo-action"
        disabled={busy || !(game.publicMeta?.canUndo ?? Boolean(game.undo))}
        onClick={() => onAction('undo')}
      >
        ↶ Geri al
      </button>
    </div>
  );
}
