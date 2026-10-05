/**
 * Unit tests for the valuation-free pool model.
 *
 * These tests exercise `scripts/lib/pool-model.mjs` only, so they need neither
 * the raw Transfermarkt CSV nor the audit SQLite database.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  POOL_MODEL_VERSION,
  MODEL_DESCRIPTION,
  POOL_SIZE,
  CURRENT_MIN_SEASON,
  LEGENDS_MIN_SEASON,
  OVERLAP_LIMIT_RATIO,
  normalizedSubPosition,
  slotFor,
  percentileRating,
  competitionWeight,
  ageOn,
  ratingSignals,
  priceForRating,
} from '../scripts/lib/pool-model.mjs';

const TIERS: Array<[string, number]> = [
  ['Süperstar', 93],
  ['Elit', 90],
  ['Çok iyi', 86],
  ['İyi', 82],
  ['Ortalama', 77],
  ['Standart', 0],
];

function tierOf(rating: number) {
  return TIERS.find(([, bound]) => rating >= bound)?.[0];
}

const BASE_ROW = {
  internationalCaps: 30,
  internationalGoals: 12,
  dateOfBirth: '1995-04-01',
  competitionId: 'GB1',
  lastSeason: 2025,
};
const BASE_OPTIONS = { referenceYear: CURRENT_MIN_SEASON, legend: false };

test('the published model constants stay stable', () => {
  assert.equal(POOL_MODEL_VERSION, 'pool-v5');
  assert.equal(POOL_SIZE, 240);
  assert.equal(CURRENT_MIN_SEASON, 2025);
  assert.equal(LEGENDS_MIN_SEASON, 1996);
  assert.equal(OVERLAP_LIMIT_RATIO, 0.12);
  assert.match(MODEL_DESCRIPTION, /[.!]$/);
  assert.equal(MODEL_DESCRIPTION.includes('\n'), false);
});

test('ratingSignals never reads a market-value-looking field', () => {
  const baseline = ratingSignals(BASE_ROW, BASE_OPTIONS);
  const withValues = {
    ...BASE_ROW,
    marketValue: 90_000_000,
    marketValueInEur: 90_000_000,
    highestMarketValueInEur: 140_000_000,
    peakValue: 140_000_000,
  };
  assert.equal(ratingSignals(withValues, BASE_OPTIONS), baseline);

  // A throwing getter proves the function does not touch the field at all.
  const trapped: Record<string, unknown> = { ...BASE_ROW };
  Object.defineProperty(trapped, 'marketValueInEur', {
    enumerable: true,
    get() {
      throw new Error('ratingSignals must not read market value');
    },
  });
  assert.equal(ratingSignals(trapped, BASE_OPTIONS), baseline);
});

test('ratingSignals orders caps, goals, competition strength and legends monotonically', () => {
  const fewerCaps = ratingSignals({ ...BASE_ROW, internationalCaps: 5 }, BASE_OPTIONS);
  const moreCaps = ratingSignals({ ...BASE_ROW, internationalCaps: 80 }, BASE_OPTIONS);
  assert.ok(moreCaps >= fewerCaps, `caps ${fewerCaps} -> ${moreCaps}`);

  const fewerGoals = ratingSignals({ ...BASE_ROW, internationalGoals: 1 }, BASE_OPTIONS);
  const moreGoals = ratingSignals({ ...BASE_ROW, internationalGoals: 60 }, BASE_OPTIONS);
  assert.ok(moreGoals >= fewerGoals, `goals ${fewerGoals} -> ${moreGoals}`);

  const weaker = ratingSignals({ ...BASE_ROW, competitionId: 'MLS1' }, BASE_OPTIONS);
  const stronger = ratingSignals({ ...BASE_ROW, competitionId: 'GB1' }, BASE_OPTIONS);
  assert.ok(stronger >= weaker, `competition ${weaker} -> ${stronger}`);
  assert.ok(competitionWeight('GB1') > competitionWeight('MLS1'));
  assert.ok(competitionWeight('MLS1') > competitionWeight('NOPE1'));
  assert.equal(competitionWeight(''), competitionWeight('unknown-league'));

  const plain = ratingSignals(BASE_ROW, { referenceYear: CURRENT_MIN_SEASON, legend: false });
  const legend = ratingSignals(BASE_ROW, { referenceYear: CURRENT_MIN_SEASON, legend: true });
  assert.ok(legend > plain, `legend ${legend} should beat ${plain}`);
});

test('priceForRating is monotone and clamped to 5..200 with the documented endpoints', () => {
  assert.equal(priceForRating(68), 5);
  assert.ok(priceForRating(95) >= 45 && priceForRating(95) <= 55, `95 -> ${priceForRating(95)}`);
  assert.equal(priceForRating(Number.NaN), 5);
  let previous = priceForRating(0);
  for (let rating = 0; rating <= 120; rating += 0.5) {
    const price = priceForRating(rating);
    assert.ok(Number.isInteger(price), `rating ${rating} -> ${price}`);
    assert.ok(price >= 5 && price <= 200, `rating ${rating} -> ${price}`);
    assert.ok(price >= previous, `rating ${rating}: ${previous} -> ${price}`);
    previous = price;
  }
});

test('percentileRating hits the documented endpoints and keeps all six tiers reachable', () => {
  assert.equal(percentileRating(0, POOL_SIZE), 97);
  assert.equal(percentileRating(POOL_SIZE - 1, POOL_SIZE), 68);
  const seen = new Set<string>();
  for (let index = 0; index < POOL_SIZE; index++) {
    const rating = percentileRating(index, POOL_SIZE);
    assert.ok(rating >= 68 && rating <= 97, `index ${index} -> ${rating}`);
    seen.add(tierOf(rating) as string);
  }
  for (const [tier] of TIERS) assert.ok(seen.has(tier), `tier ${tier} is never produced`);
});

test('slotFor maps the Turkish and English source position names', () => {
  assert.equal(slotFor('Goalkeeper'), 'GK');
  assert.equal(slotFor('Right Back'), 'RB');
  assert.equal(slotFor('Centre Back'), 'CB');
  assert.equal(slotFor('Center Back'), 'CB');
  assert.equal(slotFor('Left Back'), 'LB');
  assert.equal(slotFor('Defensive Midfield'), 'DM');
  assert.equal(slotFor('Central Midfield'), 'CM');
  assert.equal(slotFor('Attacking Midfield'), 'AM');
  assert.equal(slotFor('Right Winger'), 'RW');
  assert.equal(slotFor('Sağ Kanat'), 'RW');
  assert.equal(slotFor('Sağ Açık'), 'RW');
  assert.equal(slotFor('Sol Kanat'), 'LW');
  assert.equal(slotFor('Sol Açık'), 'LW');
  assert.equal(slotFor('Centre Forward'), 'ST');
  assert.equal(slotFor('Second Striker'), 'ST');
  assert.equal(slotFor('Left_Winger'), 'LW');
  assert.equal(slotFor('unknown position'), undefined);
  assert.equal(slotFor(''), undefined);
  assert.equal(slotFor(undefined), undefined);
  assert.equal(normalizedSubPosition('  Sağ_Kanat '), 'sağ kanat');
});

test('ageOn handles ISO dates and unusable values', () => {
  assert.equal(ageOn(2025, '1990-05-10'), 35);
  assert.equal(ageOn(2025, '2005-01-01'), 20);
  assert.equal(ageOn(2025, 'not-a-date'), null);
  assert.equal(ageOn(2025, ''), null);
  assert.equal(ageOn(2025, null), null);
  assert.equal(ageOn(2025, undefined), null);
  assert.equal(ageOn(Number.NaN, '1990-05-10'), null);
  assert.equal(ageOn(2025, '2099-01-01'), null);
});
