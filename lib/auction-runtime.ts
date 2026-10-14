import {
  auctionGroupKey,
  auctionLimit,
  auctionOpeningPrice,
  auctionPassIsSafe,
  BENCH_SLOTS,
  botMaximumBid,
  botThinkDelayMs,
  calculateStartingBudget,
  canPlaceLotBid,
  chooseBotFormation,
  fillMissingBenchSlot,
  fillMissingCoaches,
  fillMissingSlot,
  hashSeed,
  isBonusPlayerLot,
  isCoach,
  lotFilled,
  mixedAuctionLots,
  optimizeStartingEleven,
  positionAuctionLots,
  randomSlotOrder,
  rankManagers,
  ratingLevel,
  seededRandom,
  selectStarsAndScrubs,
  shuffleSeeded,
  standardLeaderboardEligibility,
  type AuctionLot,
  type BenchSlot,
  type Era,
  type Footballer,
  type Manager,
  type PoolSourceEntry,
  type Slot,
} from './game-engine.ts';
import { COACHES } from './coaches.ts';
import { matchesCustomPool } from './club-leagues.ts';
import { applyMediaPolicy } from './media-rights.ts';
import generated from '../app/data/auction-pool.generated.json' with { type: 'json' };
import datasetManifest from '../data/transfermarkt/dataset-manifest.json' with { type: 'json' };
import { RoomError, type RoomSettings, type RoomState } from './room-types.ts';

