import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type PoolPlayer = { id: number; name: string; rating: number; price: number; league?: string };
type Quality = {
  sourceRows: number;
  playableProfiles: number;
  wingMappings: { right: number; left: number };
  overlapBySlot: Record<string, { count: number; ratio: number }>;
  leagueCoverage: number;
  tiers: Record<string, Record<string, Record<string, number>>>;
};
type Pool = Record<'current' | 'legends', Record<string, PoolPlayer[]>>;

const quality = JSON.parse(readFileSync('data/transfermarkt/data-quality.json', 'utf8')) as Quality;
const pool = JSON.parse(readFileSync('app/data/auction-pool.generated.json', 'utf8')) as Pool;
const manifest = JSON.parse(readFileSync('data/transfermarkt/dataset-manifest.json', 'utf8')) as {
  datasetVersion: string;
  generatorVersion: string;
  scoreVersion: string;
  sourceSha256: string;
  rights: { reviewStatus: string; playerPhotos: string; clubLogos: string };
  coveredSeasons: Record<string, string>;
};

const SLOT_KEYS = ['GK', 'RB', 'CB1', 'CB2', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST'];
const TIERS = ['Süperstar', 'Elit', 'Çok iyi', 'İyi', 'Ortalama', 'Standart'];
const TIER_BOUNDS = [93, 90, 86, 82, 77, 0];

test('every era and slot can fill a full table plus one surprise lot', () => {
  for (const era of ['current', 'legends'] as const) {
    assert.deepEqual(Object.keys(pool[era]).sort(), [...SLOT_KEYS].sort(), `${era} slots`);
    for (const slot of SLOT_KEYS) {
      const players = pool[era][slot];
      assert.ok(players.length >= 9, `${era}/${slot} has ${players.length} players`);
      for (const player of players) {
        assert.ok(player.name, `${era}/${slot} name`);
        assert.ok(player.rating >= 0 && player.rating <= 100, `${era}/${slot}/${player.name} rating`);
        assert.ok(player.price >= 5, `${era}/${slot}/${player.name} price`);
        assert.ok(Number.isInteger(player.id), `${era}/${slot}/${player.name} id`);
      }
    }
  }
});

test('the generated pool only exposes the six documented rating tiers', () => {
  for (const era of ['current', 'legends'] as const) {
    for (const player of Object.values(pool[era]).flat()) {
      const tier = TIER_BOUNDS.findIndex((bound) => player.rating >= bound);
      assert.ok(
        tier >= 0 && tier < TIERS.length,
        `${era}/${player.name} rating ${player.rating} outside the tier model`,
      );
    }
  }
  for (const tier of TIERS) assert.ok(quality.tiers.current.GK[tier] >= 0, tier);
});

test('current and last-30-year identities overlap by at most twelve percent per slot', () => {
  for (const [slot, result] of Object.entries(quality.overlapBySlot))
    assert.ok(result.ratio <= 0.12, `${slot}: ${result.ratio}`);
  const currentIds = new Set(
    Object.values(pool.current)
      .flat()
      .map((player) => player.id),
  );
  const legends = Object.values(pool.legends).flat();
  const overlap = legends.filter((player) => currentIds.has(player.id)).length;
  assert.ok(overlap / Math.max(1, legends.length) <= 0.12, 'pool-wide overlap');
});

test('dataset provenance binds source, score version and the rights review state', () => {
  assert.match(manifest.datasetVersion, /^transfermarkt-\d{4}-\d{2}-\d{2}$/);
  assert.equal(manifest.generatorVersion, 'pool-v3');
  assert.equal(manifest.scoreVersion, 'score-v3');
  assert.match(manifest.sourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(manifest.rights.reviewStatus, 'pending-legal-review');
  assert.ok(quality.sourceRows >= 10000);
  assert.ok(quality.playableProfiles >= 1000);
  assert.ok(quality.wingMappings.right > 1000 && quality.wingMappings.left > 1000);
});

test('the generated current pool keeps league metadata for custom pool search', () => {
  assert.ok(quality.leagueCoverage >= 0.95, `league coverage ${quality.leagueCoverage}`);
  const generated = Object.values(pool.current).flat();
  assert.ok(generated.filter((player) => player.league).length / generated.length >= 0.95);
});
