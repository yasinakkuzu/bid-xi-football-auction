/**
 * Valuation-free pool model for Kadro İhalesi.
 *
 * This module is pure: it performs no I/O and imports nothing. It turns factual
 * per-season performance, international caps, competition strength and age into
 * two of our own game numbers — a percentile `rating` and a curve-derived
 * `price`. No third-party market value, player-photo URL or club-logo URL is
 * accepted or produced anywhere in this pipeline.
 */

/** Bumped whenever the signal, percentile or price model changes. */
export const POOL_MODEL_VERSION = 'pool-v5';

/** One English sentence describing the model. */
export const MODEL_DESCRIPTION =
  'A valuation-free player model that ranks factual per-season match performance, international caps and competition strength into a percentile rating and our own price curve.';

/** Bumped whenever the factual per-season performance model changes. */
export const PERFORMANCE_MODEL_VERSION = 'perf-v1';

/**
 * Season the dataset snapshot is considered current for recency decay.
 *
 * The imported appearances derive a season from the match date (July–June), so a
 * season played in 2025/26 is labelled `2026`. Scores from older seasons are
 * discounted relative to this reference; see {@link aggregatePerformance}.
 */
export const REFERENCE_SEASON = 2026;

/**
 * Legacy lower bound retained for compatibility with the caps-only era.
 *
 * The current model uses {@link REFERENCE_SEASON} recency decay rather than a
 * hard cut-off, so this constant is no longer read by the ranking.
 */
export const RECENT_FROM_SEASON = 2024;

/** Maximum number of players kept per era and auction slot. */
export const POOL_SIZE = 240;

/** Minimum `last_season` for the current-era pool. */
export const CURRENT_MIN_SEASON = 2025;

/** Minimum `last_season` for the legends-era pool. */
export const LEGENDS_MIN_SEASON = 1996;

/** Maximum share of a slot's legends list that may also appear in the current list. */
export const OVERLAP_LIMIT_RATIO = 0.12;

/**
 * Our own competition strength weights (0..1).
 *
 * These are design inputs, not measurements: the top-five European leagues sit
 * near 1, established second-tier leagues sit in the middle, continental club
 * competitions, domestic cups and national-team tournaments sit lower, and
 * smaller leagues sit lowest. Unknown or missing ids fall back to
 * {@link DEFAULT_COMPETITION_WEIGHT} so the pipeline never crashes on a new id.
 *
 * Keys follow the ids the dataset actually uses, e.g. `L1` is the Bundesliga and
 * `UKR1` is the Ukrainian league; `DE1`/`UA1` are kept as aliases.
 */
const COMPETITION_WEIGHTS = Object.freeze({
  GB1: 1,
  ES1: 0.96,
  IT1: 0.94,
  DE1: 0.93,
  L1: 0.93,
  FR1: 0.9,
  PO1: 0.74,
  NL1: 0.72,
  BE1: 0.68,
  TR1: 0.66,
  BR1: 0.64,
  RU1: 0.62,
  AR1: 0.62,
  UA1: 0.6,
  UKR1: 0.6,
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
  // Continental club competitions.
  CL: 1.0,
  EL: 0.85,
  UCOL: 0.7,
  ECL: 0.7,
  CLQ: 0.5,
  ELQ: 0.5,
  ECLQ: 0.5,
  // National-team tournaments.
  FIWC: 0.8,
  AFCN: 0.8,
  EURO: 0.8,
  WCQ: 0.5,
  NLQ: 0.5,
  // Domestic cups and super cups.
  CDR: 0.45,
  FAC: 0.45,
  DFB: 0.45,
  CIT: 0.45,
  POCP: 0.45,
  DKP: 0.45,
  SFA: 0.45,
  UKRP: 0.45,
  NLP: 0.45,
  GRP: 0.45,
  RUP: 0.45,
  SCI: 0.45,
  SUC: 0.45,
  SSC: 0.45,
  CGB: 0.45,
  FRCH: 0.45,
  TDC: 0.45,
  CDP: 0.45,
  TRP: 0.45,
});

/** Documented default weight for an unknown or missing competition id. */
const DEFAULT_COMPETITION_WEIGHT = 0.35;

/** Additive signal bonus for a legend, standing in for a historic prime-career peak. */
const LEGEND_PRIME_BOOST = 6;

/** Ten full matches of competition-weighted minutes form one volume unit. */
const MINUTES_PER_VOLUME_UNIT = 900;