const slots: { key: Slot; label: string }[] = [
  { key: 'GK', label: 'Kaleci' },
  { key: 'RB', label: 'Sağ Bek' },
  { key: 'CB1', label: 'Stoper' },
  { key: 'CB2', label: 'Stoper' },
  { key: 'LB', label: 'Sol Bek' },
  { key: 'DM', label: 'Savunmacı Merkez Orta Saha' },
  { key: 'CM', label: 'İki Yönlü Merkez Orta Saha' },
  { key: 'AM', label: 'Ofansif Orta Saha' },
  { key: 'RW', label: 'Sağ Açık' },
  { key: 'LW', label: 'Sol Açık' },
  { key: 'ST', label: 'Forvet' },
];
const sourceData = generated as unknown as Record<Era, Record<Slot, PoolSourceEntry[]>>;
export function rememberCurrentLots(state: RoomState) {
  state.recentLotIds = [
    ...new Set([...(state.recentLotIds || []), ...(state.game?.pool || []).map((lot) => lot.id)]),
  ].slice(-600);
}
export function recentLotIds(state: RoomState) {
  return new Set(state.recentLotIds || []);
}
export function estimateAuctionDuration(settings: RoomSettings, managerCount: number) {
  const groups = 11 + (settings.includeBench ? 4 : 0) + 1,
    lots = groups * (Math.max(2, managerCount) + 1),
    secondsPerLot = settings.auctionMode === 'manual' ? 12 : (settings.timerSeconds || 20) + 4;
  return { lots, minutes: Math.max(1, Math.ceil((lots * secondsPerLot) / 60)), fastRecommended: lots >= 80 };
}
export function standardEligibility(state: RoomState) {
  const humanCount = state.members.filter(
      (member) => member.approved && member.role === 'manager' && !member.isBot,
    ).length,
    aiManagerCount = state.members.filter(
      (member) => member.approved && member.role === 'manager' && member.isBot,
    ).length,
    scenarioId = state.settings.scenarioId || 'classic',
    poolMode = state.settings.poolMode || 'generated',
    evaluation = standardLeaderboardEligibility({
      era: state.settings.era,
      selectedTiers: state.settings.selectedTiers,
      benchEnabled: Boolean(state.settings.includeBench),
      mode: 'online',
      auctionMode: state.settings.auctionMode || 'live',
      scenarioId,
      customPool: poolMode === 'custom',
      automationUsed: Boolean(state.autoCompleted),
      humanManagerCount: humanCount,
      aiManagerCount,
      timerSeconds: state.settings.timerSeconds || 20,
      bidIncrement: state.settings.bidIncrement || 5,
      datasetVersion: datasetManifest.datasetVersion,
      scoreVersion: datasetManifest.scoreVersion,
    });
  return {
    standardEligible: evaluation.eligible,
    autoCompleted: Boolean(state.autoCompleted),
    humanCount,
    aiManagerCount,
    scenarioId,
    poolMode,
    includeBench: Boolean(state.settings.includeBench),
    era: state.settings.era,
    selectedTiers: [...state.settings.selectedTiers],
    timerSeconds: state.settings.timerSeconds || 20,
    bidIncrement: state.settings.bidIncrement || 5,
    datasetVersion: datasetManifest.datasetVersion,
    scoreVersion: datasetManifest.scoreVersion,
    rulesFingerprint: evaluation.fingerprint,
  };
}
export function publicStateView(state: RoomState) {
  const view = structuredClone(state),
    sourceGame = state.game;
  if (!view.game || !sourceGame) return view;
  const current = sourceGame.pool[sourceGame.index],
    key = current ? auctionGroupKey(current) : '',
    groupOrdinal = current
      ? sourceGame.pool.slice(0, sourceGame.index + 1).filter((lot) => auctionGroupKey(lot) === key).length
      : 0;
  view.game.publicMeta = {
    currentIsBonus: Boolean(current && isBonusPlayerLot(sourceGame.pool, sourceGame.index, sourceGame.managers.length)),
    currentPassIsSafe: Boolean(current && auctionPassIsSafe(sourceGame.pool, sourceGame.index, sourceGame.managers)),
    groupOrdinal,
    totalLots: sourceGame.pool.length,
    canUndo: Boolean(sourceGame.undo),
  };
  view.game.undo = undefined;
  view.game.undoStatus = undefined;
  const { pool, index } = view.game;
  view.game.pool = pool.map((lot, lotIndex) => {
    if (lotIndex < index) return lot;
    if (lotIndex === index) {
      if (view.settings.revealRatings) return lot;
      const safe: Partial<AuctionLot> = { ...lot };
      delete safe.rating;
      return safe as AuctionLot;
    }
    return {
      id: `hidden-${lotIndex}`,
      name: 'Gizli lot',
      slot: 'ST',
      role: 'Sıradaki lot',
      rating: 0,
      price: 0,
      nation: '',
      club: '',
    } satisfies Footballer;
  });
  return view;
}
export function pendingStateView(state: RoomState): RoomState {
  return {
    code: state.code,
    status: 'lobby',
    settings: state.settings,
    members: state.members.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      approved: member.approved,
      isBot: member.isBot,
      botStyle: member.botStyle,
    })),
    createdAt: state.createdAt,
  };
}
export function buildPool(settings: RoomSettings, count: number, seed: string, excluded: Set<string>): AuctionLot[] {
  const random = seededRandom(hashSeed(seed));
  const footballers = randomSlotOrder(slots, random).flatMap((s) => {
    const source = sourceData[settings.era][s.key] || [],
      selected = source.filter((p) => settings.selectedTiers.includes(ratingLevel(p.rating))),
      custom = new Set(settings.customPlayerIds || []),
      scoped =
        settings.poolMode === 'custom' && settings.customPoolSelections?.length
          ? selected.filter((p) => matchesCustomPool(p.club, settings.customPoolSelections!, p.league))
          : [],
      favorites = settings.poolMode === 'custom' ? selected.filter((p) => custom.has(`${s.key}:${p.id}`)) : [],
      preferred = [...favorites, ...scoped.filter((p) => !favorites.includes(p))],
      ordered = [...preferred, ...selected.filter((p) => !preferred.includes(p))],
      candidates = ordered.map((p) =>
        applyMediaPolicy({
          id: `tm-${p.id}-${s.key}`,
          name: p.name,
          slot: s.key,
          role: s.label,
          rating: p.rating,
          price: p.price,
          nation: p.country.slice(0, 3).toUpperCase(),
          club: p.club,
          league: p.league,
          image: p.image,
          clubLogo: p.clubLogo,
        } satisfies Footballer),
      ),
      preferredLots = candidates.slice(0, Math.min(preferred.length, count + 1));
    const window = settings.quality === 'best' ? candidates.slice(0, Math.max(160, (count + 1) * 12)) : candidates,
      rest = window.filter((player) => !preferredLots.some((favorite) => favorite.id === player.id));
    if (settings.scenarioId === 'stars-and-scrubs' && !preferredLots.length && rest.length) {
      const freshRest = rest.filter((player) => !excluded.has(player.id)),
        sourcePool = freshRest.length >= count + 1 ? freshRest : rest;
      return shuffleSeeded(selectStarsAndScrubs(sourcePool, settings.selectedTiers, count + 1, random), random);
    }
    return shuffleSeeded(
      [
        ...preferredLots,
        ...positionAuctionLots(
          rest,
          excluded,
          count + 1 - preferredLots.length,
          random,
          s.key === 'ST' ? 0.72 : 0.3,
          s.key === 'ST' ? 3 : 2.5,
        ),
      ],
      random,
    );
  });
  const starterNames = new Set(footballers.map((player) => player.name));
  const bench = settings.includeBench
    ? randomSlotOrder(BENCH_SLOTS, random).flatMap((group) => {
        const candidates = group.sourceSlots
          .flatMap((slot) =>
            (sourceData[settings.era][slot] || [])
              .filter((p) => settings.selectedTiers.includes(ratingLevel(p.rating)))
              .map((p) =>
                applyMediaPolicy({
                  id: `tm-${p.id}-${group.key}`,
                  name: p.name,
                  slot,
                  benchSlot: group.key,
                  role: group.label,
                  rating: p.rating,
                  price: p.price,
                  nation: p.country.slice(0, 3).toUpperCase(),
                  club: p.club,
                  league: p.league,
                  image: p.image,
                  clubLogo: p.clubLogo,
                } satisfies Footballer),
              ),
          )
          .filter((player) => !starterNames.has(player.name));
        const scoped =
            settings.poolMode === 'custom'
              ? candidates.filter((player) => {
                  const sourceId = player.id.match(/^tm-(\d+)-/)?.[1];
                  return Boolean(
                    (sourceId && settings.customPlayerIds?.some((id) => id.endsWith(`:${sourceId}`))) ||
                    (settings.customPoolSelections?.length &&
                      player.club &&
                      matchesCustomPool(player.club, settings.customPoolSelections, player.league)),
                  );
                })
              : [],
          preferred = shuffleSeeded(scoped, random).slice(0, count + 1),
          rest = candidates.filter((player) => !preferred.some((chosen) => chosen.id === player.id)),
          window =
            settings.quality === 'best'
              ? rest.sort((a, b) => b.rating - a.rating).slice(0, Math.max(180, (count + 1) * 16))
              : rest;
        return [...preferred, ...positionAuctionLots(window, excluded, count + 1 - preferred.length, random, 0.45, 3)];
      })
    : [];
  const coaches = mixedAuctionLots(COACHES, excluded, count + 1, random).map((coach) => applyMediaPolicy(coach));
  return [...footballers, ...bench, ...coaches] satisfies AuctionLot[];
}
export const auctionMode = (state: RoomState) => state.settings.auctionMode || 'live';
export const deadlineFor = (state: RoomState) => Date.now() + (state.settings.timerSeconds || 20) * 1000;
function completeSlot(state: RoomState, slot: Slot) {
  const g = state.game;
  if (!g) return;
  const role = slots.find((item) => item.key === slot)?.label || slot,
    result = fillMissingSlot(
      g.managers,
      slot,
      sourceData[state.settings.era][slot] || [],
      role,
      `${state.code}-${g.index}`,
      g.pool.map((lot) => lot.name),
      state.settings.selectedTiers,
    );
  g.managers = result.managers;
  if (result.assignments.length) {
    g.autoAssignments = [
      ...(g.autoAssignments || []),
      ...result.assignments.map((item) => ({ managerName: item.managerName, player: item.player, fee: item.fee })),
    ];
    g.feed = [
      ...result.assignments.map(
        (item) =>
          `${item.managerName}, ${role} pozisyonunu boş bıraktığı için ${item.player.name} ${ratingLevel(item.player.rating)} seviyesinde $${item.fee}M karşılığında otomatik atandı.`,
      ),
      ...g.feed,
    ].slice(0, 8);
  }
}
function completeBench(state: RoomState, benchSlot: BenchSlot) {
  const g = state.game;
  if (!g) return;
  const group = BENCH_SLOTS.find((item) => item.key === benchSlot),
    candidates = (group?.sourceSlots || []).flatMap((slot) =>
      (sourceData[state.settings.era][slot] || []).map((player) => ({ ...player, slot })),
    ),
    result = fillMissingBenchSlot(
      g.managers,
      benchSlot,
      candidates,
      group?.label || benchSlot,
      `${state.code}-${g.index}`,
      g.pool.map((lot) => lot.name),
      state.settings.selectedTiers,
    );
  g.managers = result.managers;
  if (result.assignments.length) {
    g.autoAssignments = [
      ...(g.autoAssignments || []),
      ...result.assignments.map((item) => ({ managerName: item.managerName, player: item.player, fee: item.fee })),
    ];
    g.feed = [
      ...result.assignments.map(
        (item) =>
          `${item.managerName}, ${group?.label || benchSlot} yuvasını boş bıraktığı için ${item.player.name} ${ratingLevel(item.player.rating)} seviyesinde $${item.fee}M karşılığında otomatik atandı.`,
      ),
      ...g.feed,
    ].slice(0, 8);
  }
}
function completeGroup(state: RoomState, lot: AuctionLot) {
  if (isCoach(lot)) return;
  if (lot.benchSlot) completeBench(state, lot.benchSlot);
  else completeSlot(state, lot.slot);
}
export function completeCurrentGroupIfLeaving(state: RoomState) {
  const g = state.game;
  if (!g) return;
  const current = g.pool[g.index];
  let next = g.index + 1;
  while (next < g.pool.length && g.managers.every((manager) => lotFilled(manager, g.pool[next]))) next++;
  if (next >= g.pool.length || auctionGroupKey(g.pool[next]) !== auctionGroupKey(current))
    completeGroup(state, current);
}
function completePlayers(state: RoomState) {
  for (const item of slots) completeSlot(state, item.key);
  if (state.settings.includeBench) for (const item of BENCH_SLOTS) completeBench(state, item.key);
}
function completeAllSlots(state: RoomState) {
  completePlayers(state);
  const g = state.game;
  if (g) {
    const result = fillMissingCoaches(g.managers, COACHES, `${state.code}-final`);
    g.managers = result.managers.map(optimizeStartingEleven);
    if (result.assignments.length) {
      const notes = result.assignments.map(
        (item) =>
          `${item.managerName} teknik direktör almadan bitirdiği için ${item.coach.name}, $${item.fee}M karşılığında otomatik atandı.`,
      );
      g.feed = [...notes, ...g.feed].slice(0, 8);
      g.audit = [...(g.audit || []), ...notes];
    }
  }
}
export function record(state: RoomState, message: string) {
  const g = state.game;
  if (!g) return;
  g.feed = [message, ...g.feed].slice(0, 8);
  g.audit = [...(g.audit || []), message].slice(-80);
}
type UndoEnvelope = {
  version: 2;
  game: Omit<NonNullable<RoomState['game']>, 'pool' | 'undo' | 'undoStatus'> & { pool?: AuctionLot[] };
  poolIds?: string[];
  poolPaidPrices?: Record<number, number>;
  status?: RoomState['status'];
  season?: RoomState['season'];
  completedAt?: number;
  autoCompleted?: boolean;
};
export function captureUndo(state: RoomState) {
  const g = state.game;
  if (!g) return;
  const poolPaidPrices: Record<number, number> = {};
  g.pool.forEach((lot, index) => {
    if (typeof lot.paidPrice === 'number') poolPaidPrices[index] = lot.paidPrice;
  });
  const envelope: UndoEnvelope = {
    version: 2,
    game: { ...g, pool: undefined, undo: undefined, undoStatus: undefined },
    poolIds: g.pool.map((lot) => lot.id),
    poolPaidPrices,
    status: state.status,
    season: state.season,
    completedAt: state.completedAt,
    autoCompleted: state.autoCompleted,
  };
  g.undo = JSON.stringify(envelope);
  g.undoStatus = state.status === 'results' ? 'results' : 'auction';
}
export function restoreUndo(state: RoomState): boolean {
  const g = state.game;
  if (!g?.undo) return false;
  const currentPool = g.pool;
  const parsed = JSON.parse(g.undo) as UndoEnvelope;
  if (parsed.version === 2 && parsed.game) {
    let restoredPool: AuctionLot[];
    if (Array.isArray(parsed.game.pool)) {
      restoredPool = parsed.game.pool;
    } else if (Array.isArray(parsed.poolIds)) {
      const byId = new Map(currentPool.map((lot) => [lot.id, lot]));
      restoredPool = parsed.poolIds
        .map((id, index) => {
          const base = byId.get(id) ?? byId.get(id.replace(/-r2$/, ''));
          if (!base) return undefined;
          const paidPrice = parsed.poolPaidPrices?.[index];
          const copy: AuctionLot = { ...base };
          if (typeof paidPrice === 'number') copy.paidPrice = paidPrice;
          else delete copy.paidPrice;
          return copy;
        })
        .filter((lot): lot is AuctionLot => Boolean(lot));
    } else {
      restoredPool = currentPool;
    }
    state.game = { ...parsed.game, pool: restoredPool, undo: undefined, undoStatus: undefined };
    state.status = parsed.status || 'auction';
    state.season = parsed.season;
    state.completedAt = parsed.completedAt;
    state.autoCompleted = parsed.autoCompleted;
  } else {
    state.game = parsed as unknown as NonNullable<RoomState['game']>;
    state.status = 'auction';
    state.completedAt = undefined;
    state.autoCompleted = false;
  }
  return true;
}
export function advanceLot(state: RoomState) {
  const g = state.game;
  if (!g) return;
  g.paused = false;
  g.pausedRemainingMs = undefined;
  const current = g.pool[g.index];
  let next = g.index + 1;
  while (next < g.pool.length && g.managers.every((m) => lotFilled(m, g.pool[next]))) next++;
  const enteringCoaches = next < g.pool.length && isCoach(g.pool[next]) && !isCoach(current);
  if (enteringCoaches && g.stage === 'primary' && state.settings.secondChance) {
    const retry = (g.unsold || [])
      .filter((lot) => !isCoach(lot) && g.managers.some((manager) => !lotFilled(manager, lot)))
      .map((lot) => ({ ...lot, id: `${lot.id}-r2`, price: Math.max(5, Math.floor((lot.price * 0.7) / 5) * 5) }));
    if (retry.length) {
      g.pool.splice(next, 0, ...retry);
      g.stage = 'secondChance';
      record(state, `${retry.length} satılmayan oyuncu indirimli ikinci şans turuna döndü.`);
    }
  }
  next = g.index + 1;
  while (next < g.pool.length && g.managers.every((m) => lotFilled(m, g.pool[next]))) next++;
  const missed = [...g.pool.slice(g.index + 1, next)]
    .reverse()
    .find(
      (lot): lot is Footballer => !isCoach(lot) && isBonusPlayerLot(g.pool, g.pool.indexOf(lot), g.managers.length),
    );
  g.bonusReveal = missed
    ? { name: missed.name, rating: missed.rating, role: missed.role, image: missed.image }
    : undefined;
  const nextIsCoach = next < g.pool.length && isCoach(g.pool[next]);
  if (
    !isCoach(current) &&
    (next >= g.pool.length || auctionGroupKey(g.pool[next]) !== auctionGroupKey(current)) &&
    (!state.settings.secondChance || g.stage === 'secondChance')
  )
    completeGroup(state, current);
  if (nextIsCoach && g.stage !== 'coach') {
    completePlayers(state);
    g.stage = 'coach';
  }
  if (next >= g.pool.length) {
    completeAllSlots(state);
    for (const manager of g.managers)
      manager.formation = manager.isBot
        ? chooseBotFormation(manager)
        : manager.formation || state.settings.formation || '4-2-3-1';
    const ranked = rankManagers(g.managers);
    if (!state.season) state.season = { round: 1, length: state.settings.seasonLength || 1, standings: {} };
    ranked.forEach((manager, index) => {
      const member = state.members.filter((item) => item.approved && item.role === 'manager')[manager.id],
        key = member?.id || String(manager.id),
        old = state.season!.standings[key] || { name: manager.name, points: 0, wins: 0, totalScore: 0 };
      state.season!.standings[key] = {
        name: manager.name,
        points: old.points + (index === 0 ? 3 : index === 1 ? 1 : 0),
        wins: old.wins + (index === 0 ? 1 : 0),
        totalScore: old.totalScore + manager.score,
      };
    });
    state.status = 'results';
    state.completedAt = Date.now();
    g.deadline = null;
    g.activeTurn = null;
    g.nextBotAt = undefined;
    return;
  }
  g.index = next;
  g.bid = 0;
  g.leader = null;
  g.passed = [];
  g.nextBotAt = Date.now() + 650;
  if (auctionMode(state) === 'manual') {
    g.activeTurn = 0;
    g.deadline = null;
    return;
  }
  const price = auctionOpeningPrice(g.pool[next], g.managers);
  g.activeTurn = g.managers.findIndex((m, i) => canPlaceLotBid(m, g.pool[next], price, i));
  g.deadline = g.activeTurn === null || g.activeTurn < 0 ? null : deadlineFor(state);
  if (g.activeTurn < 0) g.activeTurn = null;
}
export function awardCurrentLot(state: RoomState, managerIndex: number, amount: number) {
  const g = state.game;
  if (!g) throw new Error('Açık artırma aktif değil');
  g.autoAssignments = undefined;
  const lot = g.pool[g.index],
    winner = g.managers[managerIndex];
  if (!winner) throw new Error('Menajer bulunamadı');
  if (!canPlaceLotBid(winner, lot, amount, managerIndex)) throw new Error('Tutar veya kadro uygun değil');
  const awarded: AuctionLot = { ...lot, paidPrice: amount };
  g.pool[g.index] = awarded;
  if (isCoach(awarded)) winner.coach = awarded;
  else if (awarded.benchSlot) winner.bench = { ...(winner.bench || {}), [awarded.benchSlot]: awarded };
  else winner.squad[awarded.slot] = awarded;
  winner.budget -= amount;
  winner.spent += amount;
  g.lastSold = {
    lotId: lot.id,
    playerName: lot.name,
    role: lot.role,
    managerId: winner.id,
    managerName: winner.name,
    amount,
    at: Date.now(),
  };
  record(state, `${lot.name}, ${winner.name} takımına $${amount}M karşılığında katıldı.`);
  completeCurrentGroupIfLeaving(state);
  advanceLot(state);
}
export function settleExpired(state: RoomState) {
  const g = state.game;
  if (
    state.status !== 'auction' ||
    !g ||
    auctionMode(state) !== 'live' ||
    !g.deadline ||
    g.deadline > Date.now() ||
    g.activeTurn === null
  )
    return false;
  captureUndo(state);
  g.deadline = null;
  g.activeTurn = null;
  if (g.leader === null) {
    g.autoAssignments = undefined;
    const lot = g.pool[g.index];
    record(state, `${lot.name} için süre doldu ve teklif gelmedi.`);
    completeCurrentGroupIfLeaving(state);
    advanceLot(state);
  } else {
    record(state, 'Süre doldu; en yüksek teklif otomatik olarak kabul edildi.');
    awardCurrentLot(state, g.leader, g.bid);
  }
  return true;
}
export function settleBot(state: RoomState) {
  const g = state.game,
    now = Date.now();
  if (state.status !== 'auction' || !g || auctionMode(state) !== 'live' || g.paused || g.activeTurn === null)
    return false;
  if (g.nextBotAt === undefined) {
    g.nextBotAt = now + 650;
    return true;
  }
  if (g.nextBotAt > now) return false;
  const lot = g.pool[g.index],
    increment = state.settings.bidIncrement || 5,
    offer = g.leader === null ? auctionOpeningPrice(lot, g.managers) : g.bid + increment,
    group = auctionGroupKey(lot),
    remainingLotsInGroup = g.pool.slice(g.index).filter((candidate) => auctionGroupKey(candidate) === group).length,
    managersMissingGroup = g.managers.filter((manager) => !lotFilled(manager, lot)).length,
    context = { lotIndex: g.index, totalLots: g.pool.length, remainingLotsInGroup, managersMissingGroup };
  const options = g.managers
    .map((manager, index) => {
      const rivalLimits = g.managers
        .filter((other, otherIndex) => otherIndex !== index && !lotFilled(other, lot) && !g.passed.includes(otherIndex))
        .map((other) => auctionLimit(other, lot));
      const maxRivalLimit = rivalLimits.length ? Math.max(...rivalLimits) : 0;
      return {
        manager,
        index,
        max: manager.isBot
          ? botMaximumBid(manager, lot, `${state.code}-${g.index}-${g.bid}`, state.settings.revealRatings, {
              ...context,
              maxRivalLimit,
            })
          : 0,
      };
    })
    .filter(
      (item) =>
        item.index !== g.leader && canPlaceLotBid(item.manager, lot, offer, item.index, g.passed) && item.max >= offer,
    )
    .sort((a, b) => b.max - a.max || a.index - b.index);
  const choice = options[0];
  if (!choice) {
    g.nextBotAt = undefined;
    return false;
  }
  captureUndo(state);
  g.bid = offer;
  g.leader = choice.index;
  g.activeTurn = choice.index;
  g.deadline = deadlineFor(state);
  const difficulty =
    choice.manager.botStyle === 'aggressive'
      ? 'expert'
      : choice.manager.botStyle === 'value'
        ? 'beginner'
        : 'average';
  g.nextBotAt = now + botThinkDelayMs(`${state.code}-${g.index}-${offer}`, difficulty);
  record(state, `${choice.manager.name} (AI), $${offer}M teklif verdi.`);
  return true;
}
export function autoCompleteAuction(state: RoomState) {
  captureUndo(state);
  state.autoCompleted = true;
  let steps = 0;
  while (state.status === 'auction' && state.game && steps++ < 2500) {
    const g = state.game,
      lot = g.pool[g.index],
      opening = auctionOpeningPrice(lot, g.managers),
      random = seededRandom(hashSeed(`${state.code}-auto-${g.index}-${lot.id}`)),
      group = auctionGroupKey(lot),
      context = {
        lotIndex: g.index,
        totalLots: g.pool.length,
        remainingLotsInGroup: g.pool.slice(g.index).filter((candidate) => auctionGroupKey(candidate) === group).length,
        managersMissingGroup: g.managers.filter((manager) => !lotFilled(manager, lot)).length,
      },
      candidates = g.managers
        .map((manager, index) => {
          const maximum = auctionLimit(manager, lot),
            need = lotFilled(manager, lot) ? 0 : 1,
            generic = Math.min(
              maximum,
              Math.max(opening, Math.round((lot.price * 0.7 + lot.rating * 0.22 + random() * 24 + need * 8) / 5) * 5),
            ),
            valuation = manager.isBot
              ? botMaximumBid(manager, lot, `${state.code}-auto-${g.index}`, state.settings.revealRatings, context)
              : generic;
          return { index, manager, valuation };
        })
        .filter((item) => item.valuation >= opening && canPlaceLotBid(item.manager, lot, opening, item.index))
        .sort((a, b) => b.valuation - a.valuation || b.manager.budget - a.manager.budget || a.index - b.index);
    if (!candidates.length) {
      g.autoAssignments = undefined;
      completeCurrentGroupIfLeaving(state);
      advanceLot(state);
      continue;
    }
    const winner = candidates[0],
      runnerUp = candidates[1],
      increment = state.settings.bidIncrement || 5,
      amount = Math.min(
        winner.valuation,
        Math.max(opening, runnerUp ? Math.min(winner.valuation, runnerUp.valuation + increment) : opening),
      );
    awardCurrentLot(state, winner.index, amount);
  }
  if (state.status === 'auction')
    throw new RoomError('AUTO_COMPLETE_LIMIT', 'Otomatik tamamlama güvenlik sınırına ulaştı.', 409);
  if (state.game)
    state.game.audit = [`Kalan açık artırmalar oda sahibi onayıyla otomatik tamamlandı.`, ...(state.game.audit || [])];
}
function auctionBudget(state: RoomState, pool: AuctionLot[]) {
  const base =
    calculateStartingBudget(
      pool.filter((lot): lot is Footballer => !isCoach(lot) && !lot.benchSlot),
      state.settings.quality,
    ) + (state.settings.includeBench ? 250 : 0);
  return state.settings.scenarioId === 'budget-crunch' ? Math.floor((base * 0.75) / 5) * 5 : base;
}

