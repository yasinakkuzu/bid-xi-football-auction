import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  POOL_MODEL_VERSION,
  POOL_SIZE,
  CURRENT_MIN_SEASON,
  LEGENDS_MIN_SEASON,
  OVERLAP_LIMIT_RATIO,
  slotFor,
  percentileRating,
  ratingSignals,
  priceForRating,
} from './lib/pool-model.mjs';

const SOURCE = 'data/transfermarkt/players.csv';
const DB_PATH = 'data/transfermarkt/players.sqlite';
const POOL_PATH = 'app/data/auction-pool.generated.json';

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
  const signal = ratingSignals(
    {
      internationalCaps: Number(r[ix.international_caps]) || 0,
      internationalGoals: Number(r[ix.international_goals]) || 0,
      dateOfBirth: r[ix.date_of_birth] || null,
      competitionId: r[ix.current_club_domestic_competition_id] || null,
      lastSeason: Number(r[ix.last_season]) || null,
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
const bySignalThenName = (a, b) => b.signal - a.signal || a.name.localeCompare(b.name);
for (const r of rows) {
  const slot = slotFor(r[ix.sub_position]);
  if (!slot) continue;
  const lastSeason = Number(r[ix.last_season]) || 0;
  const common = {
    id: Number(r[ix.player_id]),
    name: r[ix.name],
    country: r[ix.country_of_citizenship] || '',
    club: r[ix.current_club_name] || '',
    league: r[ix.current_club_domestic_competition_id] || '',
  };
  const signals = {
    internationalCaps: Number(r[ix.international_caps]) || 0,
    internationalGoals: Number(r[ix.international_goals]) || 0,
    dateOfBirth: r[ix.date_of_birth] || null,
    competitionId: r[ix.current_club_domestic_competition_id] || null,
    lastSeason: Number(r[ix.last_season]) || null,
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
  const current = pool.current[slot].sort(bySignalThenName).slice(0, POOL_SIZE);
  const currentIds = new Set(current.map((player) => player.id));
  const legendCandidates = pool.legends[slot].sort(bySignalThenName);
  const returning = legendCandidates.filter((player) => currentIds.has(player.id)).slice(0, overlapLimit),
    historic = legendCandidates.filter((player) => !currentIds.has(player.id)).slice(0, POOL_SIZE - returning.length);
  const legends = [...historic, ...returning].sort(bySignalThenName).slice(0, POOL_SIZE);
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
    name: 'kadro-ihalesi-signal-v1',
    version: POOL_MODEL_VERSION,
    marketValueUsed: false,
    inputs: ['internationalCaps', 'internationalGoals', 'dateOfBirth', 'competitionId', 'lastSeason'],
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
    database: DB_PATH,
    pool: POOL_PATH,
  }),
);
db.close();
