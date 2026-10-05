import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  POOL_MODEL_VERSION,
  PERFORMANCE_MODEL_VERSION,
  POOL_SIZE,
  CURRENT_MIN_SEASON,
  LEGENDS_MIN_SEASON,
  OVERLAP_LIMIT_RATIO,
  slotFor,
  competitionWeight,
  percentileRating,
  aggregatePerformance,
  ratingSignals,
  priceForRating,
} from './lib/pool-model.mjs';
import { forEachCsvRow } from './lib/csv-stream.mjs';

const SOURCE = 'data/transfermarkt/players.csv';
const APPEARANCES_SOURCE = 'data/transfermarkt/appearances.csv';
const DB_PATH = 'data/transfermarkt/players.sqlite';
const POOL_PATH = 'app/data/auction-pool.generated.json';

/**
 * Derive the July–June season label from an ISO `YYYY-MM-DD` match date.
 *
 * Calendar years would split a single season in half, so a match played from
 * July onwards belongs to the following year's season (2025-08 → season 2026).
 *
 * @param {unknown} value
 * @returns {number|null} Season year, or `null` when the date is unusable.
 */
function seasonFromDate(value) {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}/.test(text)) return null;
  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(5, 7));
  if (!Number.isFinite(year) || year <= 0) return null;
  return year + (month >= 7 ? 1 : 0);
}

/**
 * Convert a factual CSV counter to a finite, non-negative number.
 *
 * @param {unknown} value
 * @returns {number}
 */
