/**
 * Unit tests for the factual per-season performance model and the streaming CSV
 * reader. They need neither the raw Transfermarkt dump nor the audit database.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import {
  PERFORMANCE_MODEL_VERSION,
  REFERENCE_SEASON,
  competitionWeight,
  seasonPerformance,
  aggregatePerformance,
  ratingSignals,
} from '../scripts/lib/pool-model.mjs';
import { forEachCsvRow, parseCsvLine } from '../scripts/lib/csv-stream.mjs';

const BASE_ROW = {
  internationalCaps: 30,
  internationalGoals: 12,
  dateOfBirth: '1995-04-01',
  competitionId: 'GB1',
  lastSeason: 2025,
};
const BASE_OPTIONS = { referenceYear: 2025, legend: false };
const PERFORMANCE = { peak: { score: 5, season: REFERENCE_SEASON }, recent: 3, career: 40, seasons: 5, minutes: 9000 };

const capSignalFor = (caps: number) => Math.log10(caps + 1) * 6;
const round2 = (value: number) => Math.round(value * 100) / 100;
const season = (overrides: Record<string, number> = {}) => ({
  minutes: 900,
  weightedMinutes: 900,
  goals: 3,
  assists: 1,
  ...overrides,
});

test('the performance model version and reference season are pinned', () => {
  assert.equal(PERFORMANCE_MODEL_VERSION, 'perf-v1');
  assert.equal(REFERENCE_SEASON, 2026);
});

test('seasonPerformance is zero without minutes and always finite and non-negative', () => {
  assert.equal(seasonPerformance({ minutes: 0, weightedMinutes: 0, goals: 0, assists: 0 }), 0);
  assert.equal(seasonPerformance({ minutes: 0, weightedMinutes: 0, goals: 9, assists: 9 }), 0);
  assert.equal(seasonPerformance(), 0);
  assert.equal(seasonPerformance({ minutes: -100, weightedMinutes: -50, goals: -3, assists: -1 }), 0);
  const value = seasonPerformance(season());
  assert.ok(Number.isFinite(value) && value >= 0, `value ${value}`);
});

test('seasonPerformance grows monotonically with weighted minutes, goals and assists', () => {
  const fewerMinutes = seasonPerformance(season({ minutes: 450, weightedMinutes: 450 }));
  const moreMinutes = seasonPerformance(season({ minutes: 1800, weightedMinutes: 1800 }));
  assert.ok(moreMinutes > fewerMinutes, `minutes ${fewerMinutes} -> ${moreMinutes}`);

  const fewerGoals = seasonPerformance(season({ goals: 1 }));
  const moreGoals = seasonPerformance(season({ goals: 20 }));
  assert.ok(moreGoals > fewerGoals, `goals ${fewerGoals} -> ${moreGoals}`);

  const fewerAssists = seasonPerformance(season({ assists: 0 }));
  const moreAssists = seasonPerformance(season({ assists: 15 }));
  assert.ok(moreAssists > fewerAssists, `assists ${fewerAssists} -> ${moreAssists}`);

  // Weighted minutes already encode competition strength: a CL minute beats a cup minute.
  const elite = seasonPerformance(season({ weightedMinutes: 900 * competitionWeight('CL') }));
  const cup = seasonPerformance(season({ weightedMinutes: 900 * competitionWeight('CDR') }));
  assert.ok(elite > cup, `competition ${cup} -> ${elite}`);

  // Position-aware profile prevents fluke defender goals from eclipsing full-season CL starters.
  const starterCb = seasonPerformance({
    minutes: 3150,
    weightedMinutes: 3150 * competitionWeight('CL'),
    goals: 0,
    assists: 1,
    slot: 'CB',
  });
  const cameoCbWithGoals = seasonPerformance({
    minutes: 1100,
    weightedMinutes: 1100 * competitionWeight('TR1'),
    goals: 5,
    assists: 0,
    slot: 'CB',
  });
  assert.ok(starterCb > cameoCbWithGoals, `CB starter ${starterCb} should beat cameo scorer ${cameoCbWithGoals}`);
});

test('competitionWeight covers the ids that occur in the appearances dump', () => {
  for (const id of ['IT1', 'ES1', 'GB1', 'FR1', 'TR1', 'L1', 'NL1', 'PO1', 'BE1', 'RU1', 'GR1', 'SC1', 'UKR1', 'DK1']) {
    assert.ok(competitionWeight(id) > 0.4 && competitionWeight(id) <= 1, `${id} -> ${competitionWeight(id)}`);
  }
  // The dump uses Transfermarkt's real ids: L1 is the Bundesliga and UKR1 Ukraine.
  assert.equal(competitionWeight('L1'), 0.93);
  assert.equal(competitionWeight('UKR1'), 0.6);
  assert.equal(competitionWeight('RUP'), 0.45);
  assert.equal(competitionWeight('CL'), 1);
  assert.equal(competitionWeight('EL'), 0.85);
  assert.equal(competitionWeight('ECL'), 0.7);
  assert.equal(competitionWeight('UCOL'), 0.7);
  assert.equal(competitionWeight('CLQ'), 0.5);
  assert.equal(competitionWeight('ELQ'), 0.5);
  assert.equal(competitionWeight('FIWC'), 0.8);
  assert.equal(competitionWeight('AFCN'), 0.8);
  assert.equal(competitionWeight('EURO'), 0.8);
  assert.equal(competitionWeight('WCQ'), 0.5);
  assert.equal(competitionWeight('CDR'), 0.45);
  assert.equal(competitionWeight('TRP'), 0.45);
  assert.equal(competitionWeight('unknown-cup'), 0.35);
  assert.equal(competitionWeight(''), 0.35);
  assert.ok(competitionWeight('L1') > competitionWeight('TR1'));
  assert.ok(competitionWeight('CL') > competitionWeight('EL'));
  assert.ok(competitionWeight('EL') > competitionWeight('ECL'));
  assert.ok(competitionWeight('ECL') > competitionWeight('CDR'));
});

test('aggregatePerformance picks the peak, decays recent seasons and sums the career', () => {
  const rows = [
    { season: REFERENCE_SEASON, minutes: 2700, weightedMinutes: 2700 * 0.94, goals: 20, assists: 5 },
    { season: REFERENCE_SEASON - 2, minutes: 1800, weightedMinutes: 1800 * 0.96, goals: 6, assists: 2 },
    { season: REFERENCE_SEASON - 3, minutes: 900, weightedMinutes: 900 * 0.9, goals: 1, assists: 1 },
    { season: REFERENCE_SEASON - 4, minutes: 900, weightedMinutes: 900 * 0.9, goals: 0, assists: 0 },
  ];
  const aggregate = aggregatePerformance(rows);
  assert.equal(aggregate.peak.season, REFERENCE_SEASON);
  assert.equal(aggregate.peak.score, seasonPerformance(rows[0]));
  const expectedRecent =
    seasonPerformance(rows[0]) * 1 +
    seasonPerformance(rows[1]) * 0.6 +
    seasonPerformance(rows[2]) * 0.25 +
    seasonPerformance(rows[3]) * 0;
  assert.ok(Math.abs(aggregate.recent - expectedRecent) < 1e-9, `recent ${aggregate.recent} vs ${expectedRecent}`);
  const expectedCareer = rows.reduce((total, row) => total + seasonPerformance(row), 0);
  assert.ok(Math.abs(aggregate.career - expectedCareer) < 1e-9, `career ${aggregate.career} vs ${expectedCareer}`);
  assert.equal(aggregate.seasons, 4);
  assert.equal(aggregate.minutes, 2700 + 1800 + 900 + 900);
});

test('aggregatePerformance resolves peak ties by the later season and survives empty input', () => {
  const twin = { minutes: 900, weightedMinutes: 900, goals: 3, assists: 1 };
  const aggregate = aggregatePerformance([
    { season: 2020, ...twin },
    { season: 2021, ...twin },
  ]);
  assert.equal(aggregate.peak.season, 2021);
  assert.equal(aggregate.peak.score, seasonPerformance(twin));
  assert.equal(aggregate.seasons, 2);

  assert.deepEqual(aggregatePerformance([]), {
    peak: { score: 0, season: null },
    recent: 0,
    career: 0,
    seasons: 0,
    minutes: 0,
  });
});

test('ratingSignals ranks the current era by recency and the legends era by peak plus career', () => {
  const capSignal = capSignalFor(BASE_ROW.internationalCaps);
  const current = ratingSignals({ ...BASE_ROW, performance: { ...PERFORMANCE } }, { ...BASE_OPTIONS, legend: false });
  const legends = ratingSignals({ ...BASE_ROW, performance: { ...PERFORMANCE } }, { ...BASE_OPTIONS, legend: true });
  assert.equal(current, round2(3 + 0.15 * capSignal));
  assert.equal(legends, round2(5 + 0.12 * 40 + 0.2 * capSignal));

  // Legends ignore the recent term entirely.
  const legendsLow = ratingSignals({ ...BASE_ROW, performance: { ...PERFORMANCE, recent: 0 } }, { legend: true });
  const legendsHigh = ratingSignals({ ...BASE_ROW, performance: { ...PERFORMANCE, recent: 99 } }, { legend: true });
  assert.equal(legendsLow, legendsHigh);

  // The current era reacts to it.
  const currentLow = ratingSignals({ ...BASE_ROW, performance: { ...PERFORMANCE, recent: 0 } }, { legend: false });
  const currentHigh = ratingSignals({ ...BASE_ROW, performance: { ...PERFORMANCE, recent: 8 } }, { legend: false });
  assert.equal(currentHigh - currentLow, 8);
});

test('ratingSignals falls back to the previous caps/league/age ordering without performance', () => {
  const baseline = ratingSignals(BASE_ROW, BASE_OPTIONS);
  assert.equal(ratingSignals({ ...BASE_ROW, performance: null }, BASE_OPTIONS), baseline);
  assert.notEqual(ratingSignals({ ...BASE_ROW, performance: { ...PERFORMANCE } }, BASE_OPTIONS), baseline);

  const fewerCaps = ratingSignals({ ...BASE_ROW, internationalCaps: 5 }, BASE_OPTIONS);
  const moreCaps = ratingSignals({ ...BASE_ROW, internationalCaps: 80 }, BASE_OPTIONS);
  assert.ok(moreCaps >= fewerCaps, `caps ${fewerCaps} -> ${moreCaps}`);

  const weaker = ratingSignals({ ...BASE_ROW, competitionId: 'MLS1' }, BASE_OPTIONS);
  const stronger = ratingSignals({ ...BASE_ROW, competitionId: 'GB1' }, BASE_OPTIONS);
  assert.ok(stronger >= weaker, `competition ${weaker} -> ${stronger}`);

  const plain = ratingSignals(BASE_ROW, { ...BASE_OPTIONS, legend: false });
  const legend = ratingSignals(BASE_ROW, { ...BASE_OPTIONS, legend: true });
  assert.ok(legend > plain, `legend ${legend} should beat ${plain}`);

  // Age is only part of the fallback ordering.
  const withPerformance = ratingSignals({ ...BASE_ROW, performance: { ...PERFORMANCE } }, BASE_OPTIONS);
  assert.equal(
    ratingSignals({ ...BASE_ROW, dateOfBirth: '1980-01-01', performance: { ...PERFORMANCE } }, BASE_OPTIONS),
    withPerformance,
  );
});

test('ratingSignals never reads a market-value-shaped field', () => {
  const baseline = ratingSignals(BASE_ROW, BASE_OPTIONS);
  const withValues = {
    ...BASE_ROW,
    market_value_in_eur: 90_000_000,
    highest_market_value_in_eur: 140_000_000,
    image_url: 'https://example.invalid/player.png',
  };
  assert.equal(ratingSignals(withValues, BASE_OPTIONS), baseline);

  const withPerformance = ratingSignals({ ...BASE_ROW, performance: { ...PERFORMANCE } }, BASE_OPTIONS);
  assert.equal(ratingSignals({ ...withValues, performance: { ...PERFORMANCE } }, BASE_OPTIONS), withPerformance);

  // A throwing getter proves the function does not touch the field at all.
  const trapped: Record<string, unknown> = { ...BASE_ROW };
  Object.defineProperty(trapped, 'market_value_in_eur', {
    enumerable: true,
    get() {
      throw new Error('ratingSignals must not read a market value');
    },
  });
  assert.equal(ratingSignals(trapped, BASE_OPTIONS), baseline);
});

test('the model and import sources never name a market value or an image column', () => {
  const sources = [
    new URL('../scripts/lib/pool-model.mjs', import.meta.url),
    new URL('../scripts/lib/csv-stream.mjs', import.meta.url),
    new URL('../scripts/import-transfermarkt.mjs', import.meta.url),
  ];
  for (const url of sources) {
    const source = readFileSync(url, 'utf8');
    assert.doesNotMatch(source, /market_value/, `${url.pathname} must not name raw market values`);
    assert.doesNotMatch(source, /highest_market_value/, `${url.pathname} must not name peak market values`);
    assert.doesNotMatch(source, /image_url/, `${url.pathname} must not name player images`);
  }
});

const CSV_FIXTURE_ROWS = [
  ['1', 'Ada', 'GB1', '3', 'a,b'],
  ['2', 'Bob', 'ES1', '0', 'say "hi"'],
  ['3', 'Cem', 'TR1', '7', 'line1\nline2'],
  ['4', 'Dan', 'IT1', '', ''],
];
const CSV_FIXTURE = `${[
  'player_id,player_name,competition_id,goals,notes',
  '1,Ada,"GB1",3,"a,b"',
  '2,Bob,"ES1",0,"say ""hi"""',
  '3,Cem,"TR1",7,"line1\nline2"',
  '4,Dan,"IT1"',
].join('\r\n')}\r\n`;

test('parseCsvLine handles quoted commas, escaped quotes, CRLF and a trailing CR', () => {
  assert.deepEqual(parseCsvLine('a,b,c'), ['a', 'b', 'c']);
  assert.deepEqual(parseCsvLine('"a,b",c'), ['a,b', 'c']);
  assert.deepEqual(parseCsvLine('"a""b",c'), ['a"b', 'c']);
  assert.deepEqual(parseCsvLine('a,b\r'), ['a', 'b']);
  assert.deepEqual(parseCsvLine(''), ['']);
  assert.deepEqual(parseCsvLine('"multi\nline",x'), ['multi\nline', 'x']);
});

test('forEachCsvRow streams quoted, escaped and multi-line fields across chunk boundaries', async () => {
  const fixturePath = `/tmp/csv-stream-fixture-${process.pid}-${Date.now()}.csv`;
  writeFileSync(fixturePath, CSV_FIXTURE);
  try {
    for (const chunkSize of [1, 2, 3, 5, 8, 17, 4096]) {
      const seen: string[][] = [];
      const headerIndices: Array<Record<string, number>> = [];
      await forEachCsvRow(
        fixturePath,
        (fields, header) => {
          headerIndices.push(header);
          seen.push([...fields]);
        },
        { chunkSize },
      );
      assert.deepEqual(seen, CSV_FIXTURE_ROWS, `chunkSize ${chunkSize}`);
      assert.equal(headerIndices.length, CSV_FIXTURE_ROWS.length);
      assert.equal(headerIndices[0].player_id, 0);
      assert.equal(headerIndices[0].notes, 4);
      assert.ok(Object.isFrozen(headerIndices[0]));
    }
  } finally {
    rmSync(fixturePath, { force: true });
  }
});

test('forEachCsvRow rejects when the file does not exist', async () => {
  const missing = `/tmp/csv-stream-missing-${process.pid}-${Date.now()}.csv`;
  await assert.rejects(forEachCsvRow(missing, () => {}));
});