function auctionManagers(state: RoomState, budget: number): Manager[] {
  return state.members
    .filter((member) => member.approved && member.role === 'manager')
    .map((member, index) => ({
      id: index,
      name: member.name,
      budget,
      spent: 0,
      squad: {},
      formation: state.settings.formation || '4-2-3-1',
      isBot: member.isBot,
      botStyle: member.botStyle,
      ...(state.settings.includeBench ? { bench: {} } : {}),
    }));
}

function openAuction(state: RoomState, pool: AuctionLot[], feed: string) {
  state.autoCompleted = false;
  state.game = {
    managers: auctionManagers(state, auctionBudget(state, pool)),
    pool,
    index: 0,
    bid: 0,
    leader: null,
    passed: [],
    activeTurn: 0,
    paused: false,
    deadline: auctionMode(state) === 'manual' ? null : deadlineFor(state),
    stage: 'primary',
    unsold: [],
    feed: [feed],
  };
  state.status = 'auction';
  settleBot(state);
}

/** Opens the first auction of a lobby. Host/status/manager-count guards live in `lib/rooms.ts`. */
export function startAuction(state: RoomState) {
  const members = state.members.filter((member) => member.approved && member.role === 'manager');
  const pool = buildPool(state.settings, members.length, state.code, recentLotIds(state));
  const manual = auctionMode(state) === 'manual';
  state.season = { round: 1, length: state.settings.seasonLength || 1, standings: {} };
  state.completedAt = undefined;
  openAuction(
    state,
    pool,
    `Oda ${state.code}: ${manual ? 'manuel ' : ' '}açık artırma başladı. ${
      state.settings.includeBench ? '11 oyuncu + 4 yedek için kişi başı ekstra $250M eklendi.' : '11 oyuncu modu.'
    }`,
  );
}

