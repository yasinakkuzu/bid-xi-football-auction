/**
 * Media rights policy.
 *
 * Third-party player photos and club logos are shipped **off by default**: an
 * unverified remote asset may only reach a client when an operator explicitly
 * opts in through an environment flag. This mirrors `docs/data-rights.md`, which
 * requires "no evidence, no content" for commercial releases.
 *
 *   COMMERCIAL_MODE=true          -> hard commercial gate, overrides everything
 *   SHOW_PLAYER_PHOTOS=true       -> enable verified player photos
 *   SHOW_CLUB_LOGOS=true          -> enable verified club logos
 *   ALLOW_UNVERIFIED_ASSETS=true  -> local/preview convenience, ignored when
 *                                    COMMERCIAL_MODE=true
 */

export type MediaPolicy = { showPlayerPhotos: boolean; showClubLogos: boolean };

export type MediaPolicySource = Record<string, string | undefined>;

function flag(source: MediaPolicySource, key: string) {
  return source[key] === 'true';
}

export function mediaPolicyFromEnvironment(source: MediaPolicySource = process.env): MediaPolicy {
  const commercialMode = flag(source, 'COMMERCIAL_MODE');
  const unverifiedAllowed = !commercialMode && flag(source, 'ALLOW_UNVERIFIED_ASSETS');
  return {
    showPlayerPhotos: flag(source, 'SHOW_PLAYER_PHOTOS') || unverifiedAllowed,
    showClubLogos: flag(source, 'SHOW_CLUB_LOGOS') || unverifiedAllowed,
  };
}

export function applyMediaPolicy<T extends { image?: string; clubLogo?: string }>(
  record: T,
  policy: MediaPolicy = mediaPolicyFromEnvironment(),
): T {
  return {
    ...record,
    image: policy.showPlayerPhotos ? record.image : undefined,
    clubLogo: policy.showClubLogos ? record.clubLogo : undefined,
  };
}

export function sanitizePool<T extends { image?: string; clubLogo?: string }>(
  pool: T[],
  policy: MediaPolicy = mediaPolicyFromEnvironment(),
): T[] {
  return pool.map((record) => applyMediaPolicy(record, policy));
}
