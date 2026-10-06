'use client';
/* Remote player photos use their source URLs and retain a visible fallback. */
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  auctionOpeningPrice,
  canPlaceLotBid,
  FORMATIONS,
  isBonusPlayerLot,
  isCoach,
  lotFilled,
  ratingLevel,
  RATING_TIERS,
  SLOT_KEYS,
  type Formation,
  type PoolSourceEntry,
  type RatingTier,
  type Slot,
} from '../../lib/game-engine';
import { ADULT_AGE, MIN_AGE, ageBand as bandForAge, ageFromBirthYear, type AgeBand } from '../../lib/age-policy';
import type { AnalyticsEvent } from '../../lib/analytics';
import { customPoolOptions } from '../../lib/club-leagues';
import { SITE_URL } from '../../lib/site';

import { AuctionActionBar } from './bid-bar';
import { clockOffset, remainingSeconds } from './clock';
import { LeaderboardOptIn } from './leaderboard-opt-in';
import { LotLedger, lotOwnerName } from './lot-ledger';
import { ManagerDrawer } from './manager-drawer';
import { OnlineResults } from './online-results';
import { PlayerImage } from './player-image';
import { SquadPanel } from './squad-panel';
import { SquadRail } from './squad-rail';
import {
  auctionFormationPoint,
  money,
  roomSessionKey,
  type AuctionMode,
  type Room,
  type Session,
  type Settings,
} from './view-types';
/* Auction-table structure lives in its own stylesheet; the token layer stays in theme-mezat.css. */
import '../theme-auction.css';

function readSavedSession(roomCode?: string, managerName?: string) {
  const requestedCode = roomCode?.trim().toUpperCase();
  const keys = requestedCode ? [roomSessionKey(requestedCode), 'bidxi-room'] : ['bidxi-room'];
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const saved = JSON.parse(raw) as Session;
      if (!saved.code || !saved.token || (requestedCode && saved.code.toUpperCase() !== requestedCode)) continue;
      if (
        managerName &&
        saved.name &&
        saved.name.toLocaleLowerCase('tr') !== managerName.trim().toLocaleLowerCase('tr')
      )
        continue;
      return saved;
    } catch {}
  }
  return null;
}
function saveSession(session: Session) {
  localStorage.setItem('bidxi-room', JSON.stringify(session));
  localStorage.setItem(roomSessionKey(session.code), JSON.stringify(session));
}
function removeSession(session: Session) {
  localStorage.removeItem('bidxi-room');
  localStorage.removeItem(roomSessionKey(session.code));
}
const defaults: Settings = {
  era: 'current',
  quality: 'all',
  revealRatings: false,
  selectedTiers: RATING_TIERS,
  auctionMode: 'live',
  includeBench: false,
  timerSeconds: 20,
  bidIncrement: 5,
  secondChance: true,
  seasonLength: 1,
  scenarioId: 'classic',
  formation: '4-2-3-1',
  poolMode: 'generated',
  customPlayerIds: [],
  customPoolSelections: [],
  managerCountHint: 4,
  leaderboardOptIn: false,
};

class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function json(url: string, options?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    if ((error as DOMException).name === 'AbortError' || (error as DOMException).name === 'TimeoutError')
      throw new ApiError('Bağlantı zaman aşımına uğradı. Lütfen tekrar deneyin.', 'NETWORK_TIMEOUT', 408);
    throw new ApiError('Bağlantı kurulamadı. Lütfen tekrar deneyin.', 'NETWORK_ERROR', 0);
  }
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {}
  if (!response.ok)
    throw new ApiError(String(data.error || 'İşlem başarısız'), String(data.code || 'REQUEST_FAILED'), response.status);
  return data;
}

/**
 * Fire-and-forget measurement ping: the allowlisted event name and nothing else — no room code,
 * no name, no identifier (see `lib/analytics.ts`). It prefers `sendBeacon` so a navigation or a
 * closed tab cannot lose it, falls back to a `keepalive` fetch, never throws, never blocks the UI
 * and no-ops on the server.
 */