/** Opens the next game of a season. Round/status guards live in `lib/rooms.ts`. */
export function rematchAuction(state: RoomState) {
  if (state.season) state.season.round++;
  rememberCurrentLots(state);
  const members = state.members.filter((member) => member.approved && member.role === 'manager');
  const pool = buildPool(state.settings, members.length, `${state.code}-rematch-${Date.now()}`, recentLotIds(state));
  openAuction(state, pool, `Sezon ${state.season?.round || 2}. oyun, tazelenmiş oyuncu havuzuyla başladı.`);
}

export async function restartAuction(state: RoomState, roomCode: string) {
  rememberCurrentLots(state);
  const members = state.members.filter((member) => member.approved && member.role === 'manager');
  const pool = buildPool(state.settings, members.length, `${roomCode}-restart-${Date.now()}`, recentLotIds(state));
  state.season = { round: 1, length: state.settings.seasonLength || 1, standings: {} };
  state.completedAt = undefined;
  openAuction(state, pool, 'Açık artırma oda sahibi onayıyla en baştan yeniden başlatıldı.');
}

export type RecentSale = { key: string; playerName: string; managerName: string; amount?: number };

const saleLine = /^(.+?), (.+) takımına \$(\d+)M karşılığında katıldı\.$/;

function paidAmountsFromFeed(feed: string[] = []) {
  const amounts = new Map<string, number>();
  for (const line of feed) {
    const match = saleLine.exec(line);
    if (!match) continue;
    const key = `${match[1]}|${match[2]}`;
    if (!amounts.has(key)) amounts.set(key, Number(match[3]));
  }
  return amounts;
}