function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function parseCsv(text) {
  const rows = [];
  let row = [],
    field = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

if (!existsSync(SOURCE)) throw new Error(`Eksik kaynak: ${SOURCE}`);
const sourceBuffer = readFileSync(SOURCE),
  rows = parseCsv(sourceBuffer.toString('utf8'));
const headers = rows.shift();
const ix = Object.fromEntries(headers.map((h, i) => [h, i]));

// Factual per-match performance, streamed once. Competition strength is applied
// per appearance, not per season, so a Champions League minute counts for more
// than a cup minute in the same season. Only player ids that exist in
// players.csv are accumulated, which bounds memory by the published universe.
const playerIds = new Set(rows.map((r) => Number(r[ix.player_id])).filter((id) => Number.isFinite(id) && id > 0));
const performanceByPlayer = new Map();
let appearanceRows = 0;
const appearancesAvailable = existsSync(APPEARANCES_SOURCE);
if (appearancesAvailable) {
  await forEachCsvRow(APPEARANCES_SOURCE, (fields, header) => {
    const playerId = Number(fields[header.player_id]);
    if (!Number.isFinite(playerId) || !playerIds.has(playerId)) return;
    const season = seasonFromDate(fields[header.date]);
    if (season === null) return;
    let seasons = performanceByPlayer.get(playerId);
    if (!seasons) {
      seasons = new Map();
      performanceByPlayer.set(playerId, seasons);
    }
    let bucket = seasons.get(season);
    if (!bucket) {
      bucket = { minutes: 0, weightedMinutes: 0, goals: 0, assists: 0 };
      seasons.set(season, bucket);
    }
    const minutes = toNumber(fields[header.minutes_played]);
    bucket.minutes += minutes;
    bucket.weightedMinutes += minutes * competitionWeight(fields[header.competition_id]);
    bucket.goals += toNumber(fields[header.goals]);
    bucket.assists += toNumber(fields[header.assists]);
    appearanceRows += 1;
  });
}
const performanceAggregates = new Map();
for (const [playerId, seasons] of performanceByPlayer) {
  performanceAggregates.set(
    playerId,
    aggregatePerformance(
      [...seasons].map(([season, bucket]) => ({
        season,
        minutes: bucket.minutes,
        weightedMinutes: bucket.weightedMinutes,
        goals: bucket.goals,
        assists: bucket.assists,
      })),
    ),
  );
}
const playersWithPerformance = performanceAggregates.size;
const performanceDataUsed = appearancesAvailable && playersWithPerformance > 0;
performanceByPlayer.clear();
playerIds.clear();
console.log(
  performanceDataUsed
    ? `Performans verisi kullanıldı (${PERFORMANCE_MODEL_VERSION}): ${playersWithPerformance} oyuncu, ${appearanceRows} maç satırı.`
    : `Uyarı: ${APPEARANCES_SOURCE} bulunamadı ya da kullanılabilir satır yok; performans sinyali devre dışı, kapsül tabanlı yedek model kullanılıyor.`,
);

if (existsSync(DB_PATH)) rmSync(DB_PATH);
mkdirSync('app/data', { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=OFF;');
db.exec(`CREATE TABLE players (
  player_id INTEGER PRIMARY KEY, name TEXT NOT NULL, last_season INTEGER, current_club_id INTEGER,
  current_club_name TEXT, country TEXT, date_of_birth TEXT, position TEXT, sub_position TEXT, auction_slot TEXT,
  preferred_foot TEXT, height_cm INTEGER, international_caps INTEGER, international_goals INTEGER,
  competition_id TEXT, signal_score REAL, source_url TEXT
)`);
const insert = db.prepare(`INSERT INTO players VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
db.exec('BEGIN');
for (const r of rows) {
  if (!r[ix.player_id]) continue;
  const playerId = Number(r[ix.player_id]);
  const signal = ratingSignals(
    {
      internationalCaps: Number(r[ix.international_caps]) || 0,
      internationalGoals: Number(r[ix.international_goals]) || 0,
      dateOfBirth: r[ix.date_of_birth] || null,
      competitionId: r[ix.current_club_domestic_competition_id] || null,
      lastSeason: Number(r[ix.last_season]) || null,
      performance: performanceAggregates.get(playerId) ?? null,
    },
    { referenceYear: CURRENT_MIN_SEASON, legend: false },
  );
  insert.run(
    Number(r[ix.player_id]),
    r[ix.name],
    Number(r[ix.last_season]) || null,
    Number(r[ix.current_club_id]) || null,
    r[ix.current_club_name] || null,
    r[ix.country_of_citizenship] || null,
    r[ix.date_of_birth] || null,
    r[ix.position] || null,
    r[ix.sub_position] || null,
    slotFor(r[ix.sub_position]) || null,
    r[ix.foot] || null,
    Number(r[ix.height_in_cm]) || null,
    Number(r[ix.international_caps]) || 0,
    Number(r[ix.international_goals]) || 0,
    r[ix.current_club_domestic_competition_id] || null,
    signal,
    r[ix.url] || null,
  );
}
db.exec('COMMIT');
db.exec(
  'CREATE INDEX idx_players_era_pool ON players(last_season, auction_slot); CREATE INDEX idx_players_current_pool ON players(last_season, auction_slot, competition_id); PRAGMA optimize;',
);

const baseSlots = ['GK', 'RB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST'];
const pool = { current: {}, legends: {} };
for (const era of ['current', 'legends']) for (const slot of baseSlots) pool[era][slot] = [];
const overlapLimit = Math.floor(POOL_SIZE * OVERLAP_LIMIT_RATIO);
// Factual per-season performance is the primary ranking signal. Players without
// it (absent from appearances.csv) keep the caps-only fallback score but are
// ranked below every player that has real data, so an obscure high-caps profile
// can never displace an elite performer. They stay in the pool so a thin slot
// remains fillable; when appearances.csv is missing, every candidate has
// `hasPerformance === false` and the comparator degenerates to the old ordering.
const byRankThenName = (a, b) =>
  (b.hasPerformance ? 1 : 0) - (a.hasPerformance ? 1 : 0) || b.signal - a.signal || a.name.localeCompare(b.name);
for (const r of rows) {
  const slot = slotFor(r[ix.sub_position]);
  if (!slot) continue;
  const lastSeason = Number(r[ix.last_season]) || 0;
  const performance = performanceAggregates.get(Number(r[ix.player_id])) ?? null;
  const common = {
    id: Number(r[ix.player_id]),
    name: r[ix.name],
    country: r[ix.country_of_citizenship] || '',
    club: r[ix.current_club_name] || '',
    league: r[ix.current_club_domestic_competition_id] || '',
    hasPerformance: Boolean(performance),
  };
  const signals = {
    internationalCaps: Number(r[ix.international_caps]) || 0,
    internationalGoals: Number(r[ix.international_goals]) || 0,
    dateOfBirth: r[ix.date_of_birth] || null,
    competitionId: r[ix.current_club_domestic_competition_id] || null,
    lastSeason: Number(r[ix.last_season]) || null,
    performance,
  };
  if (lastSeason >= CURRENT_MIN_SEASON)
    pool.current[slot].push({
      ...common,
      signal: ratingSignals(signals, { referenceYear: CURRENT_MIN_SEASON, legend: false }),
    });
  if (lastSeason >= LEGENDS_MIN_SEASON)
    pool.legends[slot].push({
      ...common,
      signal: ratingSignals(signals, { referenceYear: CURRENT_MIN_SEASON, legend: true }),
    });
}
// The shipped entry shape is fixed: factual attributes plus our own scores.
// `signal` and any market value stay internal and never reach the pool file.
const finalizeSlot = (list) =>
  list.map((p, i) => {
    const rating = percentileRating(i, list.length);
    return {
      id: p.id,
      name: p.name,
      country: p.country,
      club: p.club,
      league: p.league,
      rating,
      price: priceForRating(rating),
    };
  });
for (const slot of baseSlots) {
  const current = pool.current[slot].sort(byRankThenName).slice(0, POOL_SIZE);
  const currentIds = new Set(current.map((player) => player.id));
  const legendCandidates = pool.legends[slot].sort(byRankThenName);
  const returning = legendCandidates.filter((player) => currentIds.has(player.id)).slice(0, overlapLimit),
    historic = legendCandidates.filter((player) => !currentIds.has(player.id)).slice(0, POOL_SIZE - returning.length);
  const legends = [...historic, ...returning].sort(byRankThenName).slice(0, POOL_SIZE);
  pool.current[slot] = finalizeSlot(current);
  pool.legends[slot] = finalizeSlot(legends);
}
for (const era of ['current', 'legends']) {
  const center = pool[era].CB;
  const split = (offset) =>
    center
      .filter((_, i) => i % 2 === offset)
      .map((p, i, a) => {
        const rating = percentileRating(i, a.length);
        return { ...p, rating, price: priceForRating(rating) };
      });
  pool[era].CB1 = split(0);
  pool[era].CB2 = split(1);
  delete pool[era].CB;
}
writeFileSync(POOL_PATH, JSON.stringify(pool));
const count = db.prepare('SELECT COUNT(*) AS count FROM players').get().count;
const playable = new Set([...Object.values(pool.current), ...Object.values(pool.legends)].flat().map((p) => p.id)).size;
const wingMappings = {
  right: rows.filter((r) => slotFor(r[ix.sub_position]) === 'RW').length,
  left: rows.filter((r) => slotFor(r[ix.sub_position]) === 'LW').length,
};
const poolKeys = ['GK', 'RB', 'CB1', 'CB2', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST'],
  overlapBySlot = Object.fromEntries(
    poolKeys.map((slot) => {
      const current = new Set(pool.current[slot].map((player) => player.id)),
        same = pool.legends[slot].filter((player) => current.has(player.id)).length;
      return [slot, { count: same, ratio: Number((same / Math.max(1, pool.current[slot].length)).toFixed(3)) }];
    }),
  );
const generatedPlayers = Object.values(pool.current).flat();
const quality = {
  generatedAt: new Date().toISOString(),
  poolModel: POOL_MODEL_VERSION,
  marketValueUsed: false,
  performanceDataUsed,
  performanceModel: PERFORMANCE_MODEL_VERSION,
  playersWithPerformance,
  sourceRows: Number(count),
  playableProfiles: playable,
  missingSubPosition: rows.filter((r) => !r[ix.sub_position]).length,
  unsupportedSubPositions: [...new Set(rows.map((r) => r[ix.sub_position]).filter((s) => s && !slotFor(s)))].sort(),
  wingMappings,
  overlapBySlot,
  leagueCoverage: Number(
    (generatedPlayers.filter((player) => player.league).length / Math.max(1, generatedPlayers.length)).toFixed(3),
  ),
  tiers: {},
};
for (const era of ['current', 'legends'])
  quality.tiers[era] = Object.fromEntries(
    poolKeys.map((key) => {
      const list = pool[era][key] || [];
      return [
        key,
        Object.fromEntries(
          ['Süperstar', 'Elit', 'Çok iyi', 'İyi', 'Ortalama', 'Standart'].map((t) => [
            t,
            list.filter(
              (p) =>
                (p.rating >= 93
                  ? 'Süperstar'
                  : p.rating >= 90
                    ? 'Elit'
                    : p.rating >= 86
                      ? 'Çok iyi'
                      : p.rating >= 82
                        ? 'İyi'
                        : p.rating >= 77
                          ? 'Ortalama'
                          : 'Standart') === t,
            ).length,
          ]),
        ),
      ];
    }),
  );
writeFileSync('data/transfermarkt/data-quality.json', JSON.stringify(quality, null, 2));
const manifest = {
  datasetVersion: `transfermarkt-${new Date(statSync(SOURCE).mtimeMs).toISOString().slice(0, 10)}`,
  generatorVersion: POOL_MODEL_VERSION,
  scoreVersion: 'score-v3',
  valuationModel: {
    name: 'mezat11-signal-v1',
    version: POOL_MODEL_VERSION,
    marketValueUsed: false,
    performanceDataUsed,
    performanceModel: PERFORMANCE_MODEL_VERSION,
    inputs: performanceDataUsed
      ? ['internationalCaps', 'internationalGoals', 'dateOfBirth', 'competitionId', 'lastSeason', 'appearances']
      : ['internationalCaps', 'internationalGoals', 'dateOfBirth', 'competitionId', 'lastSeason'],
    priceModel: 'priceForRating',
  },
  sourceName: 'transfermarkt-datasets players.csv',
  sourceUrl: 'https://github.com/dcaribou/transfermarkt-datasets',
  retrievedAt: new Date(statSync(SOURCE).mtimeMs).toISOString(),
  generatedAt: quality.generatedAt,
  coveredSeasons: {
    current: `${CURRENT_MIN_SEASON} ve sonrası`,
    legends: `${LEGENDS_MIN_SEASON} ve sonrası; aktif oyuncu örtüşmesi pozisyon başına en fazla %${Math.round(
      OVERLAP_LIMIT_RATIO * 100,
    )}`,
  },
  sourceSha256: createHash('sha256').update(sourceBuffer).digest('hex'),
  // Honest, machine-readable trace of how the published scores were produced.
  // `generatorVersion` above tells which model produced the shipped pool, so an
  // older pool can never masquerade as a valuation-free one.
  scoreProvenance: `Puan ve fiyatlar ${POOL_MODEL_VERSION} modeliyle üretilir; hiçbir piyasa değeri okunmaz ve ham piyasa değerleri yayınlanmaz.`,
  rights: {
    structuredDataset:
      'CC0 1.0 Universal (kamu malı adanması); derleyicinin telif ve veritabanı hakları feragat edilmiştir.',
    playerPhotos: 'Veri setine alınmaz ve yayınlanmaz.',
    clubLogos: 'Veri setine alınmaz ve yayınlanmaz.',
    reviewStatus: 'documented',
    datasetLicense: 'CC0-1.0',
    datasetLicenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    datasetLicensedBy: 'dcaribou/transfermarkt-datasets',
    commercialUseAllowed: true,
    evidenceUrl: 'https://raw.githubusercontent.com/dcaribou/transfermarkt-datasets/master/LICENSE',
    marketValues: 'Veri setine alınmaz ve yayınlanmaz.',
    reviewScope:
      'Derleyici lisansı (CC0) ve yayınlanan alanlar doğrulandı; kaynak sağlayıcının kendi kullanım koşulları hukuk incelemesi gerektirir.',
  },
};
writeFileSync('data/transfermarkt/dataset-manifest.json', JSON.stringify(manifest, null, 2));
console.log(
  JSON.stringify({
    players: Number(count),
    playable,
    current: Object.values(pool.current).reduce((n, a) => n + a.length, 0),
    legends: Object.values(pool.legends).reduce((n, a) => n + a.length, 0),
    performanceDataUsed,
    playersWithPerformance,
    database: DB_PATH,
    pool: POOL_PATH,
  }),
);
db.close();