/** Assists count as this fraction of a goal in the attack rate. */
const ASSIST_WEIGHT = 0.6;

/** Per-90 attack rate below this baseline earns no scoring multiplier. */
const ATTACK_RATE_BASELINE = 0.1;

/** Strength of the attack-rate multiplier above {@link ATTACK_RATE_BASELINE}. */
const ATTACK_RATE_WEIGHT = 2;

/** How much of a legend's whole career total joins the single-season peak. */
const LEGEND_CAREER_WEIGHT = 0.12;

/** Caps keep only a small ordering role in the current-era performance signal. */
const PERFORMANCE_CAP_WEIGHT = 0.15;

/** Caps keep only a small ordering role in the legends-era performance signal. */
const PERFORMANCE_LEGEND_CAP_WEIGHT = 0.2;

/** Recency decay multipliers applied to a season at a given age offset. */
const RECENCY_WEIGHTS = Object.freeze({ 1: 1, 2: 0.6, 3: 0.25 });

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
 * Look up our own strength weight for a competition id.
 *
 * @param {unknown} competitionId Transfermarkt competition id, e.g. `GB1` or `CL`.
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
 * Convert an arbitrary factual counter to a finite, non-negative number.
 *
 * @param {unknown} value
 * @returns {number}
 */
function nonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

/**
 * Normalise a season label to an integer year.
 *
 * @param {unknown} value
 * @returns {number|null} `null` when the label is missing or unusable.
 */
function toSeason(value) {
  const season = Number(value);
  return Number.isFinite(season) && season > 0 ? Math.trunc(season) : null;
}

/**
 * Recency decay multiplier for a season `offset = referenceSeason - season`.
 *
 * @param {number} offset
 * @returns {number} `1` for the current and previous season, then `0.6`, `0.25`
 *   and `0` for everything older.
 */
function recencyWeight(offset) {
  if (!Number.isFinite(offset)) return 0;
  if (offset <= 1) return 1;
  return RECENCY_WEIGHTS[offset] ?? 0;
}

/**
 * Score one player-season from factual per-match totals.
 *
 * Design: `volume = weightedMinutes / 900` treats ten full matches as one unit,
 * so goalkeepers and defenders earn a solid score simply by being a starter in a
 * strong competition — their `weightedMinutes` already carries the competition
 * strength because every appearance is weighted by
 * {@link competitionWeight} as it is accumulated. Attackers add on top through
 * the per-90 attack rate `(goals + 0.6 * assists) / max(1, minutes / 90)`: each
 * point of rate above the {@link ATTACK_RATE_BASELINE} multiplies the volume by
 * up to {@link ATTACK_RATE_WEIGHT}, which keeps elite scorers ahead of pure
 * minutes while never letting a single lucky cameo dominate a whole season.
 *
 * The result is always a finite, non-negative number.
 *
 * @param {{
 *   minutes?: number,
 *   weightedMinutes?: number,
 *   goals?: number,
 *   assists?: number,
 * }} [season] `weightedMinutes` is the sum of `minutes * competitionWeight(id)`
 *   over the season's appearances.
 * @returns {number} Season score; `0` when there are no minutes.
 */
export function seasonPerformance({ minutes, weightedMinutes, goals, assists } = {}) {
  const safeMinutes = nonNegative(minutes);
  const safeWeightedMinutes = nonNegative(weightedMinutes);
  const safeGoals = nonNegative(goals);
  const safeAssists = nonNegative(assists);
  const volume = safeWeightedMinutes / MINUTES_PER_VOLUME_UNIT;
  const attackRate = (safeGoals + ASSIST_WEIGHT * safeAssists) / Math.max(1, safeMinutes / 90);
  const score = volume * (1 + ATTACK_RATE_WEIGHT * Math.max(0, attackRate - ATTACK_RATE_BASELINE));
  return Number.isFinite(score) && score > 0 ? score : 0;
}