type LedgerGame = Pick<NonNullable<RoomState['game']>, 'managers' | 'pool' | 'index' | 'feed' | 'publicMeta'>;

function lotOwners(game: LedgerGame) {
  const owners = new Map<string, { managerName: string; paidPrice?: number }>();
  for (const manager of game.managers) {
    const lots = [
      ...Object.values(manager.squad || {}),
      ...Object.values(manager.bench || {}),
      ...(manager.coach ? [manager.coach] : []),
    ].filter((lot): lot is AuctionLot => Boolean(lot));
    for (const lot of lots) owners.set(lot.id, { managerName: manager.name, paidPrice: lot.paidPrice });
  }
  return owners;
}

export function lotOwnerName(game: LedgerGame, lotId: string) {
  return lotOwners(game).get(lotId)?.managerName;
}

export function recentSales(game: LedgerGame, limit = 6): RecentSale[] {
  const amounts = paidAmountsFromFeed(game.feed),
    owners = lotOwners(game),
    sales: RecentSale[] = [];
  for (let index = Math.min(game.index, game.pool.length) - 1; index >= 0 && sales.length < limit; index -= 1) {
    const lot = game.pool[index],
      owned = owners.get(lot.id);
    if (!owned) continue;
    const amount = owned.paidPrice ?? lot.paidPrice ?? amounts.get(`${lot.name}|${owned.managerName}`);
    sales.push({ key: lot.id, playerName: lot.name, managerName: owned.managerName, amount });
  }
  return sales;
}

export function remainingLotCount(game: LedgerGame) {
  const total = game.publicMeta?.totalLots ?? game.pool.length;
  return Math.max(0, total - game.index - 1);
}
