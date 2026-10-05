/**
 * Valuation-free pool model for Kadro İhalesi.
 *
 * This module is pure: it performs no I/O and imports nothing. It turns factual
 * career attributes into two of our own game numbers — a percentile `rating` and
 * a curve-derived `price`. No third-party market value, player-photo URL or
 * club-logo URL is accepted or produced anywhere in this pipeline.
 */

/** Bumped whenever the signal, percentile or price model changes. */
export const POOL_MODEL_VERSION = 'pool-v4';

/** One English sentence describing the model. */
export const MODEL_DESCRIPTION =
  'A valuation-free player model that ranks factual career signals to derive a percentile rating and our own price curve.';

/** Maximum number of players kept per era and auction slot. */
export const POOL_SIZE = 240;

/** Minimum `last_season` for the current-era pool. */
export const CURRENT_MIN_SEASON = 2025;

/** Minimum `last_season` for the legends-era pool. */
export const LEGENDS_MIN_SEASON = 1996;

/** Maximum share of a slot's legends list that may also appear in the current list. */
export const OVERLAP_LIMIT_RATIO = 0.12;

/**
 * Our own domestic-competition strength weights (0..1).
 *
 * These are design inputs, not measurements: the top-five European leagues sit
 * near 1, established second-tier leagues sit in the middle and smaller leagues
 * sit lower. Unknown or missing ids fall back to
 * {@link DEFAULT_COMPETITION_WEIGHT} so the pipeline never crashes on a new id.
 */
const COMPETITION_WEIGHTS = Object.freeze({
  GB1: 1,
  ES1: 0.96,
  IT1: 0.94,
  DE1: 0.93,
  FR1: 0.9,
  PO1: 0.74,
  NL1: 0.72,
  BE1: 0.68,
  TR1: 0.66,
  BR1: 0.64,
  RU1: 0.62,
  AR1: 0.62,
  UA1: 0.6,
  SA1: 0.58,
  SC1: 0.54,
  A1: 0.54,
  CH1: 0.52,
  MX1: 0.52,
  GR1: 0.5,
  MLS1: 0.5,
  DK1: 0.5,
  JP1: 0.48,
  NO1: 0.48,
  SE1: 0.48,
  PL1: 0.48,
  CZ1: 0.46,
  RO1: 0.44,
  RS1: 0.44,
  HR1: 0.44,
});

/** Documented default weight for an unknown or missing competition id. */
const DEFAULT_COMPETITION_WEIGHT = 0.35;

/** Additive signal bonus for a legend, standing in for a historic prime-career peak. */
const LEGEND_PRIME_BOOST = 6;

/** Lower bound of the price curve. */
const PRICE_MIN = 5;

/** Upper hard clamp of the price curve. */
const PRICE_MAX = 200;

/** Lowest rating the percentile curve ever produces. */
const RATING_MIN = 68;

/** Highest rating the percentile curve ever produces. */
const RATING_MAX = 97;

/**
 * Normalise a raw sub-position string for slot lookup.
 *
 * Turkish-aware lowercasing plus separator folding, moved verbatim from the
 * original import script.
 *
 * @param {unknown} subPosition
 * @returns {string}
 */
