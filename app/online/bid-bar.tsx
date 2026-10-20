'use client';
/**
 * The single auction action bar (item 1 of the auction-table restructure).
 *
 * Row layout on wide screens: [timer ring] [current bid hero] [increment buttons + primary + pass].
 * The custom "Elle teklif" form sits on its own line inside the same bar. On narrow
 * screens `theme-auction.css` pins the ring + hero + controls to the bottom of the
 * viewport (`.mz-mobile-dock`), while the form stays in the document flow.
 *
 * No new actions are introduced: every button calls the same `bid` / `pass` actions
 * the previous markup used.
 */

import { auctionOpeningPrice, type AuctionLot, type Manager } from '../../lib/game-engine';
import { ManualControls } from './manual-controls';
import { money, type AuctionMode, type Game } from './view-types';
import type { CSSProperties } from 'react';

export function BidTimerRing({
  deadline,
  remaining,
  totalSeconds,
  paused,
}: {
  deadline: number | null;
  remaining: number;
  totalSeconds: number;
  paused: boolean;
}) {
  const showSeconds = Boolean(deadline) || (paused && remaining > 0),
    ratio = showSeconds ? Math.max(0, Math.min(1, remaining / Math.max(1, totalSeconds))) : 0,
    critical = Boolean(deadline) && !paused && remaining > 0 && remaining <= 5,
    expired = Boolean(deadline) && remaining <= 0;
  return (
    <div
      className={`mz-timer ${critical ? 'is-critical' : ''} ${expired ? 'is-expired' : ''} ${paused ? 'is-paused' : ''}`}
      role="timer"
      aria-live="off"
      aria-label={showSeconds ? `Teklif süresi: ${remaining} saniye` : 'Teklif süresi kapalı'}
      style={{ '--mz-ring-ratio': ratio } as CSSProperties}
    >
      <span className="sr-only" aria-live="polite">
        {paused ? 'Açık artırma duraklatıldı' : expired ? 'Teklif süresi doldu' : remaining === 5 ? 'Son 5 saniye' : ''}
      </span>
      <svg viewBox="0 0 44 44" aria-hidden="true" focusable="false">
        <circle className="mz-timer__track" cx="22" cy="22" r="19" />
        <circle className="mz-timer__value" cx="22" cy="22" r="19" />
      </svg>
      <span className="mz-timer__seconds" aria-hidden="true">
        {showSeconds ? remaining : '—'}
      </span>
      <small className="mz-timer__unit" aria-hidden="true">
        sn
      </small>
    </div>
  );
}

export function AuctionActionBar({
  game,
  current,
  myManager,
  mode,
  isHost,
  isSpectator,
  canParticipate,
  busy,
  remaining,
  timerSeconds,
  defaultIncrement,
  customBid,
  onCustomBidChange,
  onAction,
}: {
  game: Game;
  current: AuctionLot;
  myManager?: Manager;
  mode: AuctionMode;
  isHost: boolean;
  isSpectator: boolean;
  canParticipate: boolean;
  busy: boolean;
  remaining: number;
  timerSeconds: number;
  defaultIncrement: 5 | 10 | 25;
  customBid: string;
  onCustomBidChange: (value: string) => void;
  onAction: (type: string, payload?: Record<string, unknown>) => Promise<boolean>;
}) {
  const opening = game.leader === null,
    amount = opening ? auctionOpeningPrice(current, game.managers) : game.bid,
    minimum = opening ? auctionOpeningPrice(current, game.managers) : game.bid + 1,
    live = mode === 'live' && !isSpectator;
  return (
    <div className="mz-action-bar">
      <div className="mz-action-bar__dock">
        <BidTimerRing deadline={game.deadline} remaining={remaining} totalSeconds={timerSeconds} paused={game.paused} />
        <div className="bid-summary mz-bid-hero">
          <small>{opening ? 'AÇILIŞ' : 'GÜNCEL TEKLİF'}</small>
          <strong aria-live="polite">{money(amount)}</strong>
          {game.leader === null ? (
            <span className="mz-bid-hero__hint">Açılış fiyatı</span>
          ) : (
            <span className="current-leader" title={game.managers[game.leader].name}>
              {game.managers[game.leader].name}
            </span>
          )}
        </div>
        {live && (
          <div className="online-actions mz-bid-actions">
            {!opening &&
              [5, 10, 25].map((increment) => (
                <button
                  key={increment}
                  disabled={!canParticipate || busy}
                  onClick={() => onAction('bid', { increment })}
                >
                  +{increment}M
                </button>
              ))}
            <button
              className="primary-action mz-bid-cta"
              disabled={!canParticipate || busy}
              title={opening ? `${money(minimum)} ile açılış` : `${money(game.bid + defaultIncrement)} teklif ver`}
              onClick={() => onAction('bid', { increment: opening ? 0 : defaultIncrement })}
            >
              Teklif ver
            </button>
            <button className="mz-bid-pass" disabled={!canParticipate || busy} onClick={() => onAction('pass')}>
              Pas
            </button>
          </div>
        )}
      </div>
      {mode === 'manual' &&
        (isHost ? (
          <ManualControls key={current.id} game={game} current={current} busy={busy} onAction={onAction} />
        ) : (
          <p className="manual-waiting">Kurucu, kazanan menajeri ve satış tutarını giriyor.</p>
        ))}
      {mode === 'live' && isSpectator && <p className="mz-bid-note">Seyirci olarak açık artırmayı izliyorsunuz.</p>}
      {live && (
        <form
          className="custom-bid-form mz-custom-bid"
          onSubmit={(event) => {
            event.preventDefault();
            const next = Math.round(Number(customBid));
            if (Number.isFinite(next) && next > 0)
              void onAction('bid', { amount: next }).then((success) => {
                if (success) onCustomBidChange('');
              });
          }}
        >
          <label htmlFor="custom-bid">Elle teklif ($M)</label>
          <input
            id="custom-bid"
            inputMode="numeric"
            min={minimum}
            max={myManager?.budget}
            step="1"
            type="number"
            value={customBid}
            onChange={(event) => onCustomBidChange(event.target.value)}
            placeholder={String(minimum)}
            disabled={!canParticipate || busy}
          />
          <button disabled={!canParticipate || busy || !customBid}>Teklif ver</button>
        </form>
      )}
    </div>
  );
}
