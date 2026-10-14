import {
  auctionMode,
  advanceLot,
  autoCompleteAuction,
  awardCurrentLot,
  captureUndo,
  completeCurrentGroupIfLeaving,
  deadlineFor,
  estimateAuctionDuration,
  pendingStateView,
  publicStateView,
  record,
  rematchAuction,
  restartAuction,
  restoreUndo,
  settleBot,
  settleExpired,
  startAuction,
} from './auction-runtime.ts';
import {
  FORMATIONS,
  auctionOpeningPrice,
  canPlaceLotBid,
  isCoach,
  type BotStyle,
  type Formation,
} from './game-engine.ts';
import {
  persistLeaderboard,
  pruneLeaderboardIfDue,
  removeMemberLeaderboard,
  removeRoundLeaderboard,
} from './leaderboard.ts';
import {
  CHAT_HISTORY_LIMIT,
  chatModerationMessage,
  containsBlockedTerm,
  moderateDisplayName,
  moderationMessage,
  normalizeDisplayName,
  sanitizeChatMessage,
} from './moderation.ts';
import { reopenLiveLot, validateLotAction } from './room-rules.ts';
import {
  assessAgeDeclaration,
  mayPublishToLeaderboard,
  mayUseChat,
  minorRestrictionMessage,
  type AgeDeclaration,
} from './age-policy.ts';
import { auth, cleanup, code, db, digest, ensure, saveState, token } from './room-store.ts';
import { RoomError, normalizedSettings, type RoomSettings, type RoomState } from './room-types.ts';

