import test from 'node:test';
import assert from 'node:assert/strict';
import { rankManagers, type Footballer, type Manager } from '../lib/game-engine.ts';
import {
  buildMatchCommentary,
  cardRarityClass,
  computeNightAwards,
  computePartialTournamentTable,
  computePitchChemistry,
  evaluateTransferStamp,
  nationFlag,
  scoutHintForLot,
} from '../lib/player-card-flair.ts';

test('nationFlag resolves English names, Turkish names, FIFA codes and ISO codes', () => {
  assert.equal(nationFlag('Turkey'), '🇹🇷');
  assert.equal(nationFlag('Türkiye'), '🇹🇷');
  assert.equal(nationFlag('TUR'), '🇹🇷');
  assert.equal(nationFlag('Brazil'), '🇧🇷');
  assert.equal(nationFlag('ENG'), '🏴󠁧󠁢󠁥󠁮󠁧󠁿');
  assert.equal(nationFlag('UnknownPlace'), '🌍');
});

test('cardRarityClass never leaks hidden ratings and assigns accurate tiers when revealed', () => {
  assert.equal(
    cardRarityClass({ id: 'cur-1', rating: 95, slot: 'ST' }, false, 'current'),
    'rarity-mystery',
    'hidden rating must use mystery rarity class',
  );
  assert.equal(cardRarityClass({ id: 'cur-1', rating: 95, slot: 'ST' }, true, 'current'), 'rarity-superstar');
  assert.equal(cardRarityClass({ id: 'cur-2', rating: 91, slot: 'CM' }, true, 'current'), 'rarity-elite');
  assert.equal(cardRarityClass({ id: 'cur-3', rating: 87, slot: 'RB' }, true, 'current'), 'rarity-great');
  assert.equal(cardRarityClass({ id: 'legends-1', rating: 90, slot: 'AM' }, true, 'legends'), 'rarity-legend');
});

test('scoutHintForLot adapts between open-rating and hidden-rating modes', () => {
  const player: Footballer = {
    id: 'p-1',
    name: 'Arda Güler',
    role: 'On Numara',
    slot: 'AM',
    rating: 89,
    price: 45,
    nation: 'Turkey',
    club: 'Real Madrid',
  };
  const openHint = scoutHintForLot(player, true);
  assert.match(openHint.badge, /Çok iyi/);

  const hiddenHint = scoutHintForLot(player, false);
  assert.match(hiddenHint.badge, /Gözlemci Raporu/);
  assert.equal(hiddenHint.badge.includes('Çok iyi'), false);
});

test('evaluateTransferStamp classifies bargains, records and snipes', () => {
  assert.equal(evaluateTransferStamp(25, 20, 1000, 12).code, 'bargain');
  assert.equal(evaluateTransferStamp(340, 40, 1000, 10).code, 'record');
  assert.equal(evaluateTransferStamp(85, 30, 1000, 2).code, 'snipe');
  assert.equal(evaluateTransferStamp(85, 30, 1000, 10).code, 'fair');
});

test('computePitchChemistry detects club, league and nation links between adjacent slots', () => {
  const cb1: Footballer = {
    id: '1',
    name: 'Dias',
    role: 'Stoper',
    slot: 'CB1',
    rating: 90,
    price: 50,
    nation: 'Portugal',
    club: 'Manchester City',
    league: 'GB1',
  };
  const cb2: Footballer = {
    id: '2',
    name: 'Stones',
    role: 'Stoper',
    slot: 'CB2',
    rating: 87,
    price: 40,
    nation: 'England',
    club: 'Manchester City',
    league: 'GB1',
  };
  const rb: Footballer = {
    id: '3',
    name: 'Cancelo',
    role: 'Sağ Bek',
    slot: 'RB',
    rating: 86,
    price: 35,
    nation: 'Portugal',
    club: 'Al-Hilal',
    league: 'SA1',
  };
  const report = computePitchChemistry({ CB1: cb1, CB2: cb2, RB: rb }, '4-2-3-1');
  assert.equal(report.links.length, 2);
  assert.equal(
    report.links.some((l) => l.strength === 'strong'),
    true,
  );
  assert.equal(
    report.links.some((l) => l.strength === 'medium'),
    true,
  );
  assert.ok(report.score > 20);
});

test('computeNightAwards and tournament playback helpers produce deterministic summaries', () => {
  const managers: Manager[] = [
    {
      id: 0,
      name: 'Yasin',
      budget: 420,
      spent: 580,
      squad: {
        ST: { id: 's1', name: 'Haaland', role: 'Santrfor', slot: 'ST', rating: 95, price: 120, nation: 'Norway' },
      },
    },
    {
      id: 1,
      name: 'Ahmet',
      budget: 710,
      spent: 290,
      squad: {
        ST: { id: 's2', name: 'Mbappe', role: 'Santrfor', slot: 'ST', rating: 95, price: 120, nation: 'France' },
      },
    },
  ];
  const ranked = rankManagers(managers);
  const awards = computeNightAwards(ranked);
  assert.equal(awards.length, 4);
  assert.equal(awards.find((a) => a.id === 'central-bank')?.winnerName, 'Ahmet');
  assert.equal(awards.find((a) => a.id === 'big-spender')?.winnerName, 'Yasin');

  const match = { homeId: 0, awayId: 1, homeGoals: 2, awayGoals: 1 };
  const commentary = buildMatchCommentary(match, managers, 1);
  assert.match(commentary, /Haaland/);

  const table = computePartialTournamentTable(managers, [match], 1);
  assert.equal(table[0].name, 'Yasin');
  assert.equal(table[0].points, 3);
});
