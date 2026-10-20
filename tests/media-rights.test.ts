import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyMediaPolicy, mediaPolicyFromEnvironment, sanitizePool } from '../lib/media-rights.ts';

test('unverified remote media is off unless an operator opts in', () => {
  assert.deepEqual(mediaPolicyFromEnvironment({}), { showPlayerPhotos: false, showClubLogos: false });
  assert.deepEqual(mediaPolicyFromEnvironment({ COMMERCIAL_MODE: 'false' }), {
    showPlayerPhotos: false,
    showClubLogos: false,
  });
  assert.deepEqual(mediaPolicyFromEnvironment({ ALLOW_UNVERIFIED_ASSETS: 'true' }), {
    showPlayerPhotos: true,
    showClubLogos: true,
  });
});

test('commercial mode overrides the unverified escape hatch', () => {
  assert.deepEqual(mediaPolicyFromEnvironment({ COMMERCIAL_MODE: 'true', ALLOW_UNVERIFIED_ASSETS: 'true' }), {
    showPlayerPhotos: false,
    showClubLogos: false,
  });
  assert.deepEqual(
    mediaPolicyFromEnvironment({ COMMERCIAL_MODE: 'true', SHOW_PLAYER_PHOTOS: 'true', SHOW_CLUB_LOGOS: 'true' }),
    { showPlayerPhotos: true, showClubLogos: true },
    'explicitly licensed assets stay enabled in commercial mode',
  );
});

test('photos and logos are gated independently', () => {
  assert.deepEqual(mediaPolicyFromEnvironment({ SHOW_PLAYER_PHOTOS: 'true' }), {
    showPlayerPhotos: true,
    showClubLogos: false,
  });
  assert.deepEqual(mediaPolicyFromEnvironment({ SHOW_CLUB_LOGOS: 'true' }), {
    showPlayerPhotos: false,
    showClubLogos: true,
  });
});

test('applyMediaPolicy strips the fields the policy denies', () => {
  const source = { id: '1', image: 'https://example.test/player.jpg', clubLogo: 'https://example.test/logo.png' };
  assert.deepEqual(applyMediaPolicy(source, { showPlayerPhotos: false, showClubLogos: false }), {
    id: '1',
    image: undefined,
    clubLogo: undefined,
  });
  assert.equal(applyMediaPolicy(source, { showPlayerPhotos: true, showClubLogos: false }).clubLogo, undefined);
  assert.equal(sanitizePool([source], { showPlayerPhotos: true, showClubLogos: false })[0].image, source.image);
  assert.equal(applyMediaPolicy(source).image, undefined, 'the default policy is the secure one');
});

test('the shipped pool carries no third-party media or market valuations at all', () => {
  const pool = JSON.parse(readFileSync('app/data/auction-pool.generated.json', 'utf8')) as Record<
    'current' | 'legends',
    Record<string, Array<Record<string, unknown>>>
  >;
  const players = [...Object.values(pool.current).flat(), ...Object.values(pool.legends).flat()];
  assert.ok(players.length > 0);
  for (const player of players) {
    assert.equal('image' in player, false, 'no photo URLs ship in the dataset');
    assert.equal('clubLogo' in player, false, 'no club logo URLs ship in the dataset');
    assert.equal('value' in player, false, 'no third-party market values ship in the dataset');
  }
  assert.deepEqual(Object.keys(players[0]).sort(), ['club', 'country', 'id', 'league', 'name', 'price', 'rating']);
});
