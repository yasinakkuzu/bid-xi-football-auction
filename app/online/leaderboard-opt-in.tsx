'use client';

import type { Settings } from './view-types';

/**
 * Consent block for the public leaderboard. The visible name is an explicit,
 * editable choice: the server rejects names that are empty, too long or that
 * contain abuse/impersonation markers (see `lib/moderation.ts`).
 */
export function LeaderboardOptIn({
  fallbackName,
  settings,
  onChange,
}: {
  fallbackName: string;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  const optedIn = Boolean(settings.leaderboardOptIn);
  return (
    <>
      <label className="leaderboard-opt-in">
        <input
          type="checkbox"
          checked={optedIn}
          onChange={(event) => onChange({ leaderboardOptIn: event.target.checked })}
        />
        <span>
          <b>Başarı tablosuna katıl</b>
          <small>
            Oyun tamamlanınca görünen adın, puanın, tarihin ve kadron herkese açık ilk 10 listesinde gösterilebilir.
            Kaydını sonradan kaldırabilirsin.
          </small>
        </span>
      </label>
      {optedIn && (
        <label className="leaderboard-alias">
          <span>Listede görünecek ad</span>
          <input
            className="online-input"
            maxLength={24}
            value={settings.leaderboardAlias ?? fallbackName}
            onChange={(event) => onChange({ leaderboardAlias: event.target.value })}
            placeholder="Takma ad"
          />
          <small>Küfür, hakaret ve resmî unvan içeren adlar reddedilir.</small>
        </label>
      )}
    </>
  );
}
