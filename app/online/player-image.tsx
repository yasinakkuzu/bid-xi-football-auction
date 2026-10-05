'use client';
/* Remote player photos are optional enhancements; a letter placeholder keeps the card readable when they fail. */
/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';

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