function track(event: AnalyticsEvent) {
  if (typeof navigator === 'undefined') return;
  const body = JSON.stringify({ event });
  try {
    if (navigator.sendBeacon?.('/api/analytics', new Blob([body], { type: 'application/json' }))) return;
  } catch {}
  try {
    void fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

/* The request lock intentionally uses a ref so two taps in the same render frame cannot dispatch twice. */
export function OnlineGame() {
  const router = useRouter();
  const [hydrating, setHydrating] = useState(true);
  const [screen, setScreen] = useState<'entry' | 'room'>('entry');
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [viewerBand, setViewerBand] = useState<AgeBand>('unknown');
  const [code, setCode] = useState('');
  const [role, setRole] = useState<'manager' | 'spectator'>('manager');
  const [settings, setSettings] = useState(defaults);
  const [session, setSession] = useState<Session | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [view, setView] = useState<'auction' | 'squad'>('auction');
  const [selectedManager, setSelectedManager] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [presentation, setPresentation] = useState(false);
  const [poolCatalog, setPoolCatalog] = useState<Array<PoolSourceEntry & { slot: Slot }>>([]);
  const [poolQuery, setPoolQuery] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [chatUnread, setChatUnread] = useState(0);
  const [chatBusy, setChatBusy] = useState(false);
  const [loadIssue, setLoadIssue] = useState<'network' | 'timeout' | ''>('');
  const [customBid, setCustomBid] = useState('');
  const seenChatIdsRef = useRef<Set<string>>(new Set());
  const chatInitializedRef = useRef(false);
  const inFlightActionRef = useRef(false);
  const clockOffsetRef = useRef(0);
  const chatDialogRef = useRef<HTMLElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatTriggerRef = useRef<HTMLButtonElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  /** One entry per measurement event already sent for this session/room, so a re-render cannot double count. */
  const trackedEventsRef = useRef<Set<string>>(new Set());
  const poolOptions = useMemo(
    () =>
      customPoolOptions(
        poolCatalog.map((player) => ({ club: player.club, league: player.league })),
        poolQuery,
      ),
    [poolCatalog, poolQuery],
  );
  /** Fires an event at most once per `key`; user-driven shares intentionally use `track()` directly. */
  const trackOnce = useCallback((key: string, event: AnalyticsEvent) => {
    const id = `${event}:${key}`;
    if (trackedEventsRef.current.has(id)) return;
    trackedEventsRef.current.add(id);
    track(event);
  }, []);

  const declaredAge = ageFromBirthYear(birthYear);
  const declaredBand: AgeBand = declaredAge === null ? 'unknown' : bandForAge(declaredAge);
  const ageProblem =
    birthYear.length === 4 && declaredAge === null
      ? 'Geçerli bir doğum yılı girin.'
      : declaredAge !== null && declaredAge < MIN_AGE
        ? `Bu oyun ${MIN_AGE} yaş ve üzeri içindir.`
        : null;
  const canEnter = Boolean(name.trim()) && declaredAge !== null && declaredAge >= MIN_AGE && consentAccepted && !busy;

  const loadRoom = useCallback(async (s: Session) => {
    try {
      const data = await json(`/api/rooms/${s.code}`, {
          headers: { Authorization: `Bearer ${s.token}` },
          signal: AbortSignal.timeout(10000),
        }),
        next = data.state as Room;
      if (next.game && next.game.activeTurn !== null && next.game.activeTurn < 0) next.game.activeTurn = null;
      clockOffsetRef.current = clockOffset(data.serverTime as number | undefined);
      setNow(Date.now() + clockOffsetRef.current);
      const serverBand: AgeBand =
        data.viewerAgeBand === 'adult' ? 'adult' : data.viewerAgeBand === 'minor' ? 'minor' : 'unknown';
      setViewerBand(serverBand);
      if (s.ageBand !== serverBand) saveSession({ ...s, ageBand: serverBand });
      setRoom(next);
      setIsHost(Boolean(data.isHost));
      setMemberId(data.memberId as string | null);
      setOnline(true);
      setLoadIssue('');
      return true;
    } catch (caught) {
      setOnline(false);
      const known = caught instanceof ApiError ? caught : null;
      if (known && ['AUTH_INVALID', 'ROOM_EXPIRED', 'ROOM_NOT_FOUND'].includes(known.code)) {
        removeSession(s);
        setSession(null);
        setRoom(null);
        setScreen('entry');
        setTab('join');
        setCode(s.code);
        setError(
          known.code === 'AUTH_INVALID'
            ? 'Bu cihazdaki oda oturumu artık geçerli değil. Odaya yeniden katılın.'
            : 'Oda bulunamadı veya saklama süresi sona erdi.',
        );
        history.replaceState(null, '', `/?mode=online&room=${s.code}&fresh=1`);
      } else {
        setLoadIssue(known?.code === 'NETWORK_TIMEOUT' ? 'timeout' : 'network');
        setError((caught as Error).message);
      }
      return false;
    }
  }, []);
  const refresh = useCallback(async () => {
    if (session) await loadRoom(session);
  }, [loadRoom, session]);

  useEffect(() => {
    const id = setTimeout(() => {
      const params = new URLSearchParams(location.search),
        shared = params.get('room');
      if (shared) {
        setCode(shared.toUpperCase());
        setTab('join');
      }
      if (params.has('fresh')) {
        setHydrating(false);
        return;
      }
      const saved = readSavedSession(shared || undefined);
      if (saved) {
        if (saved.name) setName(saved.name);
        if (saved.ageBand) setViewerBand(saved.ageBand);
        setSession(saved);
        setScreen('room');
        void loadRoom(saved);
      }
      setHydrating(false);
    }, 0);
    return () => clearTimeout(id);
  }, [loadRoom]);
  useEffect(() => {
    if (!session) return;
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        await refresh();
      } finally {
        running = false;
      }
    };
    // Foreground cadence keeps the auction snappy; the slow background cadence
    // matters because lot timers and bot turns are advanced by these polls —
    // if every client stopped polling the room would freeze.
    const active = setInterval(
      () => {
        if (!document.hidden) void tick();
      },
      room?.status === 'auction' ? 1500 : 3000,
    );
    const background = setInterval(() => {
      if (document.hidden) void tick();
    }, 10000);
    const onVisibility = () => {
      if (document.hidden) return;
      setNow(Date.now() + clockOffsetRef.current);
      void tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(active);
      clearInterval(background);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh, session, room?.status]);
  useEffect(() => {
    if (screen !== 'room' || room?.status !== 'auction') return;
    const id = setInterval(() => {
      if (!document.hidden) setNow(Date.now() + clockOffsetRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [screen, room?.status]);
  useEffect(() => {
    if (screen !== 'entry' || tab !== 'create' || settings.poolMode !== 'custom') return;
    let cancelled = false;
    void json(`/api/pool?era=${settings.era}`)
      .then((data) => {
        if (cancelled) return;
        const source = data as unknown as Record<Slot, PoolSourceEntry[]>;
        setPoolCatalog(SLOT_KEYS.flatMap((slot) => (source[slot] || []).map((player) => ({ ...player, slot }))));
      })
      .catch(() => setError('Özel oyuncu havuzu yüklenemedi.'));
    return () => {
      cancelled = true;
    };
  }, [screen, tab, settings.poolMode, settings.era]);
  /** Counts the moment the results screen is first painted, once per room round on this device. */
  useEffect(() => {
    if (screen !== 'room' || room?.status !== 'results' || !session) return;
    trackOnce(`${session.code}:${room.season?.round ?? 0}`, 'game_completed');
  }, [screen, room?.status, room?.season?.round, session, trackOnce]);
  /**
   * The share button lives in `online-results.tsx`, which is owned elsewhere, so the click is
   * observed instead of wrapped: every real press on the result-card button is one share.
   */
  useEffect(() => {
    if (screen !== 'room' || room?.status !== 'results') return;
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest?.('.share-card')) track('result_shared');
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [screen, room?.status]);
  useEffect(() => {
    chatInitializedRef.current = false;
    seenChatIdsRef.current.clear();
    const id = setTimeout(() => setChatUnread(0), 0);
    return () => clearTimeout(id);
  }, [session?.code]);
  useEffect(() => {
    const messages = room?.chat || [];
    if (!chatInitializedRef.current) {
      seenChatIdsRef.current = new Set(messages.map((message) => message.id));
      chatInitializedRef.current = true;
      return;
    }
    const incoming = messages.filter(
      (message) => !seenChatIdsRef.current.has(message.id) && message.memberId !== memberId,
    );
    messages.forEach((message) => seenChatIdsRef.current.add(message.id));
    const id = setTimeout(() => {
      if (chatOpen) setChatUnread(0);
      else if (incoming.length) setChatUnread((value) => value + incoming.length);
    }, 0);
    return () => clearTimeout(id);
  }, [room?.chat, chatOpen, memberId]);
  useEffect(() => {
    if (!chatOpen) return;
    const oldOverflow = document.body.style.overflow,
      trigger = chatTriggerRef.current;
    document.body.style.overflow = 'hidden';
    chatInputRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setChatOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !chatDialogRef.current) return;
      const focusable = [
        ...chatDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', key);
      trigger?.focus();
    };
  }, [chatOpen]);
  useEffect(() => {
    if (chatOpen) chatMessagesRef.current?.scrollTo({ top: chatMessagesRef.current.scrollHeight });
  }, [chatOpen, room?.chat?.length]);
  useEffect(() => {
    const sync = () => {
      if (!document.fullscreenElement) setPresentation(false);
    };
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const game = room?.game;
  const approvedManagers = room?.members.filter((member) => member.role === 'manager' && member.approved) || [];
  const myManagerIndex = approvedManagers.findIndex((member) => member.id === memberId);
  const myManager = myManagerIndex >= 0 ? game?.managers[myManagerIndex] : undefined;
  const current = game?.pool[game.index];
  const mode: AuctionMode = room?.settings.auctionMode || 'live';
  const bonusLot = Boolean(
    game && (game.publicMeta?.currentIsBonus ?? isBonusPlayerLot(game.pool, game.index, game.managers.length)),
  );
  const nextGroupLabel = 'bir sonraki pozisyon grubu';

  function toggleTier(tier: RatingTier) {
    setSettings((value) => {
      const selected = value.selectedTiers.includes(tier);
      if (selected && value.selectedTiers.length === 1) return value;
      return {
        ...value,
        selectedTiers: selected ? value.selectedTiers.filter((item) => item !== tier) : [...value.selectedTiers, tier],
      };
    });
  }

  async function enter() {
    if (!name.trim()) {
      setError('İsim gerekli');
      return;
    }
    if (declaredAge === null || declaredAge < MIN_AGE) {
      setError(ageProblem ?? `Bu oyun ${MIN_AGE} yaş ve üzeri içindir.`);
      return;
    }
    if (!consentAccepted) {
      setError('Oyunu başlatmak için gizlilik ve veri işleme bilgilendirmesini onaylamanız gerekir.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const recovered = tab === 'join' ? readSavedSession(code, name) : null;
      if (recovered) {
        saveSession(recovered);
        history.replaceState(null, '', `/?mode=online&room=${recovered.code}`);
        setSession(recovered);
        setScreen('room');
        await loadRoom(recovered);
        return;
      }
      const data =
        tab === 'create'
          ? await json('/api/rooms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, settings, birthYear: Number(birthYear), consentAccepted }),
            })
          : await json('/api/rooms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'join',
                code,
                name,
                role,
                birthYear: Number(birthYear),
                consentAccepted,
              }),
            });
      const nextSession: Session =
        tab === 'create'
          ? {
              code: String(data.code),
              token: String(data.hostToken),
              memberToken: String(data.memberToken),
              name: name.trim(),
              ageBand: declaredBand,
            }
          : { code: String(data.code), token: String(data.memberToken), name: name.trim(), ageBand: declaredBand };
      saveSession(nextSession);
      trackOnce(nextSession.code, tab === 'create' ? 'room_created' : 'room_joined');
      history.replaceState(null, '', `/?mode=online&room=${nextSession.code}`);
      setSession(nextSession);
      setScreen('room');
      if (role === 'manager' || tab === 'create') {
        const preferenceId = crypto.randomUUID();
        await json(`/api/rooms/${nextSession.code}/actions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${nextSession.token}`,
            'Idempotency-Key': preferenceId,
          },
          body: JSON.stringify({
            type: 'leaderboardPreference',
            payload: { optedIn: Boolean(settings.leaderboardOptIn), alias: (settings.leaderboardAlias || name).trim() },
            requestId: preferenceId,
          }),
        });
      }
      await loadRoom(nextSession);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function action(type: string, payload: Record<string, unknown> = {}) {
    if (!session || inFlightActionRef.current) return false;
    inFlightActionRef.current = true;
    const actionId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let outgoingPayload = payload;
    const lotScopedActions = ['bid', 'pass', 'sell', 'close', 'skip', 'reopen', 'manualSell', 'manualSkip'];
    if (lotScopedActions.includes(type)) {
      const lotId = room?.game?.pool[room.game.index]?.id;
      if (!lotId) {
        inFlightActionRef.current = false;
        return false;
      }
      outgoingPayload = { ...payload, lotId, actionId };
    } else outgoingPayload = { ...payload, actionId };
    setBusy(true);
    const send = () =>
      json(`/api/rooms/${session.code}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
          'Idempotency-Key': actionId,
        },
        body: JSON.stringify({ type, payload: outgoingPayload, requestId: actionId }),
      });
    try {
      let data: Record<string, unknown>;
      try {
        data = await send();
      } catch (caught) {
        if (type !== 'pass' || !(caught as Error).message.includes('Durum değişti')) throw caught;
        await new Promise((resolve) => setTimeout(resolve, 120));
        data = await send();
      }
      setRoom(data.state as Room);
      setError('');
      return true;
    } catch (caught) {
      setError((caught as Error).message);
      await refresh();
      return false;
    } finally {
      inFlightActionRef.current = false;
      setBusy(false);
    }
  }

  /** Every host entry point that really puts the room into a live auction counts as one start. */
  async function startAuction(type: 'start' | 'restart' | 'rematch') {
    const started = await action(type);
    if (started) track('auction_started');
    return started;
  }

  async function leave(preserveSession = room?.status !== 'lobby') {
    if (session && room?.status === 'lobby' && !isHost)
      try {
        await action('leave');
      } catch {
        return;
      }
    if (session && !preserveSession) removeSession(session);
    history.replaceState(null, '', '/?mode=online&fresh=1');
    setSession(null);
    setRoom(null);
    setScreen('entry');
    setView('auction');
  }
  async function togglePresentation() {
    const next = !presentation;
    try {
      if (next) {
        if (!document.documentElement.requestFullscreen) throw new Error('Bu tarayıcı TV modunu desteklemiyor.');
        await document.documentElement.requestFullscreen();
        setPresentation(true);
      } else {
        if (document.fullscreenElement) await document.exitFullscreen();
        setPresentation(false);
      }
    } catch (caught) {
      setPresentation(false);
      setError((caught as Error).message || 'TV modu açılamadı.');
    }
  }
  async function sendChat() {
    const text = chatText.trim();
    if (!text || !session || chatBusy) return;
    setChatBusy(true);
    const actionId = crypto.randomUUID();
    try {
      const data = await json(`/api/rooms/${session.code}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
          'Idempotency-Key': actionId,
        },
        body: JSON.stringify({ type: 'chat', payload: { text, actionId }, requestId: actionId }),
      });
      setRoom(data.state as Room);
      setChatText('');
      setError('');
    } catch (caught) {
      setError((caught as Error).message);
      await refresh();
    } finally {
      setChatBusy(false);
    }
  }
  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(room?.code || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Oda kodu kopyalanamadı.');
    }
  }
  /**
   * One-tap invite: the link carries the room code and WhatsApp campaign tags, the message is
   * plain Turkish, and the copy-to-clipboard fallback stays available on every path.
   */
  async function invite() {
    if (!room) return;
    const url = `${SITE_URL}/?mode=online&room=${room.code}&utm_source=whatsapp&utm_medium=invite&utm_campaign=oda_daveti`;
    const message = `Mezat 11'de odam açık — 6 haneli kod: ${room.code}. Tarayıcıdan katıl (uygulama indirmek yok): ${url}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Mezat 11 odasına katıl', text: message, url });
      else {
        try {
          await navigator.clipboard.writeText(url);
        } catch {}
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      track('invite_shared');
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') setError('Davet bağlantısı paylaşılamadı.');
    }
  }
  function confirmLeave(goHome = false) {
    const active = room?.status !== 'lobby',
      message = active
        ? 'Ana sayfaya dönmek istediğinize emin misiniz? Devam eden oyun oturumunuz bu cihazda korunacak ve aynı menajerle geri dönebileceksiniz.'
        : 'Odadan tamamen çıkmak istediğinize emin misiniz?';
    if (!confirm(message)) return;
    void leave(active).then(() => {
      if (goHome) router.push('/');
    });
  }
  function brandHome() {
    const active = room && room.status !== 'lobby';
    if (
      active &&
      !confirm('Ana sayfaya dönmek istediğinize emin misiniz? Devam eden oyun oturumunuz bu cihazda korunacak.')
    )
      return;
    void leave(Boolean(active)).then(() => router.push('/'));
  }

  const managerEstimate = settings.managerCountHint || 4;
  const estimatedLots = (11 + (settings.includeBench ? 4 : 0) + 1) * (managerEstimate + 1);
  const estimatedMinutes = Math.max(8, Math.round((estimatedLots * ((settings.timerSeconds || 20) + 7)) / 60));
  const pace = estimatedMinutes <= 25 ? 'Hızlı' : estimatedMinutes <= 50 ? 'Standart' : 'Uzun';
  const scenarioHelp: Record<NonNullable<Settings['scenarioId']>, string> = {
    classic: 'Tüm seçili seviyeleri dengeli dağıtır.',
    'hidden-gems': 'Puanlar gizlenir; değerli düşük maliyetli adayların payı artar.',
    'stars-and-scrubs': 'Üst ve alt seviyeleri aynı havuzda daha belirgin karıştırır; her lot yıldız değildir.',
    'budget-crunch': 'Daha dar bütçe, erken harcama ve kadro tamamlama riskini artırır.',
    'speed-auction': 'Daha kısa sayaçla hızlı karar ve seri lot geçişi sağlar.',
  };

  if (hydrating)
    return (
      <main className="online-loading" aria-live="polite">
        Oturum kontrol ediliyor…
      </main>
    );
  if (screen === 'entry')
    return (
      <main className="online-shell">
        <nav className="online-nav">
          <button
            className="brand-lockup brand-home"
            onClick={() => router.push('/')}
            aria-label="Mezat 11 ana sayfasına dön"
          >
            <img src="/brand-mark.svg" alt="" />
            <span>
              <b>MEZAT 11</b>
              <small>FUTBOL AÇIK ARTIRMA OYUNU</small>
            </span>
          </button>
          <span className="mode-label">Çok oyunculu</span>
        </nav>
        <section className="online-entry">
          <div>
            <p className="eyebrow">AYNI MASA · HER CİHAZ</p>
            <h1>
              Arkadaşlarınla
              <br />
              <span>canlı açık artırma.</span>
            </h1>
            <p>
              Oda koduyla katıl, canlı teklif ver veya kurucunun yönettiği manuel modda kadronu telefonundan takip et.
            </p>
            <div className="online-points">
              <span>● Tüm havuz ayarları</span>
              <span>● Canlı veya manuel mod</span>
              <span>● Anlık kadro ekranı</span>
            </div>
          </div>
          <div className="panel online-panel">
            <div className="online-tabs" role="tablist" aria-label="Oda işlemi">
              <button
                role="tab"
                aria-selected={tab === 'create'}
                className={tab === 'create' ? 'active' : ''}
                onClick={() => setTab('create')}
              >
                Oda oluştur
              </button>
              <button
                role="tab"
                aria-selected={tab === 'join'}
                className={tab === 'join' ? 'active' : ''}
                onClick={() => setTab('join')}
              >
                Odaya katıl
              </button>
            </div>
            <label className="label" htmlFor="online-name">
              Görünen adınız
            </label>
            <input
              id="online-name"
              className="online-input"
              maxLength={24}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Menajer adı"
            />
            <div className="age-gate">
              <label className="label mt-5" htmlFor="online-birth-year">
                Doğum yılınız
              </label>
              <input
                id="online-birth-year"
                className="online-input"
                inputMode="numeric"
                maxLength={4}
                value={birthYear}
                onChange={(event) => setBirthYear(event.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Örn. 1995"
                aria-describedby="online-age-note"
                required
              />
              <label className="consent-check">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(event) => setConsentAccepted(event.target.checked)}
                />
                <span>
                  <Link href="/gizlilik" target="_blank" rel="noreferrer">
                    Gizlilik ve veri işleme bilgilendirmesini
                  </Link>{' '}
                  okudum; oyunun çalışması için gereken verilerin bu kapsamda işlenmesini kabul ediyorum. Doğum yılım
                  saklanmaz, yalnızca yaş aralığı tutulur.
                </span>
              </label>
              <p id="online-age-note" className={ageProblem ? 'age-note warning' : 'age-note'}>
                {ageProblem ??
                  (declaredBand === 'minor'
                    ? `${MIN_AGE}-${ADULT_AGE - 1} yaş aralığındasınız: oda sohbeti ve başarı tablosu yayını kapalıdır.`
                    : `Bu oyun ${MIN_AGE} yaş ve üzeri içindir.`)}
              </p>
            </div>
            {tab === 'join' ? (
              <>
                <label className="label mt-5" htmlFor="join-code">
                  Oda kodu
                </label>
                <input
                  id="join-code"
                  className="online-input room-code-input"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="ABC234"
                />
                <div className="role-choice" role="radiogroup" aria-label="Katılım rolü">
                  <button
                    role="radio"
                    aria-checked={role === 'manager'}
                    className={role === 'manager' ? 'active' : ''}
                    onClick={() => setRole('manager')}
                  >
                    Menajer
                  </button>
                  <button
                    role="radio"
                    aria-checked={role === 'spectator'}
                    className={role === 'spectator' ? 'active' : ''}
                    onClick={() => setRole('spectator')}
                  >
                    Seyirci
                  </button>
                </div>
                {role === 'manager' && declaredBand === 'adult' && (
                  <LeaderboardOptIn
                    fallbackName={name}
                    settings={settings}
                    onChange={(patch) => setSettings((value) => ({ ...value, ...patch }))}
                  />
                )}
              </>
            ) : (
              <>
                <span id="era-label" className="label mt-5">
                  Futbolcu dönemi
                </span>
                <div className="online-settings" role="radiogroup" aria-labelledby="era-label">
                  <button
                    role="radio"
                    aria-checked={settings.era === 'current'}
                    className={settings.era === 'current' ? 'active' : ''}
                    onClick={() => setSettings((value) => ({ ...value, era: 'current', quality: 'all' }))}
                  >
                    <b>Güncel</b>
                    <span>Bugünün aktif futbolcuları</span>
                  </button>
                  <button
                    role="radio"
                    aria-checked={settings.era === 'legends'}
                    className={settings.era === 'legends' ? 'active' : ''}
                    onClick={() => setSettings((value) => ({ ...value, era: 'legends', quality: 'all' }))}
                  >
                    <b>Son 30 Yıl</b>
                    <span>Prime dönem oyuncuları</span>
                  </button>
                </div>
                <span className="label mt-5">Oyuncu yetenekleri</span>
                <button
                  aria-pressed={settings.revealRatings}
                  className={`ability-choice online-ability ${settings.revealRatings ? 'active' : ''}`}
                  onClick={() => setSettings((value) => ({ ...value, revealRatings: !value.revealRatings }))}
                >
                  <strong>{settings.revealRatings ? 'Göster' : 'Aktif lotta gizle'}</strong>
                  <span>
                    {settings.revealRatings ? 'Puan ve seviye açık' : 'Satın alınan oyuncular kadroda açıklanır'}
                  </span>
                </button>
                <label className="label mt-5">Havuza dahil edilecek seviyeler</label>
                <div className="tier-picker online-tier-picker">
                  {RATING_TIERS.map((tier) => (
                    <button
                      aria-pressed={settings.selectedTiers.includes(tier)}
                      key={tier}
                      onClick={() => toggleTier(tier)}
                      className={settings.selectedTiers.includes(tier) ? 'active' : ''}
                    >
                      <span>{settings.selectedTiers.includes(tier) ? '✓' : '+'}</span>
                      {tier}
                    </button>
                  ))}
                </div>
                <div className="tier-tools">
                  <button
                    onClick={() =>
                      setSettings((value) => ({
                        ...value,
                        selectedTiers: RATING_TIERS,
                      }))
                    }
                  >
                    Tümünü seç
                  </button>
                  <span>{settings.selectedTiers.length}/6 seviye seçili</span>
                </div>
                <label className="label mt-5">Açık artırma kontrolü</label>
                <div className="auction-mode-picker" role="radiogroup" aria-label="Açık artırma kontrolü">
                  <button
                    role="radio"
                    aria-checked={(settings.auctionMode || 'live') === 'live'}
                    className={(settings.auctionMode || 'live') === 'live' ? 'active' : ''}
                    onClick={() =>
                      setSettings((value) => ({
                        ...value,
                        auctionMode: 'live',
                      }))
                    }
                  >
                    <b>Canlı teklif</b>
                    <span>Her menajer kendi cihazından teklif verir.</span>
                  </button>
                  <button
                    role="radio"
                    aria-checked={settings.auctionMode === 'manual'}
                    className={settings.auctionMode === 'manual' ? 'active' : ''}
                    onClick={() =>
                      setSettings((value) => ({
                        ...value,
                        auctionMode: 'manual',
                      }))
                    }
                  >
                    <b>Manuel yönetim</b>
                    <span>Kurucu kazananı ve tutarı sisteme girer.</span>
                  </button>
                </div>
                <label className="label mt-5">Yedek oyuncular</label>
                <div className="reserve-picker" role="radiogroup" aria-label="Yedek oyuncu seçimi">
                  <button
                    role="radio"
                    aria-checked={!settings.includeBench}
                    className={!settings.includeBench ? 'active' : ''}
                    onClick={() =>
                      setSettings((value) => ({
                        ...value,
                        includeBench: false,
                      }))
                    }
                  >
                    <b>Yedek olmasın</b>
                    <span>11 oyuncu + teknik direktör</span>
                  </button>
                  <button
                    role="radio"
                    aria-checked={Boolean(settings.includeBench)}
                    className={settings.includeBench ? 'active' : ''}
                    onClick={() => setSettings((value) => ({ ...value, includeBench: true }))}
                  >
                    <b>4 yedek olsun</b>
                    <span>
                      1 KL · 1 DEF · 1 ORT · 1 FV
                      <br />
                      <strong>+$250M bütçe</strong>
                    </span>
                  </button>
                </div>
                <label className="label mt-5">Gelişmiş kurallar</label>
                <div className="advanced-settings">
                  <label>
                    Senaryo
                    <select
                      value={settings.scenarioId}
                      onChange={(event) =>
                        setSettings((value) => ({ ...value, scenarioId: event.target.value as Settings['scenarioId'] }))
                      }
                    >
                      <option value="classic">Klasik</option>
                      <option value="hidden-gems">Gizli cevherler</option>
                      <option value="stars-and-scrubs">Yıldızlar ve sürprizler</option>
                      <option value="budget-crunch">Dar bütçe</option>
                      <option value="speed-auction">Hızlı açık artırma</option>
                    </select>
                    <small>{scenarioHelp[settings.scenarioId || 'classic']}</small>
                  </label>
                  <label>
                    Süre
                    <select
                      value={settings.timerSeconds}
                      onChange={(event) =>
                        setSettings((value) => ({
                          ...value,
                          timerSeconds: Number(event.target.value) as Settings['timerSeconds'],
                        }))
                      }
                    >
                      {[10, 15, 20, 30].map((value) => (
                        <option key={value} value={value}>
                          {value} saniye
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Teklif artışı
                    <select
                      value={settings.bidIncrement}
                      onChange={(event) =>
                        setSettings((value) => ({
                          ...value,
                          bidIncrement: Number(event.target.value) as Settings['bidIncrement'],
                        }))
                      }
                    >
                      {[5, 10, 25].map((value) => (
                        <option key={value} value={value}>
                          ${value}M
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Diziliş
                    <select
                      value={settings.formation}
                      onChange={(event) =>
                        setSettings((value) => ({ ...value, formation: event.target.value as Formation }))
                      }
                    >
                      {FORMATIONS.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Sezon
                    <select
                      value={settings.seasonLength}
                      onChange={(event) =>
                        setSettings((value) => ({
                          ...value,
                          seasonLength: Number(event.target.value) as Settings['seasonLength'],
                        }))
                      }
                    >
                      {[1, 3, 5].map((value) => (
                        <option key={value} value={value}>
                          {value} oyun
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="check-setting">
                    <input
                      type="checkbox"
                      checked={settings.secondChance}
                      onChange={(event) => setSettings((value) => ({ ...value, secondChance: event.target.checked }))}
                    />{' '}
                    Satılmayanlara ikinci şans
                  </label>
                </div>
                <span className="label mt-5">Tahmini menajer sayısı</span>
                <div className="manager-count-hint" role="radiogroup" aria-label="Tahmini menajer sayısı">
                  {[2, 3, 4, 5, 6, 7, 8].map((value) => (
                    <button
                      role="radio"
                      aria-checked={managerEstimate === value}
                      className={managerEstimate === value ? 'active' : ''}
                      key={value}
                      onClick={() =>
                        setSettings((current) => ({
                          ...current,
                          managerCountHint: value as Settings['managerCountHint'],
                        }))
                      }
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className={`duration-estimate ${pace.toLocaleLowerCase('tr')}`} role="status">
                  <div>
                    <span>TAHMİNİ OYUN SÜRESİ</span>
                    <strong>
                      ~{estimatedMinutes} dakika · {pace}
                    </strong>
                  </div>
                  <p>
                    {pace === 'Hızlı'
                      ? 'Kısa sayaç ve küçük masa için akıcı tempo.'
                      : pace === 'Standart'
                        ? 'Dengeli karar süresi ve masa temposu.'
                        : 'Büyük veya yedekli masalarda uzun oturum; 10 saniyelik Hızlı Açık Artırma önerilir.'}
                  </p>
                </div>
                <label className="label mt-5">Oyuncu havuzu</label>
                <div className="pool-mode">
                  <button
                    className={settings.poolMode !== 'custom' ? 'active' : ''}
                    onClick={() =>
                      setSettings((value) => ({
                        ...value,
                        poolMode: 'generated',
                        customPlayerIds: [],
                        customPoolSelections: [],
                      }))
                    }
                  >
                    Otomatik havuz
                  </button>
                  <button
                    className={settings.poolMode === 'custom' ? 'active' : ''}
                    onClick={() => setSettings((value) => ({ ...value, poolMode: 'custom' }))}
                  >
                    Özel Havuz Oluştur
                  </button>
                </div>
                {settings.poolMode === 'custom' && (
                  <div className="custom-pool">
                    <label className="label" htmlFor="custom-pool-search">
                      Lig veya takım ara
                    </label>
                    <input
                      id="custom-pool-search"
                      className="online-input"
                      aria-describedby="custom-pool-help custom-pool-status"
                      value={poolQuery}
                      onChange={(event) => setPoolQuery(event.target.value)}
                      placeholder="Örn. Fenerbahçe veya Türkiye Ligi"
                    />
                    <small id="custom-pool-help">
                      Birden fazla takım ve lig seçebilirsin. Seçtiğin havuzda eksik kalan pozisyonları sistem tamamlar.
                    </small>
                    <span id="custom-pool-status" className="sr-only" aria-live="polite">
                      {poolQuery.trim().length > 1 ? `${poolOptions.length} sonuç bulundu` : ''}
                    </span>
                    {Boolean(settings.customPoolSelections?.length) && (
                      <div className="custom-pool-tags">
                        {settings.customPoolSelections!.map((item) => (
                          <button
                            key={`${item.type}:${item.name}`}
                            onClick={() =>
                              setSettings((value) => ({
                                ...value,
                                customPoolSelections: value.customPoolSelections?.filter(
                                  (selected) => selected.type !== item.type || selected.name !== item.name,
                                ),
                              }))
                            }
                          >
                            <span>{item.type === 'club' ? 'TAKIM' : 'LİG'}</span>
                            {item.name} ×
                          </button>
                        ))}
                      </div>
                    )}
                    {poolQuery.trim().length > 1 && (
                      <div className="custom-pool-results">
                        {poolOptions.length ? (
                          poolOptions.map((option) => {
                            const selected = settings.customPoolSelections?.some(
                              (item) => item.type === option.type && item.name === option.name,
                            );
                            return (
                              <button
                                className={selected ? 'active' : ''}
                                key={`${option.type}:${option.name}`}
                                onClick={() =>
                                  setSettings((value) => ({
                                    ...value,
                                    customPoolSelections: selected
                                      ? value.customPoolSelections?.filter(
                                          (item) => item.type !== option.type || item.name !== option.name,
                                        )
                                      : [...(value.customPoolSelections || []), option],
                                  }))
                                }
                              >
                                <span className="pool-result-type">{option.type === 'club' ? 'TAKIM' : 'LİG'}</span>
                                <b>
                                  {selected ? '✓ ' : '+ '}
                                  {option.name}
                                </b>
                                <span>
                                  {option.type === 'club'
                                    ? option.league || 'Lig bilgisi bulunamadı'
                                    : 'Ligdeki tüm uygun takımlar'}
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <p className="pool-empty">Eşleşen takım veya lig bulunamadı.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {declaredBand === 'adult' && (
                  <LeaderboardOptIn
                    fallbackName={name}
                    settings={settings}
                    onChange={(patch) => setSettings((value) => ({ ...value, ...patch }))}
                  />
                )}
                <p className="media-rights-note">
                  Oyuncu fotoğrafları yalnız görsel zenginleştirmedir. Kaynak görüntü yüklenmez veya devre dışı
                  bırakılırsa oyun harfli kartlarla eksiksiz devam eder.
                </p>
              </>
            )}
            {error && (
              <p className="online-error" role="alert">
                {error}
              </p>
            )}
            <button className="start mt-6 w-full" disabled={!canEnter || busy} onClick={enter}>
              {busy ? 'Bağlanıyor…' : tab === 'create' ? 'Odayı oluştur' : 'Odaya katıl'} <span>→</span>
            </button>
            {tab === 'join' && (
              <p className="session-note">
                Bu cihazdaki menajer oturumun korunur; sayfayı kapatsan da aynı odaya kaldığın yerden dönersin.
              </p>
            )}
          </div>
        </section>
      </main>
    );

  if (!room || !session)
    return (
      <main className="online-loading" aria-live="polite">
        <b>{loadIssue ? 'Odaya bağlanılamadı' : 'Odaya bağlanılıyor…'}</b>
        {loadIssue && session ? (
          <>
            <span>Oturumunuz cihazda korunuyor.</span>
            <button onClick={() => void loadRoom(session)}>Tekrar dene</button>
            <button onClick={() => router.push('/?fresh=1')}>Ana ekrana dön</button>
          </>
        ) : null}
      </main>
    );

  const me = room.members.find((member) => member.id === memberId);
  const approved = isHost || Boolean(me?.approved);
  const managers = room.members.filter((member) => member.role === 'manager' && member.approved);
  const remaining =
    game?.paused && typeof game.pausedRemainingMs === 'number'
      ? Math.max(0, Math.ceil(game.pausedRemainingMs / 1000))
      : remainingSeconds(game?.deadline, now, 0);
  const auctionOpen = game?.activeTurn !== null;
  const canParticipate = Boolean(
    game &&
    current &&
    myManager &&
    approved &&
    me?.role === 'manager' &&
    myManagerIndex >= 0 &&
    !game.paused &&
    auctionOpen &&
    !game.passed.includes(myManagerIndex) &&
    game.leader !== myManagerIndex &&
    !lotFilled(myManager, current),
  );
  const selected = selectedManager === null ? null : game?.managers[selectedManager] || null;
  /** Presentation of the auction table (items 1-6). No behaviour is derived here beyond what is already rendered. */
  const timerSeconds = room.settings.timerSeconds || 20;
  const defaultIncrement: 5 | 10 | 25 =
    room.settings.bidIncrement === 10 ? 10 : room.settings.bidIncrement === 25 ? 25 : 5;
  const isSpectator = me?.role === 'spectator';
  const liveBidding = mode === 'live' && !isSpectator;
  /** `has-mobile-bar` keeps its historical meaning (the fixed "Kadrom" tabs need bottom room). */
  const mobileBar = Boolean(game && myManager && room.status === 'auction');
  /** The bottom bid bar only replaces those tabs on the auction table itself. */
  const mobileDock = Boolean(mobileBar && liveBidding && view === 'auction');
  /** `rating` is deleted from the public state while ratings are hidden, so read it defensively. */
  const ratingValue = current && typeof current.rating === 'number' ? current.rating : null;
  const revealRating = Boolean(room.settings.revealRatings) && ratingValue !== null;
  const soldTo = game && current ? lotOwnerName(game, current.id) : undefined;
  /**
   * The lot card can only ever show a *terminal* bid state (`activeTurn === null` with a
   * locked leader): the server advances to the next lot inside the same `sell`/timeout
   * action, so a post-sale state is never rendered for the current lot. Sales that did
   * happen are listed by `LotLedger` below the lot.
   */
  const lotWon = Boolean(game && current && !auctionOpen && game.leader !== null && !game.paused);
  const lotStamp = soldTo ? 'sold' : lotWon ? 'won' : null;
  const hostControls =
    isHost && mode === 'live' && game && current ? (
      <div className="host-controls permanent-host-controls">
        <span>KURUCU KONTROLLERİ · HER GÖRÜNÜMDE ERİŞİLEBİLİR</span>
        <button
          className="danger-action"
          disabled={busy || game.leader !== null}
          onClick={() => {
            if (confirm(`${current.name} satılmadan geçilsin mi?`)) void action('skip');
          }}
        >
          Oyuncuyu pas geç
        </button>
        <button disabled={busy || !auctionOpen || game.leader === null} onClick={() => action('close')}>
          Teklifi sonlandır
        </button>
        <button
          className="host-primary"
          disabled={busy || auctionOpen || game.leader === null}
          onClick={() => action('sell')}
        >
          Satışı tamamla
        </button>
        <button disabled={busy || auctionOpen || game.leader === null} onClick={() => action('reopen')}>
          Yeniden aç
        </button>
        <button disabled={busy} onClick={() => action('pause')}>
          {game.paused ? `Devam ettir · ${remaining}s kaldı` : 'Duraklat'}
        </button>
        <button className="undo-action" disabled={busy || !game.publicMeta?.canUndo} onClick={() => action('undo')}>
          ↶ Geri al
        </button>
      </div>
    ) : null;

  return (
    <main
      className={`online-room ${mobileBar ? 'has-mobile-bar' : ''} ${mobileDock ? 'mz-mobile-dock' : ''} ${presentation ? 'presentation-mode' : ''}`}
    >
      <header className="room-header mz-header">
        <div className="mz-header__brand">
          <button
            className="brand-lockup brand-home room-brand"
            onClick={brandHome}
            aria-label="Mezat 11 ana sayfasına dön"
          >
            <img src="/brand-mark.svg" alt="" />
            <span>
              <b>MEZAT 11</b>
              <small>FUTBOL AÇIK ARTIRMA OYUNU</small>
            </span>
          </button>
          <span className="mz-header__status">
            <span className={`connection ${online ? 'ok' : ''}`}>{online ? '● Bağlı' : '● Yeniden bağlanıyor'}</span>
            {game && room.status === 'auction' && (
              <span className="mz-header__live">
                ● CANLI · {managers.length} MENAJER · LOT {game.index + 1}/{game.pool.length}
              </span>
            )}
          </span>
        </div>
        {myManager && (
          <div className="manager-identity mz-header__identity">
            <small>MENAJER · KALAN BÜTÇE</small>
            <b>{myManager.name}</b>
            <strong>{money(myManager.budget)}</strong>
          </div>
        )}
        <div className="room-share mz-header__code">
          <button className="room-code" onClick={copyRoomCode} title="Oda kodunu kopyala">
            <small>ODA KODU · KOPYALA</small>
            <b>{room.code}</b>
          </button>
          {room.status === 'lobby' && (
            <button className="invite-link" onClick={invite}>
              ↗ Link ile davet et
            </button>
          )}
        </div>
        <div className="mz-header__tools">
          {game && room.status === 'auction' && (
            <button className="tool-btn tv-mode" onClick={togglePresentation}>
              {presentation ? 'TV modundan çık' : '▣ TV modu'}
            </button>
          )}
          <button className="tool-btn leave-room" onClick={() => confirmLeave(false)}>
            {room.status === 'lobby' ? 'Odadan çık' : 'Ana sayfaya dön'}
          </button>
        </div>
      </header>
      {presentation && (
        <button className="presentation-exit" onClick={togglePresentation}>
          TV modundan çık
        </button>
      )}
      {game && myManager && room.status === 'auction' && (
        <nav className="manager-view-tabs" aria-label="Menajer ekranı">
          <button
            aria-pressed={view === 'auction'}
            className={view === 'auction' ? 'active' : ''}
            onClick={() => setView('auction')}
          >
            <b>↗</b>Açık artırma gidişatı
          </button>
          <button
            aria-pressed={view === 'squad'}
            className={view === 'squad' ? 'active' : ''}
            onClick={() => setView('squad')}
          >
            <b>▦</b>Kadrom{' '}
            <span>
              {Object.keys(myManager.squad).length}/11
              {myManager.bench ? ` + ${Object.keys(myManager.bench).length}/4` : ''}
            </span>
          </button>
        </nav>
      )}
      <div className="sr-only" aria-live="polite">
        {copied ? 'Oda bağlantısı kopyalandı.' : ''}
      </div>
      {copied && <p className="online-toast success">Bağlantı kopyalandı</p>}
      {error && (
        <p className="online-toast" role="alert">
          {error}
        </p>
      )}

      {room.status === 'lobby' ? (
        <section className="lobby">
          <div>
            <p className="eyebrow">BEKLEME ODASI</p>
            <h1>{isHost ? 'Arkadaşlarını bekle' : 'Oda sahibinin onayını bekle'}</h1>
            <p>Oda kodunu paylaşın. Oyun, en az iki onaylı menajer olduğunda başlayabilir.</p>
            <div className="member-list">
              {room.members.map((member) => (
                <article key={member.id}>
                  <span className="avatar">{member.name[0]?.toUpperCase()}</span>
                  <div>
                    <b>
                      {member.name}
                      {member.id === memberId ? ' · Siz' : ''}
                    </b>
                    <small>
                      {member.isBot
                        ? `AI menajer · ${member.botStyle === 'value' ? 'Acemi' : member.botStyle === 'aggressive' ? 'Uzman' : 'Ortalama'}`
                        : member.role === 'manager'
                          ? 'Menajer'
                          : 'Seyirci'}{' '}
                      · {member.approved ? 'Onaylandı' : 'Onay bekliyor'}
                    </small>
                  </div>
                  {isHost && member.isBot ? (
                    <button
                      className="danger-action"
                      disabled={busy}
                      onClick={() => action('removeBot', { memberId: member.id })}
                    >
                      Kaldır
                    </button>
                  ) : isHost && !member.approved ? (
                    <button disabled={busy} onClick={() => action('approve', { memberId: member.id })}>
                      Onayla
                    </button>
                  ) : (
                    <em>{member.approved ? '✓' : '…'}</em>
                  )}
                </article>
              ))}
            </div>
            {isHost ? (
              <div className="lobby-actions">
                <div className="ai-level-picker">
                  <span>AI RAKİP EKLE</span>
                  <button disabled={busy || managers.length >= 8} onClick={() => action('addBot', { style: 'value' })}>
                    <b>Acemi</b>
                    <small>Daha erken çekilir</small>
                  </button>
                  <button
                    disabled={busy || managers.length >= 8}
                    onClick={() => action('addBot', { style: 'balanced' })}
                  >
                    <b>Ortalama</b>
                    <small>Dengeli teklif verir</small>
                  </button>
                  <button
                    disabled={busy || managers.length >= 8}
                    onClick={() => action('addBot', { style: 'aggressive' })}
                  >
                    <b>Uzman</b>
                    <small>Değerli lotları zorlar</small>
                  </button>
                </div>
                <button
                  className="start"
                  disabled={busy || managers.length < 2}
                  onClick={() => void startAuction('start')}
                >
                  Oyunu başlat <span>→</span>
                </button>
              </div>
            ) : (
              !approved && <div className="waiting">Oda sahibinin onayı bekleniyor…</div>
            )}
          </div>
          <aside className="panel room-rules">
            <p className="eyebrow">ODA KURALLARI</p>
            <h3>{room.settings.era === 'current' ? 'Güncel' : 'Son 30 yıl'}</h3>
            <p>{mode === 'manual' ? 'Manuel kurucu yönetimi' : 'Herkes kendi cihazından teklif verir'}</p>
            <p>Seviyeler: {room.settings.selectedTiers?.join(' · ') || 'Tüm seviyeler'}</p>
            <p>{room.settings.revealRatings ? 'Puanlar görünür' : 'Aktif lot puanı gizli; satın alınınca açıklanır'}</p>
            <p>{room.settings.includeBench ? '11 oyuncu + 4 yedek · kişi başı +$250M' : '11 oyuncu · yedeksiz'}</p>
            <p>
              {managers.length} onaylı menajer · {room.members.filter((member) => member.role === 'spectator').length}{' '}
              seyirci
            </p>
            <p>Oda ve sonuçlar 7 gün saklanır.</p>
          </aside>
        </section>
      ) : room.status === 'results' && game ? (
        <OnlineResults
          managers={game.managers}
          audit={game.audit || []}
          season={room.season}
          onRematch={
            isHost && (!room.season || room.season.round < room.season.length)
              ? () => startAuction('rematch')
              : undefined
          }
        />
      ) : view === 'squad' && myManager ? (
        <div className="my-squad-screen">
          <div className="formation-picker" aria-label="Takım dizilişi">
            {FORMATIONS.map((formation) => (
              <button
                className={(myManager.formation || '4-2-3-1') === formation ? 'active' : ''}
                key={formation}
                onClick={() => action('formation', { formation })}
              >
                {formation}
              </button>
            ))}
          </div>
          <SquadPanel manager={myManager} />
        </div>
      ) : game && current ? (
        <section className="online-auction mz-auction">
          <aside className="mz-manager-rail" aria-label="Menajerler">
            <p className="eyebrow">MENAJERLER · KADRO İÇİN TIKLA</p>
            {game.managers.map((manager, index) => {
              const filled = lotFilled(manager, current),
                passed = game.passed.includes(index),
                leader = game.leader === index,
                nextOffer = game.leader === null ? auctionOpeningPrice(current, game.managers) : game.bid + 1,
                eligible =
                  !filled && !passed && !leader && canPlaceLotBid(manager, current, nextOffer, index, game.passed),
                stateClass = filled
                  ? 'filled'
                  : passed
                    ? 'passed'
                    : leader
                      ? 'leader'
                      : eligible
                        ? 'eligible'
                        : 'ineligible',
                status = filled
                  ? '✓ POZİSYON DOLU'
                  : passed
                    ? '× PAS GEÇTİ'
                    : leader
                      ? '★ LİDER'
                      : eligible
                        ? '● TEKLİF VEREBİLİR'
                        : '— UYGUN DEĞİL';
              return (
                <button
                  className={`online-manager-card ${stateClass}`}
                  key={manager.id}
                  onClick={() => setSelectedManager(index)}
                  aria-label={`${manager.name}: ${status}`}
                >
                  <span className="avatar">{manager.name[0]}</span>
                  <span>
                    <b>{manager.name}</b>
                    <small>
                      {Object.keys(manager.squad).length}/11{' '}
                      {manager.bench ? `· ${Object.keys(manager.bench).length}/4 yedek ` : ''}·{' '}
                      {manager.coach ? 'TD ✓ · ' : ''}
                      {money(manager.budget)}
                    </small>
                    <small className="manager-lot-status">{status}</small>
                  </span>
                  <em>{filled ? '✓' : passed ? '×' : leader ? '★' : eligible ? '●' : '—'}</em>
                </button>
              );
            })}
          </aside>
          <div className="mz-lot-stage">
            <div className="online-lot-head mz-lot-head">
              <span className="mz-lot-head__count">
                {isCoach(current) ? 'TEKNİK DİREKTÖR AÇIK ARTIRMASI' : `LOT ${game.index + 1}/${game.pool.length}`}
              </span>
              <span className="mz-lot-head__position">
                {current.slot} · {current.role}
              </span>
              <b className="mz-lot-head__state">
                {mode === 'manual'
                  ? 'MANUEL YÖNETİM'
                  : game.paused
                    ? 'DURAKLATILDI'
                    : auctionOpen
                      ? 'SERBEST TEKLİF'
                      : game.leader === null
                        ? 'SONRAKİ LOT'
                        : 'TEKLİFLER KAPANDI'}
              </b>
              <em className={`mz-lot-chip ${game.deadline && remaining > 0 && remaining <= 5 ? 'is-critical' : ''}`}>
                <i />
                {game.deadline || (game.paused && remaining > 0) ? `${remaining}s` : '—'}
              </em>
            </div>
            {game.bonusReveal && (
              <div className="missed-bonus-card">
                {game.bonusReveal.image ? <img src={game.bonusReveal.image} alt="" /> : <span>?</span>}
                <div>
                  <b>KAÇAN BONUS</b>
                  <p>
                    Eğer bonus açılsaydı <strong>{game.bonusReveal.name}</strong> oyuncusu gelecekti.
                  </p>
                  <small>
                    {game.bonusReveal.role} · Puanı: <strong>{game.bonusReveal.rating.toFixed(1)}</strong>
                  </small>
                </div>
              </div>
            )}
            {game.autoAssignments?.map((item) => (
              <div className="auto-assignment-card" key={`${item.managerName}-${item.player.id}`}>
                <span>✓</span>
                <div>
                  <b>EKSİK POZİSYON TAMAMLANDI</b>
                  <p>
                    <strong>{item.managerName}</strong> kadrosuna <strong>{item.player.name}</strong> otomatik atandı.
                  </p>
                  <small>
                    {ratingLevel(item.player.rating)} · {item.player.rating.toFixed(1)} puan · {money(item.fee)}{' '}
                    bütçeden düşüldü
                  </small>
                </div>
              </div>
            ))}
            <p className="online-lot-progress">
              {current.role} pozisyonu için {game.publicMeta?.groupOrdinal || 1}. oyuncu: {current.name}
            </p>
            {bonusLot && (
              <div className="bonus-lot-alert">
                <b>⚠ BONUS OYUNCU</b>
                <span>Bu pozisyonun son açık artırması. Ardından {nextGroupLabel} başlayacak.</span>
              </div>
            )}
            <article
              className={`online-player mz-lot-card ${isCoach(current) ? 'coach-lot' : ''} ${bonusLot ? 'bonus-lot-card' : ''}`}
            >
              {lotStamp && (
                <span
                  className={`mz-lot-stamp mz-lot-stamp--${lotStamp}`}
                  role="status"
                  aria-label={
                    lotStamp === 'sold'
                      ? `Satıldı: ${soldTo}`
                      : 'Satıldı: en yüksek teklif kilitlendi, kurucu onayı bekleniyor'
                  }
                >
                  SATILDI
                </span>
              )}
              {!isCoach(current) && (
                <div
                  className="auction-mini-formation"
                  aria-label={`${current.role} mevki konumu, kaleci solda yatay saha görünümü`}
                >
                  <i className="mini-halfway" />
                  <i className="mini-goal mini-goal-left" />
                  <i className="mini-goal mini-goal-right" />
                  {SLOT_KEYS.map((slot) => (
                    <span
                      key={slot}
                      data-slot={slot}
                      className={slot === current.slot ? 'active' : ''}
                      style={auctionFormationPoint(myManager?.formation || room.settings.formation || '4-2-3-1', slot)}
                    >
                      {slot === current.slot ? slot : ''}
                    </span>
                  ))}
                </div>
              )}
              <div className="online-player-visual">
                <span>{current.name[0]}</span>
                <PlayerImage player={current} className="online-player-photo" />
              </div>
              <div className="online-player-copy">
                <span>{current.role}</span>
                <h1>{current.name}</h1>
                {isCoach(current) ? (
                  <p>
                    {current.preferredFormation} · Taktik {current.tactics} · Motivasyon {current.motivation} · Uyum{' '}
                    {current.adaptability}
                  </p>
                ) : (
                  <p>
                    {current.club || 'Kulüp bilgisi yok'}
                    {current.league ? ` · ${current.league}` : ''}
                  </p>
                )}
                <div className="mz-lot-plates" aria-label="Lot bilgileri">
                  <div className={`mz-lot-plate ${revealRating ? '' : 'is-hidden'}`}>
                    <small>PUAN</small>
                    {revealRating && ratingValue !== null ? (
                      <strong>
                        {ratingValue.toFixed(1)}
                        <em>/100</em>
                      </strong>
                    ) : (
                      <>
                        <strong className="mz-lot-plate__value" aria-hidden="true">
                          00.0
                        </strong>
                        <span className="mz-lot-plate__lock" aria-hidden="true">
                          🔒 GİZLİ
                        </span>
                        <span className="sr-only">Puan gizli; oyuncu satıldığında açıklanır.</span>
                      </>
                    )}
                  </div>
                  <div className="mz-lot-plate">
                    <small>AÇILIŞ</small>
                    <strong>{money(auctionOpeningPrice(current, game.managers))}</strong>
                  </div>
                  <div className="mz-lot-plate">
                    <small>SEVİYE</small>
                    <strong>{revealRating && ratingValue !== null ? ratingLevel(ratingValue) : 'Gizli'}</strong>
                  </div>
                </div>
              </div>
            </article>
            <LotLedger game={game} />
            <AuctionActionBar
              game={game}
              current={current}
              myManager={myManager}
              mode={mode}
              isHost={isHost}
              isSpectator={isSpectator}
              canParticipate={canParticipate}
              busy={busy}
              remaining={remaining}
              timerSeconds={timerSeconds}
              defaultIncrement={defaultIncrement}
              customBid={customBid}
              onCustomBidChange={setCustomBid}
              onAction={action}
            />
            {hostControls && <div className="mz-host-row">{hostControls}</div>}
          </div>
          <aside className="mz-squad-rail" aria-label="Kadrom ve canlı akış">
            {myManager ? <SquadRail manager={myManager} /> : null}
            <div className="mz-feed" aria-live="polite" aria-label="Canlı açık artırma akışı">
              <p className="eyebrow">CANLI AKIŞ</p>
              {game.feed.map((item, index) => (
                <p className="online-feed" key={`${item}-${index}`}>
                  {item}
                </p>
              ))}
            </div>
            {!myManager && (
              <p className="mz-bid-note">Seyirci olarak izliyorsunuz; kadro paneli menajerler için görünür.</p>
            )}
          </aside>
        </section>
      ) : null}
      {room.status === 'auction' && view === 'squad' && hostControls && (
        <section className="host-control-dock" aria-label="Kalıcı kurucu kontrolleri">
          {hostControls}
        </section>
      )}
      {isHost && room.status === 'auction' && game && (
        <section className="host-game-operations" aria-label="Oda sahibi oyun işlemleri">
          <div>
            <p className="eyebrow">OYUN İŞLEMLERİ</p>
            <h2>Açık artırmayı yönet</h2>
            <p>Bu işlemler tüm odayı etkiler ve yalnızca kurucu tarafından kullanılabilir.</p>
          </div>
          <button
            className="auto-finish"
            disabled={busy}
            onClick={() => {
              if (
                confirm(
                  'Kalan tüm açık artırmalar otomatik tamamlansın ve sonuç hemen açıklansın mı? Bu işlem geri alınamaz.',
                )
              )
                void action('autoComplete');
            }}
          >
            <b>Otomatik tamamla</b>
            <span>Kalan lotları simüle et ve sonucu açıkla</span>
          </button>
          <button
            className="restart-auction"
            disabled={busy}
            onClick={() => {
              if (
                confirm(
                  'Açık artırma en baştan yeniden başlatılsın mı? Tüm mevcut kadrolar, teklifler ve bütçeler sıfırlanacak.',
                )
              )
                void startAuction('restart');
            }}
          >
            <b>Yeniden başlat</b>
            <span>Aynı odayı ve menajerleri koruyarak sıfırla</span>
          </button>
        </section>
      )}
      {selected && <ManagerDrawer manager={selected} onClose={() => setSelectedManager(null)} footer={hostControls} />}
      {viewerBand === 'adult' && (
        <button
          ref={chatTriggerRef}
          className={`chat-fab ${chatUnread > 0 ? 'has-unread' : ''}`}
          onClick={() => {
            setChatOpen((value) => !value);
            setChatUnread(0);
          }}
          aria-expanded={chatOpen}
          aria-controls="room-chat"
          aria-label={
            chatOpen
              ? 'Oda sohbetini kapat'
              : chatUnread
                ? `Oda sohbetini aç, ${chatUnread} yeni mesaj`
                : 'Oda sohbetini aç'
          }
        >
          💬 <span>Sohbet</span>
          {chatUnread > 0 ? <b>{chatUnread}</b> : null}
        </button>
      )}
      {chatOpen && (
        <>
          <button className="room-chat-backdrop" aria-label="Sohbeti kapat" onClick={() => setChatOpen(false)} />
          <aside
            ref={chatDialogRef}
            id="room-chat"
            className="room-chat"
            role="dialog"
            aria-modal="true"
            aria-labelledby="room-chat-title"
          >
            <header>
              <b id="room-chat-title">Oda sohbeti</b>
              <button onClick={() => setChatOpen(false)} aria-label="Oda sohbetini kapat">
                ×
              </button>
            </header>
            <div ref={chatMessagesRef}>
              {room.chat?.length ? (
                room.chat.map((message) => (
                  <p key={message.id}>
                    <b>{message.name}</b>
                    <span>{message.text}</span>
                    <time dateTime={new Date(message.at).toISOString()}>
                      {new Date(message.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </p>
                ))
              ) : (
                <small>Henüz mesaj yok. İlk mesajı siz yazın.</small>
              )}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendChat();
              }}
            >
              <input
                ref={chatInputRef}
                maxLength={200}
                value={chatText}
                onChange={(event) => setChatText(event.target.value)}
                placeholder="Mesaj yaz…"
                aria-label="Sohbet mesajı"
              />
              <button disabled={chatBusy || !chatText.trim()}>{chatBusy ? 'Gönderiliyor…' : 'Gönder'}</button>
            </form>
          </aside>
        </>
      )}
    </main>
  );
}

export default function OnlineRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    params.set('mode', 'online');
    location.replace(`/?${params.toString()}`);
  }, []);
  return <main className="online-loading">Mezat 11 deneyimine yönlendiriliyor…</main>;
}
