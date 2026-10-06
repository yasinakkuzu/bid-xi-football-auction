/**
 * Age and consent policy (KVKK-oriented).
 *
 * Decisions encoded here:
 *  - Minimum age to play: 15 (the 5651 regime requires an age rating and
 *    parental-control posture for game platforms; 15+ is the defensible floor
 *    while there is no official rating).
 *  - Public leaderboard publication and free-text chat require 18+.
 *  - The declared birth year is **never stored**: only the derived band
 *    (`adult` / `minor` / `unknown`) and the consent record are kept, which keeps
 *    the processed data minimal.
 *  - Anything unknown fails closed: an unknown age is treated as a minor.
 */

export const MIN_AGE = 15;
export const ADULT_AGE = 18;
/** Bump when the information text changes so stored consents stay traceable. */
export const CONSENT_POLICY_VERSION = 'kvkk-2026-10';

export type AgeBand = 'adult' | 'minor' | 'unknown';

export type AgeDeclaration = { birthYear?: unknown; consentAccepted?: unknown };

export type ConsentRecord = { policyVersion: string; acceptedAt: number; ageBand: AgeBand };

export type DeclarationAssessment =
  | { ok: true; age: number; band: AgeBand; consent: ConsentRecord }
  | { ok: false; code: 'CONSENT_REQUIRED' | 'AGE_REQUIRED' | 'AGE_BELOW_MINIMUM'; message: string };

/** Years between the declared birth year and the reference date, or null when unusable. */
export function ageFromBirthYear(birthYear: unknown, reference = new Date()): number | null {
  const year = Number(birthYear);
  if (!Number.isInteger(year)) return null;
  const currentYear = reference.getUTCFullYear();
  if (year < currentYear - 100 || year > currentYear) return null;
  return currentYear - year;
}

export function ageBand(age: number | null): AgeBand {
  if (age === null) return 'unknown';
  return age >= ADULT_AGE ? 'adult' : 'minor';
}

export function mayPlay(age: number | null) {
  return age !== null && age >= MIN_AGE;
}

/** Only adults may be published; minors and unknown ages stay out of the public list. */
export function mayPublishToLeaderboard(band: AgeBand) {
  return band === 'adult';
}

export function mayUseChat(band: AgeBand) {
  return band === 'adult';
}

export function consentRecord(band: AgeBand, acceptedAt = Date.now()): ConsentRecord {
  return { policyVersion: CONSENT_POLICY_VERSION, acceptedAt, ageBand: band };
}

/**
 * Validates an age/consent declaration coming from an untrusted client and
 * returns the normalized band plus the consent record. The server is the only
 * place that decides, so a client cannot skip the gate.
 */
export function assessAgeDeclaration(declaration: AgeDeclaration = {}, now = Date.now()): DeclarationAssessment {
  if (declaration.consentAccepted !== true)
    return {
      ok: false,
      code: 'CONSENT_REQUIRED',
      message: 'Oyunu başlatmak için gizlilik ve veri işleme bilgilendirmesini onaylamanız gerekir.',
    };
  const age = ageFromBirthYear(declaration.birthYear, new Date(now));
  if (age === null) return { ok: false, code: 'AGE_REQUIRED', message: 'Doğum yılınızı geçerli bir yıl olarak girin.' };
  if (!mayPlay(age))
    return { ok: false, code: 'AGE_BELOW_MINIMUM', message: `Bu oyun ${MIN_AGE} yaş ve üzeri içindir.` };
  const band = ageBand(age);
  return { ok: true, age, band, consent: consentRecord(band, now) };
}

export function minorRestrictionMessage(area: 'leaderboard' | 'chat') {
  return area === 'leaderboard'
    ? 'Başarı tablosuna yayın yalnızca 18 yaş ve üzeri menajerler için açıktır.'
    : 'Oda sohbeti yalnızca 18 yaş ve üzeri katılımcılar için açıktır.';
}
