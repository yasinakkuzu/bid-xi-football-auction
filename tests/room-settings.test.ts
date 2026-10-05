import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, normalizedSettings, RoomError } from '../lib/room-types.ts';
import type { RoomSettings } from '../lib/room-types.ts';

test('untrusted settings are clamped to the supported domain', () => {
  const hostile = {
    era: 'prehistoric',
    quality: 'best',
    revealRatings: 'yes',
    selectedTiers: ['Süperstar', 'Nope', 7],
    auctionMode: 'chaos',
    includeBench: 'sure',
    timerSeconds: 9999,
    bidIncrement: 3,
    secondChance: 1,
    seasonLength: 42,
    scenarioId: 'not-a-scenario',
    formation: '9-9-9',
    poolMode: 'whatever',
    customPlayerIds: ['GK:1', 'bad id', 'GK:2', ...Array.from({ length: 400 }, (_, i) => `ST:${i + 100}`)],
    customPoolSelections: [
      { type: 'club', name: 'Fenerbahce' },
      { type: 'nope', name: 'x' },
      { type: 'league', name: 'y'.repeat(200) },
    ],
  } as unknown as RoomSettings;
  const settings = normalizedSettings(hostile);
  assert.equal(settings.era, 'current');
  assert.equal(settings.quality, 'all');
  assert.equal(settings.revealRatings, true);
  assert.deepEqual(settings.selectedTiers, ['Süperstar']);
  assert.equal(settings.auctionMode, 'live');
  assert.equal(settings.includeBench, true);
  assert.equal(settings.timerSeconds, 20);
  assert.equal(settings.bidIncrement, 5);
  assert.equal(settings.secondChance, true);
  assert.equal(settings.seasonLength, 1);
  assert.equal(settings.scenarioId, 'classic');
  assert.equal(settings.formation, '4-2-3-1');
  assert.equal(settings.poolMode, 'generated');
  assert.ok(settings.customPlayerIds!.length <= 200);
  assert.ok(settings.customPlayerIds!.every((id) => /^[A-Z0-9]+:\d+$/i.test(id)));
  assert.equal(settings.customPoolSelections!.length, 1);
  assert.equal(settings.customPoolSelections![0].name, 'Fenerbahce');
});

test('scenario presets override manual settings consistently', () => {
  assert.equal(
    normalizedSettings({ ...defaultSettings, scenarioId: 'speed-auction', timerSeconds: 30 }).timerSeconds,
    10,
  );
  assert.equal(
    normalizedSettings({ ...defaultSettings, scenarioId: 'hidden-gems', revealRatings: true }).revealRatings,
    false,
  );
  assert.equal(normalizedSettings({ ...defaultSettings, selectedTiers: [] }).selectedTiers.length, 6);
  assert.equal(normalizedSettings({ ...defaultSettings, quality: 'best' }).quality, 'all');
});

test('default settings and RoomError keep their published contract', () => {
  assert.equal(defaultSettings.timerSeconds, 20);
  assert.equal(defaultSettings.bidIncrement, 5);
  assert.equal(defaultSettings.includeBench, false);
  assert.equal(defaultSettings.revealRatings, false);
  assert.equal(defaultSettings.customPlayerIds?.length, 0);
  const error = new RoomError('FORBIDDEN', 'yok', 403);
  assert.ok(error instanceof Error);
  assert.equal(error.name, 'RoomError');
  assert.equal(error.code, 'FORBIDDEN');
  assert.equal(error.status, 403);
  assert.equal(new RoomError('X', 'y').status, 400);
});