/**
 * Aggregate per-season performance rows into the signals the ranking uses.
 *
 * - `peak` is the best single season by {@link seasonPerformance}; ties go to the
 *   later season.
 * - `recent` discounts older seasons relative to {@link REFERENCE_SEASON} with
 *   {@link recencyWeight}, so a current-era ranking reflects who is performing
 *   now rather than who simply accumulated the most career minutes.
 * - `career` sums every season, which is what surfaces long historical careers
 *   in the legends era.
 * - `seasons` counts distinct seasons and `minutes` totals the raw minutes.
 *
 * @param {Iterable<{
 *   season?: number|string|null,
 *   minutes?: number,
 *   weightedMinutes?: number,
 *   goals?: number,
 *   assists?: number,
 * }>} rows
 * @param {{ referenceSeason?: number }} [options]
 * @returns {{
 *   peak: { score: number, season: number|null },
 *   recent: number,
 *   career: number,
 *   seasons: number,
 *   minutes: number,
 * }} Totals; `peak.season` is `null` when no row carried a usable season.
 */
export function aggregatePerformance(rows, { referenceSeason = REFERENCE_SEASON } = {}) {
  const reference = Number.isFinite(Number(referenceSeason)) ? Number(referenceSeason) : REFERENCE_SEASON;
  let recent = 0,
    career = 0,
    minutes = 0,
    peakScore = 0,
    peakSeason = null,
    hasPeak = false;
  const seenSeasons = new Set();
  for (const row of rows ?? []) {
    const season = toSeason(row?.season);
    const score = seasonPerformance(row ?? {});
    minutes += nonNegative(row?.minutes);
    career += score;
    if (season !== null) {
      seenSeasons.add(season);
      recent += score * recencyWeight(reference - season);
    }
    const laterTie =
      score === peakScore && (season ?? Number.NEGATIVE_INFINITY) > (peakSeason ?? Number.NEGATIVE_INFINITY);
    if (!hasPeak || score > peakScore || laterTie) {
      peakScore = score;
      peakSeason = season;
      hasPeak = true;
    }
  }
  return { peak: { score: peakScore, season: peakSeason }, recent, career, seasons: seenSeasons.size, minutes };
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
 * magnitude of this score is irrelevant.
 *
 * When `row.performance` (an {@link aggregatePerformance} result) is present the
 * ranking is driven by factual per-season match performance:
 *
 * - current era: `performance.recent + 0.15 * capSignal`
 * - legends era: `performance.peak.score + 0.12 * performance.career + 0.2 * capSignal`
 *
 * The recent term is deliberately ignored for legends so a historic great is
 * ranked by the best season and the whole career rather than by current form.
 * International goals, league weight and age are already represented inside the
 * performance aggregate, so they are not added twice.
 *
 * When `row.performance` is absent the model falls back to the previous
 * caps/goals/league/age ordering, which keeps the pipeline usable without the
 * appearances file. In both paths exactly the documented factual keys are read.
 *
 * @param {{
 *   internationalCaps?: number|null,
 *   internationalGoals?: number|null,
 *   dateOfBirth?: string|null,
 *   competitionId?: string|null,
 *   lastSeason?: number|null,
 *   performance?: {
 *     peak?: { score?: number|null, season?: number|null },
 *     recent?: number|null,
 *     career?: number|null,
 *     seasons?: number|null,
 *     minutes?: number|null,
 *   }|null,
 * }} row Factual attributes only; any extra key is ignored.
 * @param {{ referenceYear?: number, legend?: boolean }} [options] `legend: true`
 *   switches to the legends ordering and, on the fallback path, applies the
 *   documented prime-career boost ({@link LEGEND_PRIME_BOOST}).
 * @returns {number} Signal score; higher means a better-ranked candidate.
 */
export function ratingSignals(row, options = {}) {
  const { referenceYear = CURRENT_MIN_SEASON, legend = false } = options;
  const caps = Math.max(0, Number(row?.internationalCaps) || 0);
  const capSignal = Math.log10(caps + 1) * 6;
  const performance = row?.performance;
  if (performance) {
    const recent = nonNegative(performance.recent);
    const peak = nonNegative(performance?.peak?.score);
    const career = nonNegative(performance.career);
    const performanceSignal = legend ? peak + career * LEGEND_CAREER_WEIGHT : recent;
    const capWeight = legend ? PERFORMANCE_LEGEND_CAP_WEIGHT : PERFORMANCE_CAP_WEIGHT;
    return round2(performanceSignal + capWeight * capSignal);
  }
  const goals = Math.max(0, Number(row?.internationalGoals) || 0);
  const weight = competitionWeight(row?.competitionId);
  const age = ageOn(referenceYear, row?.dateOfBirth);
  const lastSeason = Number(row?.lastSeason);
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