export function normalizedSubPosition(subPosition) {
  return String(subPosition || '')
    .trim()
    .toLocaleLowerCase('tr')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Map a raw sub-position to one of the eleven auction slots.
 *
 * Handles Transfermarkt English names, the short winger codes and the Turkish
 * names used by the source data. Returns `undefined` for anything unsupported.
 *
 * @param {unknown} subPosition
 * @returns {'GK'|'RB'|'CB'|'LB'|'DM'|'CM'|'AM'|'RW'|'LW'|'ST'|undefined}
 */
export function slotFor(subPosition) {
  const value = normalizedSubPosition(subPosition),
    exact = new Map([
      ['goalkeeper', 'GK'],
      ['right back', 'RB'],
      ['centre back', 'CB'],
      ['center back', 'CB'],
      ['left back', 'LB'],
      ['defensive midfield', 'DM'],
      ['central midfield', 'CM'],
      ['attacking midfield', 'AM'],
      ['centre forward', 'ST'],
      ['center forward', 'ST'],
      ['second striker', 'ST'],
      ['right winger', 'RW'],
      ['right wing', 'RW'],
      ['right midfield', 'RW'],
      ['right midfielder', 'RW'],
      ['rw', 'RW'],
      ['left winger', 'LW'],
      ['left wing', 'LW'],
      ['left midfield', 'LW'],
      ['left midfielder', 'LW'],
      ['lw', 'LW'],
      ['sağ kanat', 'RW'],
      ['sağ açık', 'RW'],
      ['sol kanat', 'LW'],
      ['sol açık', 'LW'],
    ]);
  return exact.get(value);
}

/**
 * Map a zero-based rank to one of the six documented rating tiers.
 *
 * The six bands are a fixed curve, so every `rating` in the pool falls inside a
 * known tier and the last index always lands exactly on 68. Moved verbatim from
 * the original import script.
 *
 * @param {number} index Zero-based rank, ascending quality.
 * @param {number} total Number of players in the slot.
 * @returns {number} Rating between 68 and 97.
 */
export function percentileRating(index, total) {
  const p = index / Math.max(1, total - 1);
  const bands = [
    { end: 0.08, hi: 97, lo: 93 },
    { end: 0.2, hi: 92.9, lo: 90 },
    { end: 0.4, hi: 89.9, lo: 86 },
    { end: 0.62, hi: 85.9, lo: 82 },
    { end: 0.85, hi: 81.9, lo: 77 },
    { end: 1, hi: 76.9, lo: 68 },
  ];
  let start = 0;
  for (const b of bands) {
    if (p <= b.end) {
      const t = (p - start) / Math.max(0.001, b.end - start);
      return Math.round((b.hi - (b.hi - b.lo) * t) * 10) / 10;
    }
    start = b.end;
  }
  return 68;
}

/**
 * Look up our own strength weight for a domestic competition id.
 *
 * @param {unknown} competitionId Transfermarkt domestic competition id, e.g. `GB1`.
 * @returns {number} Weight in 0..1; {@link DEFAULT_COMPETITION_WEIGHT} when unknown.
 */
export function competitionWeight(competitionId) {
  const key = String(competitionId ?? '')
    .trim()
    .toUpperCase();
  if (!key) return DEFAULT_COMPETITION_WEIGHT;
  return COMPETITION_WEIGHTS[key] ?? DEFAULT_COMPETITION_WEIGHT;
}

/**
 * Whole years between a reference year and an ISO date of birth.
 *
 * @param {unknown} referenceYear
 * @param {unknown} dateOfBirth ISO date such as `1995-04-01`.
 * @returns {number|null} Age in years, or `null` when the date is unusable.
 */
export function ageOn(referenceYear, dateOfBirth) {
  const year = Number(referenceYear);
  if (!Number.isFinite(year)) return null;
  const text = String(dateOfBirth ?? '').trim();
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  const age = year - parsed.getUTCFullYear();
  if (!Number.isFinite(age) || age < 0 || age > 120) return null;
  return age;
}

/**
 * Small deterministic bonus for a player whose age sits in a typical prime.
 *
 * @param {number|null} age
 * @returns {number}
 */
function primeCareerSignal(age) {
  if (age === null) return 0;
  if (age >= 24 && age <= 29) return 4;
  if (age >= 21 && age <= 23) return 2.5;
  if (age >= 30 && age <= 33) return 1.5;
  if (age >= 18 && age < 21) return 1;
  return 0;
}

/**
 * Round to two decimals to keep the audit database stable across runs.
 *
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Build the deterministic ordering signal for a candidate player.
 *
 * Only the ORDERING matters: the final `rating` is
 * {@link percentileRating} of the player's rank inside its slot, so the absolute
 * magnitude of this score is irrelevant. That is why the model is
 * valuation-free — international caps, international goals, age in the
 * reference year, our own competition weight and recency are enough to sort the
 * candidates, and the same ordering is reproduced on every run.
 *
 * @param {{
 *   internationalCaps?: number|null,
 *   internationalGoals?: number|null,
 *   dateOfBirth?: string|null,
 *   competitionId?: string|null,
 *   lastSeason?: number|null,
 * }} row Factual attributes only; any extra key is ignored.
 * @param {{ referenceYear?: number, legend?: boolean }} [options] `legend: true`
 *   applies the documented prime-career boost ({@link LEGEND_PRIME_BOOST}).
 * @returns {number} Signal score; higher means a better-ranked candidate.
 */
export function ratingSignals(row, options = {}) {
  const { referenceYear = CURRENT_MIN_SEASON, legend = false } = options;
  const caps = Math.max(0, Number(row?.internationalCaps) || 0);
  const goals = Math.max(0, Number(row?.internationalGoals) || 0);
  const weight = competitionWeight(row?.competitionId);
  const age = ageOn(referenceYear, row?.dateOfBirth);
  const lastSeason = Number(row?.lastSeason);
  const capSignal = Math.log10(caps + 1) * 6;
  const goalSignal = Math.log10(goals + 1) * 4;
  const competitionSignal = weight * 10;
  const primeSignal = primeCareerSignal(age);
  const recencySignal = Number.isFinite(lastSeason) ? Math.max(0, lastSeason - LEGENDS_MIN_SEASON) * 0.01 : 0;
  const legendSignal = legend ? LEGEND_PRIME_BOOST : 0;
  return round2(capSignal + goalSignal + competitionSignal + primeSignal + recencySignal + legendSignal);
}

/**
 * Our own monotone price curve, derived from the rating only.
 *
 * Ratings at or below the percentile floor map to {@link PRICE_MIN}; the top of
 * the curve lands around 55, so a 95+ rating costs roughly 45-55. The result is
 * always clamped to 5..200.
 *
 * @param {number} rating
 * @returns {number} Integer price between 5 and 200.
 */
export function priceForRating(rating) {
  const value = Number(rating);
  if (!Number.isFinite(value)) return PRICE_MIN;
  const clamped = Math.max(RATING_MIN, Math.min(RATING_MAX, value));
  const t = (clamped - RATING_MIN) / (RATING_MAX - RATING_MIN);
  const price = PRICE_MIN + Math.pow(t, 1.8) * 50;
  return Math.max(PRICE_MIN, Math.min(PRICE_MAX, Math.round(price)));
}
