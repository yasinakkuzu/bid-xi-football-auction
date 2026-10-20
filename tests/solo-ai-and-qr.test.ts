import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSoloManagerNames,
  decideSoloBotTurn,
  generateQrMatrix,
  qrMatrixToSvgPath,
  soloBotStyleForIndex,
  type Footballer,
  type Manager,
} from '../packages/core/index.ts';
import { parseMezatDeepLink } from '../mobile/src/native-bridge.ts';

test('buildSoloManagerNames builds human + distinct AI bot names', () => {
  const names = buildSoloManagerNames('Yasin', 4);
  assert.equal(names.length, 4);
  assert.equal(names[0], 'Yasin');
  assert.ok(names.slice(1).every((n) => n.startsWith('AI ')));
  assert.equal(new Set(names).size, 4);
});

test('decideSoloBotTurn bids on needed slot within budget and passes when already leading', () => {
  const lot: Footballer = {
    id: 'p-st-1',
    name: 'Erling Haaland',
    slot: 'ST',
    role: 'Forvet',
    rating: 95,
    price: 90,
    nation: 'NOR',
    club: 'Man City',
  };
  const managers: Manager[] = [
    { id: 0, name: 'Yasin', budget: 850, spent: 0, squad: {} },
    { id: 1, name: 'AI Taktikçi', budget: 850, spent: 0, squad: {} },
  ];

  const firstDecision = decideSoloBotTurn({
    managers,
    pool: [lot],
    index: 0,
    bid: 0,
    leader: null,
    passed: [],
    botIndex: 1,
    style: soloBotStyleForIndex(1),
  });
  assert.equal(firstDecision.action, 'bid');

  const leadingDecision = decideSoloBotTurn({
    managers,
    pool: [lot],
    index: 0,
    bid: 90,
    leader: 1,
    passed: [],
    botIndex: 1,
    style: 'balanced',
  });
  assert.equal(leadingDecision.action, 'pass');
});

test('generateQrMatrix and qrMatrixToSvgPath generate valid ISO QR Code matrix and SVG path', () => {
  const matrix = generateQrMatrix('https://mezat11.com/?mode=online&room=ABC234');
  assert.ok(matrix.length >= 25 && matrix.length <= 41);
  assert.equal(matrix.length, matrix[0].length);
  // Top-left finder pattern corner is always dark
  assert.equal(matrix[0][0], true);
  assert.equal(matrix[0][6], true);
  assert.equal(matrix[6][0], true);

  const svg = qrMatrixToSvgPath(matrix, 2);
  assert.ok(svg.size === matrix.length + 4);
  assert.ok(svg.path.includes('M2 2h1v1h-1z'));
});

test('parseMezatDeepLink parses custom scheme and universal link room codes', () => {
  assert.deepEqual(parseMezatDeepLink('mezat11://room/k9x2m4'), {
    mode: 'online',
    roomCode: 'K9X2M4',
  });
  assert.deepEqual(parseMezatDeepLink('https://mezat11.com/?mode=online&room=ab12cd'), {
    mode: 'online',
    roomCode: 'AB12CD',
  });
  assert.deepEqual(parseMezatDeepLink('https://mezat11.com/?mode=solo'), {
    mode: 'solo',
  });
});
