type MediaRecord = {image?: string; clubLogo?: string};

export type MediaPolicy = {showPlayerPhotos: boolean; showClubLogos: boolean};

export function mediaPolicyFromEnvironment(): MediaPolicy {
  const commercialMode = process.env.COMMERCIAL_MODE === 'true';
  const unverifiedAllowed = !commercialMode && process.env.ALLOW_UNVERIFIED_ASSETS !== 'false';
  return {
    showPlayerPhotos: process.env.SHOW_PLAYER_PHOTOS === 'true' || unverifiedAllowed,
    showClubLogos: process.env.SHOW_CLUB_LOGOS === 'true' || unverifiedAllowed,
  };
}

export function applyMediaPolicy<T extends MediaRecord>(record: T, policy = mediaPolicyFromEnvironment()): T {
  return {
    ...record,
    image: policy.showPlayerPhotos ? record.image : undefined,
    clubLogo: policy.showClubLogos ? record.clubLogo : undefined,
  };
}

export function sanitizePool<T extends MediaRecord>(pool: T[], policy = mediaPolicyFromEnvironment()) {
  return pool.map(record => applyMediaPolicy(record, policy));
}