export async function createRoom(rawName: string, settings: RoomSettings, declaration: AgeDeclaration = {}) {
  const moderation = moderateDisplayName(rawName);
  if (!moderation.ok) throw new RoomError('NAME_INVALID', moderationMessage(moderation), 400);
  const assessment = assessAgeDeclaration(declaration);
  if (!assessment.ok) throw new RoomError(assessment.code, assessment.message, 400);
  const name = normalizeDisplayName(rawName);
  await cleanup();
  await pruneLeaderboardIfDue();
  for (let attempt = 0; attempt < 5; attempt++) {
    const roomCode = code(),
      hostToken = token(),
      memberToken = token(),
      memberId = crypto.randomUUID(),
      now = Date.now();
    const state: RoomState = {
      code: roomCode,
      status: 'lobby',
      settings: normalizedSettings(settings),
      members: [
        {
          id: memberId,
          name,
          role: 'manager',
          approved: true,
          leaderboardOptIn: false,
          ageBand: assessment.band,
          consent: assessment.consent,
        },
      ],
      createdAt: now,
    };
    try {
      await db().batch([
        db()
          .prepare('INSERT INTO rooms VALUES (?,?,?,?,?,?)')
          .bind(roomCode, await digest(hostToken), JSON.stringify(state), 0, now, now + 7 * 86400000),
        db()
          .prepare('INSERT INTO room_members VALUES (?,?,?,?,?,?,?)')
          .bind(roomCode, memberId, await digest(memberToken), name, 'manager', 1, now),
      ]);
      return { code: roomCode, hostToken, memberToken, memberId };
    } catch (error) {
      if (attempt === 4) throw error;
    }
  }
  throw new RoomError('ROOM_CREATE_FAILED', 'Oda oluşturulamadı. Lütfen tekrar deneyin.', 503);
}
export async function joinRoom(
  roomCode: string,
  rawName: string,
  role: 'manager' | 'spectator',
  declaration: AgeDeclaration = {},
) {
  const moderation = moderateDisplayName(rawName);
  if (!moderation.ok) throw new RoomError('NAME_INVALID', moderationMessage(moderation), 400);
  const assessment = assessAgeDeclaration(declaration);
  if (!assessment.ok) throw new RoomError(assessment.code, assessment.message, 400);
  const name = normalizeDisplayName(rawName);
  await ensure();
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await db()
      .prepare('SELECT state_json,revision FROM rooms WHERE code=? AND expires_at>?')
      .bind(roomCode, Date.now())
      .first<{ state_json: string; revision: number }>();
    if (!row) throw new RoomError('ROOM_NOT_FOUND', 'Oda bulunamadı', 404);
    const state = JSON.parse(row.state_json) as RoomState;
    if (state.status !== 'lobby') throw new RoomError('GAME_STARTED', 'Oyun başladı', 409);
    if (state.members.some((m) => m.name.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr')))
      throw new RoomError('NAME_TAKEN', 'Bu isim kullanılıyor', 409);
    if (role === 'manager' && state.members.filter((m) => m.role === 'manager').length >= 8)
      throw new RoomError('ROOM_FULL', 'Menajer kontenjanı dolu', 409);
    if (state.members.length >= 24) throw new RoomError('ROOM_FULL', 'Oda katılımcı sınırına ulaştı', 409);
    const memberId = crypto.randomUUID(),
      memberToken = token(),
      member = {
        id: memberId,
        name,
        role,
        approved: false,
        leaderboardOptIn: false,
        ageBand: assessment.band,
        consent: assessment.consent,
      };
    state.members.push(member);
    const updated = await db()
      .prepare('UPDATE rooms SET state_json=?,revision=revision+1 WHERE code=? AND revision=?')
      .bind(JSON.stringify(state), roomCode, row.revision)
      .run();
    if (!updated.meta.changes) continue;
    await db()
      .prepare('INSERT INTO room_members VALUES (?,?,?,?,?,?,?)')
      .bind(roomCode, memberId, await digest(memberToken), name, role, 0, Date.now())
      .run();
    return { code: roomCode, memberToken, memberId };
  }
  throw new RoomError('REVISION_CONFLICT', 'Oda aynı anda güncellendi. Tekrar deneyin.', 409);
}
async function actInternal(roomCode: string, plain: string, type: string, payload: Record<string, unknown> = {}) {
  const ctx = await auth(roomCode, plain);
  const { state } = ctx;
  const requireHost = () => {
    if (!ctx.isHost) throw new RoomError('FORBIDDEN', 'Bu işlemi yalnızca oda sahibi yapabilir.', 403);
  };
  const actorMember = () => state.members.find((item) => item.id === ctx.member?.member_id);
  /**
   * Minors and undeclared ages stay out of the public leaderboard and chat. The
   * check reads the authoritative room state, never the client payload, and it
   * fails closed when the band is missing.
   */
  const requireAdult = (area: 'leaderboard' | 'chat') => {
    const band = actorMember()?.ageBand ?? 'unknown';
    if (area === 'chat' ? !mayUseChat(band) : !mayPublishToLeaderboard(band))
      throw new RoomError('AGE_RESTRICTED', minorRestrictionMessage(area), 403);
  };
  try {
    validateLotAction(type, payload.lotId, state.game);
  } catch (error) {
    if ((error as Error).message === 'LOT_ID_REQUIRED')
      throw new RoomError('LOT_ID_REQUIRED', 'Bu açık artırma işlemi için güncel lot kimliği gerekli.', 400);
    throw new RoomError('STALE_LOT', 'Bu dokunuş önceki oyuncuya aitti; yeni lota uygulanmadı.', 409);
  }
  if (type === 'leave') {
    if (ctx.isHost) throw new RoomError('HOST_CANNOT_LEAVE', 'Oda sahibi oyunu bitirmeden ayrılamaz', 409);
    if (!ctx.member) throw new RoomError('AUTH_INVALID', 'Katılımcı bulunamadı', 401);
    if (state.status !== 'lobby')
      throw new RoomError(
        'GAME_STARTED',
        'Oyun başladıktan sonra odadan ayrılmak için kurucudan oyunu sonlandırmasını isteyin.',
        409,
      );
    state.members = state.members.filter((member) => member.id !== ctx.member?.member_id);
    await saveState(roomCode, state, ctx.room.revision);
    await db()
      .prepare('DELETE FROM room_members WHERE room_code=? AND member_id=?')
      .bind(roomCode, ctx.member.member_id)
      .run();
    return state;
  }
  if (type === 'addBot') {
    requireHost();
    if (state.status !== 'lobby') throw new Error('Bot yalnız lobide eklenebilir');
    if (state.members.filter((m) => m.role === 'manager').length >= 8) throw new Error('Menajer kontenjanı dolu');
    const styles: BotStyle[] = ['balanced', 'aggressive', 'value'],
      style = styles.includes(payload.style as BotStyle)
        ? (payload.style as BotStyle)
        : styles[state.members.filter((m) => m.isBot).length % styles.length],
      used = new Set(
        state.members.filter((m) => m.isBot).map((m) => Number(m.name.match(/AI Menajer (\d+)/)?.[1] || 0)),
      );
    let number = 1;
    while (used.has(number)) number++;
    state.members.push({
      id: `bot-${crypto.randomUUID()}`,
      name: `AI Menajer ${number}`,
      role: 'manager',
      approved: true,
      isBot: true,
      botStyle: style,
    });
  } else if (type === 'removeBot') {
    requireHost();
    if (state.status !== 'lobby') throw new Error('Bot yalnız lobide kaldırılabilir');
    state.members = state.members.filter((member) => member.id !== String(payload.memberId) || !member.isBot);
  } else if (type === 'chat') {
    if (!ctx.member || !ctx.member.approved)
      throw new RoomError('FORBIDDEN', 'Sohbet için onaylı katılımcı olmalısınız.', 403);
    requireAdult('chat');
    const text = sanitizeChatMessage(payload.text);
    if (!text) throw new Error('Mesaj boş olamaz');
    if (containsBlockedTerm(text)) throw new RoomError('MESSAGE_REJECTED', chatModerationMessage(), 400);
    state.chat = [
      ...(state.chat || []),
      { id: crypto.randomUUID(), memberId: ctx.member.member_id, name: ctx.member.name, text, at: Date.now() },
    ].slice(-CHAT_HISTORY_LIMIT);
  } else if (type === 'leaderboardPreference') {
    if (!ctx.member) throw new RoomError('AUTH_INVALID', 'Katılımcı bulunamadı', 401);
    const member = state.members.find((item) => item.id === ctx.member?.member_id);
    if (!member) throw new RoomError('AUTH_INVALID', 'Katılımcı bulunamadı', 401);
    if (payload.optedIn === true) requireAdult('leaderboard');
    member.leaderboardOptIn = payload.optedIn === true;
    const aliasCandidate = normalizeDisplayName(payload.alias ?? member.name) || member.name;
    if (aliasCandidate !== member.name) {
      const aliasModeration = moderateDisplayName(aliasCandidate);
      if (!aliasModeration.ok) throw new RoomError('NAME_INVALID', moderationMessage(aliasModeration), 400);
    }
    member.leaderboardAlias = aliasCandidate;
  } else if (type === 'approve') {
    requireHost();
    const id = String(payload.memberId),
      m = state.members.find((x) => x.id === id);
    if (!m) throw new Error('Katılımcı yok');
    if (m.approved) return state;
    m.approved = true;
    const membership = await db()
      .prepare('UPDATE room_members SET approved=1 WHERE room_code=? AND member_id=?')
      .bind(roomCode, id)
      .run();
    if (!membership.meta.changes) throw new RoomError('MEMBER_NOT_FOUND', 'Katılımcı kaydı bulunamadı', 409);
    try {
      await saveState(roomCode, state, ctx.room.revision);
    } catch (error) {
      const latest = await db()
        .prepare('SELECT state_json FROM rooms WHERE code=?')
        .bind(roomCode)
        .first<{ state_json: string }>();
      const alreadyApproved =
        latest &&
        (JSON.parse(latest.state_json) as RoomState).members.some((member) => member.id === id && member.approved);
      if (alreadyApproved) return JSON.parse(latest!.state_json) as RoomState;
      await db()
        .prepare('UPDATE room_members SET approved=0 WHERE room_code=? AND member_id=?')
        .bind(roomCode, id)
        .run();
      throw error;
    }
    return state;
  } else if (type === 'start') {
    requireHost();
    if (state.status !== 'lobby') throw new Error('Oyun zaten başladı');
    const members = state.members.filter((m) => m.approved && m.role === 'manager');
    if (members.length < 2) throw new Error('En az iki onaylı menajer gerekli');
    startAuction(state);
  } else if (type === 'rematch') {
    requireHost();
    if (state.status !== 'results') throw new Error('Rövanş yalnız sonuç ekranından başlatılır');
    if (state.season && state.season.round >= state.season.length) throw new Error('Sezon tamamlandı; yeni oda kurun');
    rematchAuction(state);
  } else {
    if (type === 'undo' && state.game) {
      requireHost();
      if (!restoreUndo(state)) throw new Error('Geri alınacak işlem yok');
      record(state, 'Oda sahibi son açık artırma işlemini geri aldı.');
      await saveState(roomCode, state, ctx.room.revision);
      await removeRoundLeaderboard(roomCode, state.season?.round || 1);
      return state;
    }
    if (state.status !== 'auction' || !state.game) throw new Error('Açık artırma aktif değil');
    if (type === 'autoComplete') {
      requireHost();
      autoCompleteAuction(state);
      await saveState(roomCode, state, ctx.room.revision);
      try {
        await persistLeaderboard(state);
      } catch {}
      return state;
    }
    if (type === 'restart') {
      requireHost();
      await restartAuction(state, roomCode);
      await saveState(roomCode, state, ctx.room.revision);
      return state;
    }
    if (settleExpired(state)) {
      await saveState(roomCode, state, ctx.room.revision);
      try {
        await persistLeaderboard(state);
      } catch {}
      throw new RoomError('LOT_EXPIRED', 'Süre doldu; oda güncel duruma geçirildi.', 409);
    }
    const g = state.game,
      lot = g.pool[g.index];
    if (!ctx.member || !ctx.member.approved || ctx.member.role !== 'manager')
      throw new RoomError('FORBIDDEN', 'Bu işlem için onaylı menajer yetkisi gerekli.', 403);
    const managerId = state.members
      .filter((m) => m.approved && m.role === 'manager')
      .findIndex((m) => m.id === ctx.member?.member_id);
    if (managerId < 0) throw new Error('Menajer bulunamadı');
    if (['bid', 'pass', 'sell', 'close', 'skip', 'reopen', 'manualSell', 'manualSkip', 'pause'].includes(type))
      captureUndo(state);
    if (type === 'bid') {
      if (auctionMode(state) !== 'live') throw new Error('Manuel modda teklif verilmez');
      if (g.paused || g.activeTurn === null) throw new RoomError('LOT_EXPIRED', 'Teklif süresi sona erdi', 409);
      if (g.leader === managerId) throw new Error('En yüksek teklif zaten sizde');
      const requested = payload.amount === undefined ? null : Math.round(Number(payload.amount)),
        increment = Number(payload.increment || state.settings.bidIncrement || 5),
        opening = auctionOpeningPrice(lot, g.managers);
      if (
        requested !== null &&
        (!Number.isFinite(requested) || requested < opening || (g.leader !== null && requested <= g.bid))
      )
        throw new Error(`Teklif en az $${g.leader === null ? opening : g.bid + 1}M olmalı`);
      if (requested === null && g.leader !== null && ![5, 10, 25].includes(increment))
        throw new Error('Teklif artışı geçersiz');
      const offer = requested ?? (g.leader === null ? opening : g.bid + increment),
        m = g.managers[managerId];
      if (!canPlaceLotBid(m, lot, offer, managerId, g.passed))
        throw new Error('Bütçe, kadro veya pas durumu teklife uygun değil');
      g.bid = offer;
      g.leader = managerId;
      g.nextBotAt = Date.now() + 650;
      record(state, `${m.name}, $${offer}M teklif verdi.`);
      const nextOffer = offer + 1,
        challenger = g.managers.some(
          (candidate, index) => index !== managerId && canPlaceLotBid(candidate, lot, nextOffer, index, g.passed),
        );
      if (challenger) {
        g.deadline = deadlineFor(state);
        g.activeTurn = managerId;
      } else {
        g.deadline = null;
        g.activeTurn = null;
        awardCurrentLot(state, managerId, offer);
      }
    } else if (type === 'pass') {
      if (auctionMode(state) !== 'live') throw new Error('Manuel modda teklif verilmez');
      if (g.paused || g.activeTurn === null) throw new Error('Teklifler kapalı');
      if (g.passed.includes(managerId)) throw new Error('Zaten pas geçtiniz');
      g.passed.push(managerId);
      g.feed = [`${g.managers[managerId].name} pas geçti.`, ...g.feed].slice(0, 8);
      const offer = g.leader === null ? auctionOpeningPrice(lot, g.managers) : g.bid + 1;
      const available = g.managers.some((m, i) => i !== g.leader && canPlaceLotBid(m, lot, offer, i, g.passed));
      if (available) {
        g.activeTurn = managerId;
        g.deadline = deadlineFor(state);
      } else if (g.leader === null) {
        g.activeTurn = null;
        g.deadline = null;
        g.autoAssignments = undefined;
        record(state, `${lot.name} için tüm uygun menajerler pas geçti; lot otomatik geçildi.`);
        completeCurrentGroupIfLeaving(state);
        advanceLot(state);
      } else {
        g.activeTurn = null;
        g.deadline = null;
        awardCurrentLot(state, g.leader, g.bid);
      }
    } else if (type === 'sell') {
      requireHost();
      if (auctionMode(state) !== 'live') throw new Error('Manuel modda oyuncu atama alanını kullanın');
      if (g.leader === null || g.activeTurn !== null) throw new Error('Önce teklifleri kapatın');
      awardCurrentLot(state, g.leader, g.bid);
    } else if (type === 'close') {
      requireHost();
      if (auctionMode(state) !== 'live') throw new Error('Bu işlem canlı moda aittir');
      if (g.leader === null)
        throw new RoomError('NO_BID', 'Teklif yok. Oyuncuyu geçirmek için “Lotu geç” düğmesini kullanın.', 409);
      g.activeTurn = null;
      g.deadline = null;
      record(state, 'Oda sahibi teklifleri kapattı.');
    } else if (type === 'skip') {
      requireHost();
      if (auctionMode(state) !== 'live') throw new Error('Bu işlem canlı moda aittir');
      if (g.leader !== null) throw new RoomError('HAS_BID', 'Teklif bulunan lot doğrudan geçilemez.', 409);
      g.autoAssignments = undefined;
      if (state.settings.secondChance && g.stage === 'primary' && !isCoach(lot)) g.unsold = [...(g.unsold || []), lot];
      record(state, `${lot.name} kurucu onayıyla satılmadan geçildi.`);
      completeCurrentGroupIfLeaving(state);
      advanceLot(state);
    } else if (type === 'reopen') {
      requireHost();
      if (auctionMode(state) !== 'live') throw new Error('Bu işlem canlı moda aittir');
      if (!reopenLiveLot(g, state.settings.timerSeconds || 20))
        throw new RoomError('NO_CHALLENGER', 'Teklifi yeniden açabilecek uygun başka menajer yok.', 409);
      g.nextBotAt = Date.now() + 650;
      g.feed = ['Oda sahibi teklifleri yeniden açtı; önceki paslar temizlendi.', ...g.feed].slice(0, 8);
    } else if (type === 'formation') {
      const formation = String(payload.formation) as Formation;
      if (!FORMATIONS.includes(formation)) throw new Error('Diziliş geçersiz');
      g.managers[managerId].formation = formation;
      record(state, `${g.managers[managerId].name}, ${formation} dizilişine geçti.`);
    } else if (type === 'manualSell') {
      requireHost();
      if (auctionMode(state) !== 'manual') throw new Error('Manuel mod etkin değil');
      const target = Number(payload.managerIndex),
        amount = Math.round(Number(payload.amount));
      if (!Number.isInteger(target) || !Number.isFinite(amount)) throw new Error('Menajer ve tutar gerekli');
      awardCurrentLot(state, target, amount);
    } else if (type === 'manualSkip') {
      requireHost();
      if (auctionMode(state) !== 'manual') throw new Error('Manuel mod etkin değil');
      g.autoAssignments = undefined;
      if (state.settings.secondChance && g.stage === 'primary' && !isCoach(lot)) g.unsold = [...(g.unsold || []), lot];
      g.feed = [`${lot.name} satılmadı.`, ...g.feed].slice(0, 8);
      completeCurrentGroupIfLeaving(state);
      advanceLot(state);
    } else if (type === 'pause') {
      requireHost();
      if (auctionMode(state) !== 'live') throw new Error('Manuel modda duraklatma gerekmez');
      if (g.paused) {
        if (g.activeTurn === null)
          throw new RoomError('AUCTION_CLOSED', 'Kapalı teklif yeniden başlatılamaz; “Yeniden aç” kullanın.', 409);
        g.paused = false;
        g.deadline = Date.now() + Math.max(1000, g.pausedRemainingMs ?? (state.settings.timerSeconds || 20) * 1000);
        g.pausedRemainingMs = undefined;
      } else {
        if (g.activeTurn === null || !g.deadline)
          throw new RoomError('AUCTION_CLOSED', 'Yalnız açık bir teklif duraklatılabilir.', 409);
        g.pausedRemainingMs = Math.max(0, g.deadline - Date.now());
        g.paused = true;
        g.deadline = null;
      }
    } else throw new Error('Bilinmeyen işlem');
  }
  if (state.status === 'auction') settleBot(state);
  await saveState(roomCode, state, ctx.room.revision);
  if (type === 'leaderboardPreference' && payload.optedIn !== true && ctx.member)
    await removeMemberLeaderboard(roomCode, ctx.member.member_id);
  try {
    await persistLeaderboard(state);
  } catch {}
  return state;
}
export async function act(
  roomCode: string,
  plain: string,
  type: string,
  payload: Record<string, unknown> = {},
  requestId?: string,
) {
  await ensure();
  const actorHash = await digest(plain),
    safeId = requestId && /^[A-Za-z0-9._:-]{8,100}$/.test(requestId) ? requestId : undefined,
    actionHash = await digest(JSON.stringify({ type, payload })),
    pending = `__PENDING__:${actionHash}`,
    done = `__DONE__:${actionHash}`;
  if (safeId) {
    const claim = await db()
      .prepare(
        'INSERT OR IGNORE INTO room_actions(room_code,actor_hash,request_id,result_json,created_at) VALUES(?,?,?,?,?)',
      )
      .bind(roomCode, actorHash, safeId, pending, Date.now())
      .run();
    if (!claim.meta.changes) {
      const cached = await db()
        .prepare('SELECT result_json,created_at FROM room_actions WHERE room_code=? AND actor_hash=? AND request_id=?')
        .bind(roomCode, actorHash, safeId)
        .first<{ result_json: string; created_at: number }>();
      if (!cached) throw new RoomError('ACTION_RETRY', 'İşlem kaydı okunamadı; tekrar deneyin.', 409);
      if (cached.result_json === done || (!cached.result_json.startsWith('__') && cached.result_json.startsWith('{'))) {
        const current = await auth(roomCode, plain);
        return publicStateView(current.state);
      }
      if (cached.result_json !== pending)
        throw new RoomError('REQUEST_ID_REUSED', 'Aynı işlem kimliği farklı bir işlem için kullanılamaz.', 409);
      if (Date.now() - cached.created_at > 15000) {
        const current = await auth(roomCode, plain);
        return publicStateView(current.state);
      }
      throw new RoomError(
        'ACTION_IN_PROGRESS',
        'İşlem halen uygulanıyor; oda durumu yenilendiğinde tekrar kontrol edin.',
        409,
      );
    }
  }
  try {
    let result: RoomState | undefined;
    for (let attempt = 0; attempt < 3; attempt++)
      try {
        result = await actInternal(roomCode, plain, type, payload);
        break;
      } catch (error) {
        if (
          !(error instanceof RoomError) ||
          error.code !== 'REVISION_CONFLICT' ||
          !['bid', 'chat', 'pass', 'formation', 'leaderboardPreference'].includes(type) ||
          attempt === 2
        )
          throw error;
      }
    if (!result) throw new RoomError('ACTION_FAILED', 'İşlem tamamlanamadı.', 409);
    const safe = publicStateView(result);
    if (safeId)
      await db()
        .prepare(
          'UPDATE room_actions SET result_json=? WHERE room_code=? AND actor_hash=? AND request_id=? AND result_json=?',
        )
        .bind(done, roomCode, actorHash, safeId, pending)
        .run();
    return safe;
  } catch (error) {
    if (safeId)
      await db()
        .prepare('DELETE FROM room_actions WHERE room_code=? AND actor_hash=? AND request_id=? AND result_json=?')
        .bind(roomCode, actorHash, safeId, pending)
        .run();
    throw error;
  }
}
export async function publicRoom(roomCode: string, plain: string) {
  let ctx = await auth(roomCode, plain);
  if (!ctx.isHost && ctx.member && !ctx.member.approved)
    return {
      state: pendingStateView(ctx.state),
      revision: ctx.room.revision,
      isHost: false,
      memberId: ctx.member.member_id,
      viewerAgeBand: ctx.state.members.find((item) => item.id === ctx.member?.member_id)?.ageBand ?? 'unknown',
      serverTime: Date.now(),
      estimatedDuration: estimateAuctionDuration(
        ctx.state.settings,
        ctx.state.members.filter((member) => member.approved && member.role === 'manager').length,
      ),
    };
  if (settleExpired(ctx.state) || settleBot(ctx.state)) {
    try {
      await saveState(roomCode, ctx.state, ctx.room.revision);
      ctx.room.revision++;
      try {
        await persistLeaderboard(ctx.state);
      } catch {}
    } catch {
      ctx = await auth(roomCode, plain);
    }
  }
  return {
    state: publicStateView(ctx.state),
    revision: ctx.room.revision,
    isHost: ctx.isHost,
    memberId: ctx.member?.member_id || null,
    viewerAgeBand: ctx.state.members.find((item) => item.id === ctx.member?.member_id)?.ageBand ?? 'unknown',
    serverTime: Date.now(),
    estimatedDuration: estimateAuctionDuration(
      ctx.state.settings,
      ctx.state.members.filter((member) => member.approved && member.role === 'manager').length,
    ),
  };
}

export { RoomError, defaultSettings } from './room-types.ts';
export type { RoomMember, RoomSettings, RoomState } from './room-types.ts';
export { digest, rateLimit } from './room-store.ts';
export { leaderboard, deleteLeaderboardEntry } from './leaderboard.ts';
export {
  advanceLot,
  auctionMode,
  awardCurrentLot,
  captureUndo,
  publicStateView,
  restoreUndo,
  settleBot,
  settleExpired,
} from './auction-runtime.ts';
