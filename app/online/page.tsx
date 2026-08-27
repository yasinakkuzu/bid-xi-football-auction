'use client';
/* Remote player photos use their source URLs and retain a visible fallback. */
/* eslint-disable @next/next/no-img-element */

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {auctionOpeningPrice, auctionPassIsSafe, auctionProgressLabel, BENCH_SLOTS, FORMATIONS, FORMATION_POSITIONS, isBonusPlayerLot, isCoach, lotFilled, rankManagers, ratingLevel, RATING_TIERS, resultInsights, simulateTournament, SLOT_KEYS, type AuctionLot, type Formation, type Manager, type PoolSourceEntry, type RatingTier, type Slot} from '../../lib/game-engine';
import {customPoolOptions,type CustomPoolSelection} from '../../lib/club-leagues';

type Member = {
  id: string;
  name: string;
  role: 'manager' | 'spectator';
  approved: boolean;
  isBot?: boolean;
  botStyle?: 'balanced'|'aggressive'|'value';
};
type AuctionMode = 'live' | 'manual';
type Settings = {
  era: 'current' | 'legends';
  quality: 'best' | 'all';
  revealRatings: boolean;
  selectedTiers: RatingTier[];
  auctionMode?: AuctionMode;
  includeBench?: boolean;
  timerSeconds?: 10|15|20|30;
  bidIncrement?: 5|10|25;
  secondChance?: boolean;
  seasonLength?: 1|3|5;
  scenarioId?: 'classic'|'hidden-gems'|'stars-and-scrubs'|'budget-crunch'|'speed-auction';
  formation?: Formation;
  poolMode?: 'generated'|'custom';
  customPlayerIds?: string[];
  customPoolSelections?:CustomPoolSelection[];
};
type Game = {
  managers: Manager[];
  pool: AuctionLot[];
  index: number;
  bid: number;
  leader: number | null;
  passed: number[];
  activeTurn: number | null;
  paused: boolean;
  deadline: number | null;
  feed: string[];
  audit?: string[];
  undo?: string;
  bonusReveal?:{name:string;rating:number;role:string;image?:string};
};
type Room = {
  code: string;
  status: 'lobby' | 'auction' | 'results';
  settings: Settings;
  members: Member[];
  game?: Game;
  chat?:Array<{id:string;memberId:string;name:string;text:string;at:number}>;
  season?:{round:number;length:number;standings:Record<string,{name:string;points:number;wins:number;totalScore:number}>};
};
type Session = {code: string; token: string; memberToken?: string};

const money = (n: number) => `$${n}M`;
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
  poolMode:'generated',
  customPlayerIds:[],
  customPoolSelections:[],
};
const coordinates:Record<Slot,{left:string;top:string}>={GK:{left:'50%',top:'91%'},RB:{left:'82%',top:'72%'},CB1:{left:'61%',top:'77%'},CB2:{left:'39%',top:'77%'},LB:{left:'18%',top:'72%'},DM:{left:'36%',top:'57%'},CM:{left:'64%',top:'57%'},AM:{left:'50%',top:'32%'},RW:{left:'82%',top:'32%'},LW:{left:'18%',top:'32%'},ST:{left:'50%',top:'13%'}};
async function json(url: string, options?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error('Bağlantı kurulamadı. Lütfen tekrar deneyin.');
  }
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {}
  if (!response.ok) throw new Error(String(data.error || 'İşlem başarısız'));
  return data;
}

function PlayerImage({player, className}: {player: {name: string; image?: string}; className: string}) {
  if (!player.image) return <span className={`${className} player-image-placeholder`}>{player.name[0]}</span>;
  return (
    <img
      className={className}
      src={player.image}
      alt={`${player.name} fotoğrafı`}
      width="240"
      height="300"
      loading={className.includes('online-player-photo') ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={(event) => {
        event.currentTarget.style.display = 'none';
      }}
    />
  );
}

function SquadPanel({manager, compact = false}: {manager: Manager; compact?: boolean}) {
  return (
    <section className={`online-squad-panel ${compact ? 'compact' : ''}`}>
      <div className="online-squad-summary">
        <div>
          <p className="eyebrow">{manager.formation||'4-2-3-1'} KADRO</p>
          <h2>{manager.name}</h2>
        </div>
        <div>
          <small>KALAN BÜTÇE</small>
          <strong>{money(manager.budget)}</strong>
          <span>
            {Object.keys(manager.squad).length}/11 oyuncu {manager.bench ? `· ${Object.keys(manager.bench).length}/4 yedek` : ''}
          </span>
        </div>
      </div>
      <div className="online-squad-formation" aria-label={`${manager.name} kadro dizilimi`}>
        <span className="online-halfway" />
        <span className="online-center-circle" />
        {SLOT_KEYS.map((slot) => {
          const player = manager.squad[slot];
          return (
            <div className={`online-formation-player ${player ? 'filled' : ''}`} style={(manager.formation&&manager.formation!=='4-2-3-1'?FORMATION_POSITIONS[manager.formation]:coordinates)[slot]} key={slot}>
              {player ? (
                <>
                  <PlayerImage player={player} className="squad-player-photo" />
                  <b>{player.name}</b>
                  <small>{slot}</small>
                </>
              ) : (
                <>
                  <span>{slot}</span>
                  <b>Boş</b>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="online-squad-list">
        {SLOT_KEYS.map((slot) => {
          const player = manager.squad[slot];
          return (
            <article key={slot}>
              <span>{slot}</span>
              {player ? (
                <>
                  <PlayerImage player={player} className="squad-list-photo" />
                  <div>
                    <b>{player.name}</b>
                    <small>{player.club || player.role}</small>
                  </div>
                  <em>{player.rating}</em>
                </>
              ) : (
                <div>
                  <b>Henüz boş</b>
                  <small>{slot}</small>
                </div>
              )}
            </article>
          );
        })}
        {manager.bench &&
          BENCH_SLOTS.map((group) => {
            const player = manager.bench?.[group.key];
            return (
              <article className="bench-row" key={group.key}>
                <span>{group.short}</span>
                {player ? (
                  <>
                    <PlayerImage player={player} className="squad-list-photo" />
                    <div>
                      <b>{player.name}</b>
                      <small>
                        {group.label} · {player.club || player.role}
                      </small>
                    </div>
                    <em>{player.rating}</em>
                  </>
                ) : (
                  <div>
                    <b>Henüz boş</b>
                    <small>{group.label}</small>
                  </div>
                )}
              </article>
            );
          })}
        {manager.coach ? (
          <article className="coach-row">
            <span>TD</span>
            <div>
              <b>{manager.coach.name}</b>
              <small>
                {manager.coach.preferredFormation} · Taktik {manager.coach.tactics} · Motivasyon {manager.coach.motivation}
              </small>
            </div>
            <em>{manager.coach.rating}</em>
          </article>
        ) : (
          <article className="coach-row">
            <span>TD</span>
            <div>
              <b>Teknik direktör bekleniyor</b>
              <small>Oyuncu kadroları tamamlandıktan sonra</small>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

function ManagerDrawer({manager, onClose}: {manager: Manager; onClose: () => void}) {
  const closeRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;closeRef.current?.focus();document.body.style.overflow='hidden';const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()};document.addEventListener('keydown',key);return()=>{document.body.style.overflow='';document.removeEventListener('keydown',key);previous?.focus()}},[onClose]);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-labelledby="online-manager-title" className="squad-drawer online-manager-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <p className="eyebrow">MENAJER DETAYI</p><h2 id="online-manager-title">{manager.name}</h2>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Kadroyu kapat">
            ×
          </button>
        </div>
        <SquadPanel manager={manager} compact />
      </aside>
    </div>
  );
}

function ManualControls({game, current, busy, onAction}: {game: Game; current: AuctionLot; busy: boolean; onAction: (type: string, payload?: Record<string, unknown>) => Promise<void>}) {
  const eligible = (manager: Manager) => !lotFilled(manager, current);
  const first = game.managers.findIndex(eligible);
  const triggersFallback = !isCoach(current) && !auctionPassIsSafe(game.pool, game.index, game.managers);
  const [managerIndex, setManagerIndex] = useState(first >= 0 ? String(first) : '');
  const [amount, setAmount] = useState(String(current.price));
  return (
    <div className="manual-controls">
      <select value={managerIndex} onChange={(event) => setManagerIndex(event.target.value)} aria-label={`${isCoach(current) ? 'Teknik direktörü' : 'Oyuncuyu'} alacak menajer`}>
        {game.managers.map((manager, index) => (
          <option value={index} disabled={!eligible(manager)} key={manager.id}>
            {manager.name} · {money(manager.budget)}
          </option>
        ))}
      </select>
      <div>
        <input type="number" min="5" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} aria-label="Satış tutarı" />
        <span>M</span>
      </div>
      <button
        className="manual-award"
        disabled={busy || managerIndex === ''}
        onClick={() =>
          onAction('manualSell', {
            managerIndex: Number(managerIndex),
            amount: Number(amount),
          })
        }
      >
        {isCoach(current) ? 'Teknik direktörü ata' : 'Oyuncuyu ata'}
      </button>
      <button disabled={busy} onClick={() => onAction('manualSkip')}>
        {triggersFallback ? 'Geç · eksikleri otomatik tamamla' : 'Satılmadı · Geç'}
      </button>
      <button className="undo-action" disabled={busy||!game.undo} onClick={()=>onAction('undo')}>↶ Geri al</button>
    </div>
  );
}

export function OnlineGame() {
  const [screen, setScreen] = useState<'entry' | 'room'>('entry');
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
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
  const [presentation,setPresentation]=useState(false);
  const [poolCatalog,setPoolCatalog]=useState<Array<PoolSourceEntry&{slot:Slot}>>([]);
  const [poolQuery,setPoolQuery]=useState('');
  const [chatOpen,setChatOpen]=useState(false);
  const [chatText,setChatText]=useState('');
  const [chatUnread,setChatUnread]=useState(0);
  const lastChatCountRef=useRef<number|null>(null);
  const poolOptions=useMemo(()=>customPoolOptions(poolCatalog.map(player=>player.club),poolQuery),[poolCatalog,poolQuery]);

  const loadRoom = useCallback(async (s: Session) => {
    try {
      const data = await json(`/api/rooms/${s.code}`, {headers: {Authorization: `Bearer ${s.token}`}}),
        next = data.state as Room;
      if (next.game && next.game.activeTurn !== null && next.game.activeTurn < 0) next.game.activeTurn = null;
      setRoom(next);
      setIsHost(Boolean(data.isHost));
      setMemberId(data.memberId as string | null);
      setOnline(true);
    } catch {
      setOnline(false);
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
      if (params.has('fresh')) return;
      const raw = localStorage.getItem('bidxi-room');
      if (raw)
        try {
          const saved = JSON.parse(raw) as Session;
          setSession(saved);
          setScreen('room');
          void loadRoom(saved);
        } catch {}
    }, 0);
    return () => clearTimeout(id);
  }, [loadRoom]);
  useEffect(() => {
    if (!session) return;
    let running = false;
    const tick = async () => {if (running || document.hidden) return;running = true;try {await refresh()} finally {running = false}};
    const id = setInterval(() => void tick(), room?.status === 'auction' ? 1500 : 3000);
    return () => clearInterval(id);
  }, [refresh, session, room?.status]);
  useEffect(() => {
    if (screen !== 'room' || room?.status !== 'auction') return;
    const id = setInterval(() => {if (!document.hidden) setNow(Date.now())}, 1000);
    return () => clearInterval(id);
  }, [screen, room?.status]);
  useEffect(()=>{if(screen!=='entry'||tab!=='create'||settings.poolMode!=='custom')return;let cancelled=false;void json(`/api/pool?era=${settings.era}`).then(data=>{if(cancelled)return;const source=data as unknown as Record<Slot,PoolSourceEntry[]>;setPoolCatalog(SLOT_KEYS.flatMap(slot=>(source[slot]||[]).map(player=>({...player,slot}))))}).catch(()=>setError('Özel oyuncu havuzu yüklenemedi.'));return()=>{cancelled=true}},[screen,tab,settings.poolMode,settings.era]);
  useEffect(()=>{const count=room?.chat?.length||0;if(lastChatCountRef.current===null){lastChatCountRef.current=count;return}if(count>lastChatCountRef.current&&!chatOpen)setChatUnread(value=>value+count-lastChatCountRef.current!);lastChatCountRef.current=count;if(chatOpen)setChatUnread(0)},[room?.chat?.length,chatOpen]);

  const game = room?.game;
  const approvedManagers = room?.members.filter((member) => member.role === 'manager' && member.approved) || [];
  const myManagerIndex = approvedManagers.findIndex((member) => member.id === memberId);
  const myManager = myManagerIndex >= 0 ? game?.managers[myManagerIndex] : undefined;
  const current = game?.pool[game.index];
  const mode: AuctionMode = room?.settings.auctionMode || 'live';
  const bonusLot = Boolean(game && isBonusPlayerLot(game.pool, game.index, game.managers.length));
  const nextLot = bonusLot && game ? game.pool[game.index + 1] : undefined;
  const nextGroupLabel = nextLot ? (isCoach(nextLot) ? 'teknik direktör açık artırması' : nextLot.benchSlot ? BENCH_SLOTS.find((item) => item.key === nextLot.benchSlot)?.label || nextLot.role : nextLot.role) : '';

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
    setBusy(true);
    setError('');
    try {
      const data =
        tab === 'create'
          ? await json('/api/rooms', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({name, settings}),
            })
          : await json('/api/rooms', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({action: 'join', code, name, role}),
            });
      const nextSession: Session =
        tab === 'create'
          ? {
              code: String(data.code),
              token: String(data.hostToken),
              memberToken: String(data.memberToken),
            }
          : {code: String(data.code), token: String(data.memberToken)};
      localStorage.setItem('bidxi-room', JSON.stringify(nextSession));
      history.replaceState(null, '', `/?mode=online&room=${nextSession.code}`);
      setSession(nextSession);
      setScreen('room');
      await loadRoom(nextSession);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function action(type: string, payload: Record<string, unknown> = {}) {
    if (!session) return;
    setBusy(true);
    try {
      const data = await json(`/api/rooms/${session.code}/actions`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`},
        body: JSON.stringify({type, payload}),
      });
      setRoom(data.state as Room);
      setError('');
    } catch (caught) {
      setError((caught as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (session && room?.status === 'lobby' && !isHost) try {await action('leave')} catch {return}
    localStorage.removeItem('bidxi-room');
    history.replaceState(null, '', '/?mode=online&fresh=1');
    setSession(null);
    setRoom(null);
    setScreen('entry');
    setView('auction');
  }
  async function togglePresentation(){const next=!presentation;setPresentation(next);try{if(next)await document.documentElement.requestFullscreen?.();else if(document.fullscreenElement)await document.exitFullscreen()}catch{}}
  async function sendChat(){const text=chatText.trim();if(!text)return;setChatText('');await action('chat',{text})}
  async function copyRoomCode(){try{await navigator.clipboard.writeText(room?.code||'');setCopied(true);setTimeout(()=>setCopied(false),1800)}catch{setError('Oda kodu kopyalanamadı.')}}
  async function invite(){if(!room)return;const url=`${location.origin}/?mode=online&room=${room.code}`;try{if(navigator.share)await navigator.share({title:'Kadro İhalesi odasına katıl',text:`${room.code} kodlu odaya katıl`,url});else await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1800)}catch(error){if((error as DOMException).name!=='AbortError')setError('Davet bağlantısı paylaşılamadı.')}}
  function confirmLeave(goHome=false){if(!confirm('Oyundan ve odadan tamamen çıkmak istediğinize emin misiniz?'))return;void leave().then(()=>{if(goHome)location.assign('/')})}
  function brandHome(){if(room&&room.status!=='lobby'){if(!confirm('Oyundan çıkıp ana sayfaya dönmek istediğinize emin misiniz?'))return}void leave().then(()=>location.assign('/'))}

  if (screen === 'entry')
    return (
      <main className="online-shell">
        <nav className="online-nav"><button className="brand-lockup brand-home" onClick={()=>location.assign('/')} aria-label="Kadro İhalesi ana sayfasına dön"><img src="/brand-mark.svg" alt=""/><span><b>KADRO İHALESİ</b><small>FUTBOL AÇIK ARTIRMA OYUNU</small></span></button><span className="mode-label">Çok oyunculu</span></nav>
        <section className="online-entry">
          <div>
            <p className="eyebrow">AYNI MASA · HER CİHAZ</p>
            <h1>
              Arkadaşlarınla
              <br />
              <span>canlı açık artırma.</span>
            </h1>
            <p>Oda koduyla katıl, canlı teklif ver veya kurucunun yönettiği manuel modda kadronu telefonundan takip et.</p>
            <div className="online-points">
              <span>● Tüm havuz ayarları</span>
              <span>● Canlı veya manuel mod</span>
              <span>● Anlık kadro ekranı</span>
            </div>
          </div>
          <div className="panel online-panel">
            <div className="online-tabs">
              <button className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}>
                Oda oluştur
              </button>
              <button className={tab === 'join' ? 'active' : ''} onClick={() => setTab('join')}>
                Odaya katıl
              </button>
            </div>
            <label className="label">Görünen adınız</label>
            <input className="online-input" maxLength={24} value={name} onChange={(event) => setName(event.target.value)} placeholder="Menajer adı" />
            {tab === 'join' ? (
              <>
                <label className="label mt-5">Oda kodu</label>
                <input className="online-input room-code-input" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ABC234" />
                <div className="role-choice">
                  <button className={role === 'manager' ? 'active' : ''} onClick={() => setRole('manager')}>
                    Menajer
                  </button>
                  <button className={role === 'spectator' ? 'active' : ''} onClick={() => setRole('spectator')}>
                    Seyirci
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="label mt-5">Futbolcu dönemi</label>
                <div className="online-settings">
                  <button className={settings.era === 'current' ? 'active' : ''} onClick={() => setSettings((value) => ({...value, era: 'current',quality:'all'}))}>
                    <b>Güncel</b><span>Bugünün aktif futbolcuları</span>
                  </button>
                  <button className={settings.era === 'legends' ? 'active' : ''} onClick={() => setSettings((value) => ({...value, era: 'legends',quality:'all'}))}>
                    <b>Son 30 Yıl</b><span>Prime dönem oyuncuları</span>
                  </button>
                </div>
                <label className="label mt-5">Oyuncu yetenekleri</label><button className={`ability-choice online-ability ${settings.revealRatings?'active':''}`} onClick={()=>setSettings(value=>({...value,revealRatings:!value.revealRatings}))}><strong>{settings.revealRatings?'Göster':'Gizle'}</strong><span>{settings.revealRatings?'Puan ve seviye açık':'Sürpriz açık artırma'}</span></button>
                <label className="label mt-5">Havuza dahil edilecek seviyeler</label>
                <div className="tier-picker online-tier-picker">
                  {RATING_TIERS.map((tier) => (
                    <button key={tier} onClick={() => toggleTier(tier)} className={settings.selectedTiers.includes(tier) ? 'active' : ''}>
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
                <div className="auction-mode-picker">
                  <button
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
                <div className="reserve-picker">
                  <button
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
                  <button className={settings.includeBench ? 'active' : ''} onClick={() => setSettings((value) => ({...value, includeBench: true}))}>
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
                  <label>Senaryo<select value={settings.scenarioId} onChange={event=>setSettings(value=>({...value,scenarioId:event.target.value as Settings['scenarioId']}))}><option value="classic">Klasik</option><option value="hidden-gems">Gizli cevherler</option><option value="stars-and-scrubs">Yıldızlar ve sürprizler</option><option value="budget-crunch">Dar bütçe</option><option value="speed-auction">Hızlı açık artırma</option></select></label>
                  <label>Süre<select value={settings.timerSeconds} onChange={event=>setSettings(value=>({...value,timerSeconds:Number(event.target.value) as Settings['timerSeconds']}))}>{[10,15,20,30].map(value=><option key={value} value={value}>{value} saniye</option>)}</select></label>
                  <label>Teklif artışı<select value={settings.bidIncrement} onChange={event=>setSettings(value=>({...value,bidIncrement:Number(event.target.value) as Settings['bidIncrement']}))}>{[5,10,25].map(value=><option key={value} value={value}>${value}M</option>)}</select></label>
                  <label>Diziliş<select value={settings.formation} onChange={event=>setSettings(value=>({...value,formation:event.target.value as Formation}))}>{FORMATIONS.map(value=><option key={value}>{value}</option>)}</select></label>
                  <label>Sezon<select value={settings.seasonLength} onChange={event=>setSettings(value=>({...value,seasonLength:Number(event.target.value) as Settings['seasonLength']}))}>{[1,3,5].map(value=><option key={value} value={value}>{value} oyun</option>)}</select></label>
                  <label className="check-setting"><input type="checkbox" checked={settings.secondChance} onChange={event=>setSettings(value=>({...value,secondChance:event.target.checked}))}/> Satılmayanlara ikinci şans</label>
                </div>
                <label className="label mt-5">Oyuncu havuzu</label>
                <div className="pool-mode"><button className={settings.poolMode!=='custom'?'active':''} onClick={()=>setSettings(value=>({...value,poolMode:'generated',customPlayerIds:[],customPoolSelections:[]}))}>Otomatik havuz</button><button className={settings.poolMode==='custom'?'active':''} onClick={()=>setSettings(value=>({...value,poolMode:'custom'}))}>Özel Havuz Oluştur</button></div>
                {settings.poolMode==='custom'&&<div className="custom-pool"><input className="online-input" value={poolQuery} onChange={event=>setPoolQuery(event.target.value)} placeholder="Lig veya takım ara"/><small>Birden fazla takım ve lig seçebilirsin. Seçtiğin havuzda eksik kalan pozisyonları sistem tamamlar.</small>{Boolean(settings.customPoolSelections?.length)&&<div className="custom-pool-tags">{settings.customPoolSelections!.map(item=><button key={`${item.type}:${item.name}`} onClick={()=>setSettings(value=>({...value,customPoolSelections:value.customPoolSelections?.filter(selected=>selected.type!==item.type||selected.name!==item.name)}))}><span>{item.type==='club'?'TAKIM':'LİG'}</span>{item.name} ×</button>)}</div>}{poolQuery.trim().length>1&&<div className="custom-pool-results">{poolOptions.length?poolOptions.map(option=>{const selected=settings.customPoolSelections?.some(item=>item.type===option.type&&item.name===option.name);return <button className={selected?'active':''} key={`${option.type}:${option.name}`} onClick={()=>setSettings(value=>({...value,customPoolSelections:selected?value.customPoolSelections?.filter(item=>item.type!==option.type||item.name!==option.name):[...(value.customPoolSelections||[]),option]}))}><span className="pool-result-type">{option.type==='club'?'TAKIM':'LİG'}</span><b>{selected?'✓ ':'+ '}{option.name}</b><span>{option.type==='club'?(option.league||'Lig bilgisi bulunamadı'):'Ligdeki tüm uygun takımlar'}</span></button>}):<p className="pool-empty">Eşleşen takım veya lig bulunamadı.</p>}</div>}</div>}
              </>
            )}
            {error && (
              <p className="online-error" role="alert">
                {error}
              </p>
            )}
            <button className="start mt-6 w-full" disabled={busy} onClick={enter}>
              {busy ? 'Bağlanıyor…' : tab === 'create' ? 'Odayı oluştur' : 'Odaya katıl'} <span>→</span>
            </button>
          </div>
        </section>
      </main>
    );

  if (!room || !session) return <main className="online-loading">Odaya bağlanılıyor…</main>;

  const me = room.members.find((member) => member.id === memberId);
  const approved = isHost || Boolean(me?.approved);
  const managers = room.members.filter((member) => member.role === 'manager' && member.approved);
  const remaining = game?.deadline ? Math.max(0, Math.ceil((game.deadline - now) / 1000)) : 0;
  const auctionOpen = game?.activeTurn !== null;
  const canParticipate = Boolean(game && current && myManager && approved && me?.role === 'manager' && myManagerIndex >= 0 && !game.paused && auctionOpen && !game.passed.includes(myManagerIndex) && game.leader !== myManagerIndex && !lotFilled(myManager, current));
  const selected = selectedManager === null ? null : game?.managers[selectedManager] || null;

  return (
    <main className={`online-room ${game && myManager && room.status === 'auction' ? 'has-mobile-bar' : ''} ${presentation?'presentation-mode':''}`}>
      <header className="room-header">
        <div>
          <button className="brand-lockup brand-home room-brand" onClick={brandHome} aria-label="Kadro İhalesi ana sayfasına dön"><img src="/brand-mark.svg" alt=""/><span><b>KADRO İHALESİ</b><small>FUTBOL AÇIK ARTIRMA OYUNU</small></span></button>
          <span className={`connection ${online ? 'ok' : ''}`}>{online ? '● Bağlı' : '● Yeniden bağlanıyor'}</span>
        </div>
        {myManager && (
          <div className="manager-identity">
            <small>MENAJER · KALAN BÜTÇE</small>
            <b>{myManager.name}</b>
            <strong>{money(myManager.budget)}</strong>
          </div>
        )}
        <div className="room-share"><button className="room-code" onClick={copyRoomCode} title="Oda kodunu kopyala"><small>ODA KODU · KOPYALA</small><b>{room.code}</b></button>{room.status==='lobby'&&<button className="invite-link" onClick={invite}>↗ Link ile davet et</button>}</div>
        <button className="tool-btn leave-room" onClick={()=>confirmLeave(false)}>
          Odadan çık
        </button>
        {game&&room.status==='auction'&&<button className="tool-btn tv-mode" onClick={togglePresentation}>{presentation?'TV modundan çık':'▣ TV modu'}</button>}
      </header>
      {game && myManager && room.status === 'auction' && (
        <nav className="manager-view-tabs" aria-label="Menajer ekranı">
          <button aria-pressed={view==='auction'} className={view === 'auction' ? 'active' : ''} onClick={() => setView('auction')}>
            <b>↗</b>Açık artırma gidişatı
          </button>
          <button aria-pressed={view==='squad'} className={view === 'squad' ? 'active' : ''} onClick={() => setView('squad')}>
            <b>▦</b>Kadrom{' '}
            <span>
              {Object.keys(myManager.squad).length}/11
              {myManager.bench ? ` + ${Object.keys(myManager.bench).length}/4` : ''}
            </span>
          </button>
        </nav>
      )}
      <div className="sr-only" aria-live="polite">{copied?'Oda bağlantısı kopyalandı.':error}</div>{copied&&<p className="online-toast success">Bağlantı kopyalandı</p>}{error && <p className="online-toast" role="alert">{error}</p>}

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
                      {member.isBot?`AI menajer · ${member.botStyle==='value'?'Acemi':member.botStyle==='aggressive'?'Uzman':'Ortalama'}`:member.role === 'manager' ? 'Menajer' : 'Seyirci'} · {member.approved ? 'Onaylandı' : 'Onay bekliyor'}
                    </small>
                  </div>
                  {isHost&&member.isBot?<button className="danger-action" disabled={busy} onClick={()=>action('removeBot',{memberId:member.id})}>Kaldır</button>:isHost && !member.approved ? (
                    <button disabled={busy} onClick={() => action('approve', {memberId: member.id})}>
                      Onayla
                    </button>
                  ) : (
                    <em>{member.approved ? '✓' : '…'}</em>
                  )}
                </article>
              ))}
            </div>
            {isHost ? (
              <div className="lobby-actions"><div className="ai-level-picker"><span>AI RAKİP EKLE</span><button disabled={busy||managers.length>=8} onClick={()=>action('addBot',{style:'value'})}><b>Acemi</b><small>Daha erken çekilir</small></button><button disabled={busy||managers.length>=8} onClick={()=>action('addBot',{style:'balanced'})}><b>Ortalama</b><small>Dengeli teklif verir</small></button><button disabled={busy||managers.length>=8} onClick={()=>action('addBot',{style:'aggressive'})}><b>Uzman</b><small>Değerli lotları zorlar</small></button></div><button className="start" disabled={busy || managers.length < 2} onClick={() => action('start')}>Oyunu başlat <span>→</span></button></div>
            ) : (
              !approved && <div className="waiting">Oda sahibinin onayı bekleniyor…</div>
            )}
          </div>
          <aside className="panel room-rules">
            <p className="eyebrow">ODA KURALLARI</p>
            <h3>
              {room.settings.era === 'current' ? 'Güncel' : 'Son 30 yıl'}
            </h3>
            <p>{mode === 'manual' ? 'Manuel kurucu yönetimi' : 'Herkes kendi cihazından teklif verir'}</p>
            <p>Seviyeler: {room.settings.selectedTiers?.join(' · ') || 'Tüm seviyeler'}</p>
            <p>Puanlar {room.settings.revealRatings ? 'görünür' : 'gizli'}</p>
            <p>{room.settings.includeBench ? '11 oyuncu + 4 yedek · kişi başı +$250M' : '11 oyuncu · yedeksiz'}</p>
            <p>
              {managers.length} onaylı menajer · {room.members.filter((member) => member.role === 'spectator').length} seyirci
            </p>
            <p>Oda ve sonuçlar 7 gün saklanır.</p>
          </aside>
        </section>
      ) : room.status === 'results' && game ? (
        <OnlineResults managers={game.managers} audit={game.audit||[]} season={room.season} onRematch={isHost&&(!room.season||room.season.round<room.season.length)?()=>action('rematch'):undefined} />
      ) : view === 'squad' && myManager ? (
        <div className="my-squad-screen">
          <div className="formation-picker" aria-label="Takım dizilişi">{FORMATIONS.map(formation=><button className={(myManager.formation||'4-2-3-1')===formation?'active':''} key={formation} onClick={()=>action('formation',{formation})}>{formation}</button>)}</div>
          <SquadPanel manager={myManager} />
        </div>
      ) : game && current ? (
        <section className="online-auction">
          <aside>
            <p className="eyebrow">MENAJERLER · KADRO İÇİN TIKLA</p>
            {game.managers.map((manager, index) => (
              <button className={`online-manager-card ${game.leader === index ? 'leader' : ''}`} key={manager.id} onClick={() => setSelectedManager(index)}>
                <span className="avatar">{manager.name[0]}</span>
                <span>
                  <b>{manager.name}</b>
                  <small>
                    {Object.keys(manager.squad).length}/11 {manager.bench ? `· ${Object.keys(manager.bench).length}/4 yedek ` : ''}· {manager.coach ? 'TD ✓ · ' : ''}
                    {money(manager.budget)}
                  </small>
                </span>
                <em>→</em>
              </button>
            ))}
          </aside>
          <div>
            <div className="online-lot-head">
              <span>{isCoach(current) ? 'TEKNİK DİREKTÖR AÇIK ARTIRMASI' : `LOT ${game.index + 1}/${game.pool.length}`}</span>
              <b>{mode === 'manual' ? 'MANUEL YÖNETİM' : game.paused ? 'DURAKLATILDI' : auctionOpen ? 'SERBEST TEKLİF' : game.leader === null ? 'SONRAKİ LOT' : 'TEKLİFLER KAPANDI'}</b>
              <em className={remaining>0&&remaining<=5?'countdown-critical':''}><i/>{game.deadline ? `${remaining}s` : '—'}</em>
            </div>
            {game.bonusReveal&&<div className="missed-bonus-card">{game.bonusReveal.image?<img src={game.bonusReveal.image} alt=""/>:<span>?</span>}<div><b>KAÇAN BONUS</b><p>Eğer bonus açılsaydı <strong>{game.bonusReveal.name}</strong> oyuncusu gelecekti.</p><small>{game.bonusReveal.role} · Puanı: <strong>{game.bonusReveal.rating.toFixed(1)}</strong></small></div></div>}<p className="online-lot-progress">{auctionProgressLabel(game.pool, game.index)}</p>
            {bonusLot && (
              <div className="bonus-lot-alert">
                <b>⚠ BONUS OYUNCU</b>
                <span>Bu pozisyonun son açık artırması. Ardından {nextGroupLabel} başlayacak.</span>
              </div>
            )}
            <article className={`online-player ${isCoach(current) ? 'coach-lot' : ''} ${bonusLot ? 'bonus-lot-card' : ''}`}>
              {!isCoach(current)&&<div className="auction-mini-formation" aria-label={`${current.role} mevki konumu, yatay saha görünümü`}><i className="mini-halfway"/>{SLOT_KEYS.map(slot=>{const point=FORMATION_POSITIONS[myManager?.formation||room.settings.formation||'4-2-3-1'][slot];return <span key={slot} className={slot===current.slot?'active':''} style={{left:point.top,top:point.left}}>{slot===current.slot?slot:''}</span>})}</div>}
              <div className="online-player-visual">
                <span>{current.name[0]}</span>
                <PlayerImage player={current} className="online-player-photo" />
              </div>
              <div className="online-player-copy">
                <span>{current.role}</span>
                <h1>{current.name}</h1>
                {isCoach(current) ? (
                  <p>
                    {current.preferredFormation} · Taktik {current.tactics} · Motivasyon {current.motivation} · Uyum {current.adaptability}
                  </p>
                ) : (
                  <p>
                    {current.club || 'Kulüp bilgisi yok'} · {room.settings.revealRatings ? `${current.rating}/100 · ${ratingLevel(current.rating)}` : 'Seviye gizli'}
                  </p>
                )}
              </div>
            </article>
            <div className="online-bid">
              <div>
                <small>{game.leader === null ? 'AÇILIŞ' : 'MEVCUT TEKLİF'}</small>
                <strong aria-live="polite">{money(game.leader === null ? auctionOpeningPrice(current,game.managers) : game.bid)}</strong>
                {game.leader !== null && <span className="current-leader">{game.managers[game.leader].name}</span>}
              </div>
              {mode === 'manual' ? (
                isHost ? (
                  <ManualControls key={current.id} game={game} current={current} busy={busy} onAction={action} />
                ) : (
                  <p className="manual-waiting">Kurucu, kazanan menajeri ve satış tutarını giriyor.</p>
                )
              ) : me?.role === 'spectator' ? (
                <p>Seyirci olarak açık artırmayı izliyorsunuz.</p>
              ) : (
                <div className="online-action-stack">
                  <div className="online-actions">
                    {game.leader === null ? (
                      <button className="primary-action" disabled={!canParticipate || busy} onClick={() => action('bid', {increment: 0})}>
                        Teklif ver
                      </button>
                    ) : (
                      [5, 10, 25].map((increment) => (
                        <button key={increment} disabled={!canParticipate || busy} onClick={() => action('bid', {increment})}>
                          +{increment}M
                        </button>
                      ))
                    )}
                    <button disabled={!canParticipate || busy} onClick={() => action('pass')}>
                      Pas
                    </button>
                  </div>
                </div>
              )}
              {isHost&&mode==='live'&&<div className="host-controls permanent-host-controls"><span>KURUCU KONTROLLERİ · HER ZAMAN ERİŞİLEBİLİR</span><button className="danger-action" disabled={busy||game.leader!==null} onClick={()=>{if(confirm(`${current.name} satılmadan geçilsin mi?`))void action('skip')}}>Oyuncuyu pas geç</button><button disabled={busy||!auctionOpen||game.leader===null} onClick={()=>action('close')}>Teklifi sonlandır</button><button className="host-primary" disabled={busy||auctionOpen||game.leader===null} onClick={()=>action('sell')}>Satışı tamamla</button><button disabled={busy||auctionOpen||game.leader===null} onClick={()=>action('reopen')}>Yeniden aç</button><button disabled={busy} onClick={()=>action('pause')}>{game.paused?'Devam ettir':'Duraklat'}</button><button className="undo-action" disabled={busy||!game.undo} onClick={()=>action('undo')}>↶ Geri al</button></div>}
            </div>
          </div>
          <aside aria-live="polite" aria-label="Canlı açık artırma akışı">
            <p className="eyebrow">CANLI AKIŞ</p>
            {game.feed.map((item, index) => (
              <p className="online-feed" key={`${item}-${index}`}>
                {item}
              </p>
            ))}
          </aside>
        </section>
      ) : null}
      {selected && <ManagerDrawer manager={selected} onClose={() => setSelectedManager(null)} />}
      <button className={`chat-fab ${chatUnread>0?'has-unread':''}`} onClick={()=>{setChatOpen(value=>!value);setChatUnread(0)}} aria-expanded={chatOpen}>💬 <span>Sohbet</span>{chatUnread>0?<b>{chatUnread}</b>:null}</button>
      {chatOpen&&<aside className="room-chat" aria-label="Oda sohbeti"><header><b>Oda sohbeti</b><button onClick={()=>setChatOpen(false)}>×</button></header><div>{room.chat?.length?room.chat.map(message=><p key={message.id}><b>{message.name}</b><span>{message.text}</span></p>):<small>Henüz mesaj yok. İlk mesajı siz yazın.</small>}</div><form onSubmit={event=>{event.preventDefault();void sendChat()}}><input maxLength={200} value={chatText} onChange={event=>setChatText(event.target.value)} placeholder="Mesaj yaz…" aria-label="Sohbet mesajı"/><button disabled={busy||!chatText.trim()}>Gönder</button></form></aside>}
    </main>
  );
}

function OnlineResults({managers,audit,onRematch,season}: {managers: Manager[];audit:string[];onRematch?:()=>Promise<void>;season?:Room['season']}) {
  const {ranked, insights} = useMemo(() => {
    const ordered = rankManagers(managers);
    return {ranked: ordered, insights: resultInsights(ordered)};
  }, [managers]);
  const tournament=useMemo(()=>simulateTournament(managers,'online-results'),[managers]);
  async function shareCard(){const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.fillStyle='#09100b';ctx.fillRect(0,0,1080,1350);ctx.fillStyle='#c9ff45';ctx.font='900 54px system-ui';ctx.fillText('KADRO İHALESİ',70,100);ctx.fillStyle='white';ctx.font='900 76px system-ui';ctx.fillText(`${ranked[0]?.name||'Şampiyon'} kazandı`,70,220);ctx.font='700 36px system-ui';ranked.slice(0,5).forEach((team,index)=>ctx.fillText(`${index+1}. ${team.name.slice(0,22)}  ${team.score.toFixed(2)}`,80,340+index*105));ctx.fillStyle='#a1a1aa';ctx.font='28px system-ui';ctx.fillText('Kadro puanlarına dayalı oyun sonucudur.',70,1240);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)return;const file=new File([blob],'kadro-ihalesi-sonucu.png',{type:'image/png'});try{if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'Kadro İhalesi sonucu'});else{const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=file.name;link.click();URL.revokeObjectURL(link.href)}}catch(error){if((error as DOMException).name!=='AbortError')throw error}}
  return (
    <section className="online-results">
      <p className="eyebrow">ODA SONUCU</p>
      <h1>{ranked[0]?.name} kazandı</h1>
      {ranked[1] && (
        <section className="result-analysis online-result-analysis">
          <div>
            <p className="eyebrow">SIRALAMA ANALİZİ</p>
            <h2>Neden birinci ve ikinci oldular?</h2>
            <p>{insights.winner}</p>
            <p>{insights.runnerUp}</p>
          </div>
          <aside>
            <span>MUHTEMEL MAÇ</span>
            <strong>{insights.match.scoreLine}</strong>
            <p>{insights.match.summary}</p>
          </aside>
        </section>
      )}
      <div>
        {ranked.map((manager, index) => (
          <article key={manager.id}>
            <span>#{index + 1}</span>
            <h2>{manager.name}</h2>
            <strong>{manager.score.toFixed(2)}</strong>
            <p>
              Ortalama {manager.avg} · Kalan {money(manager.budget)} · Kadro {Object.keys(manager.squad).length}/11
              {manager.bench ? ` · Yedek ${Object.keys(manager.bench).length}/4 · Derinlik +${manager.benchDepth}` : ''}
            </p>
            <p>
              Teknik direktör: {manager.coach?.name || 'Yok'}
              {manager.coach ? ` · +${manager.coachBoost} takım puanı · %${manager.coachFit} uyum` : ''}
            </p>
          </article>
        ))}
      </div>
      {tournament.table.length>2&&<section className="tournament"><p className="eyebrow">MUHTEMEL MİNİ LİG</p><div className="tournament-table"><b>#</b><b>Takım</b><b>O</b><b>AV</b><b>P</b>{tournament.table.map((row,index)=><span key={row.managerId} className="tournament-row"><i>{index+1}</i><strong>{row.name}</strong><i>{row.played}</i><i>{row.goalDifference}</i><b>{row.points}</b></span>)}</div><small>Sonuçlar kadro, hat eşleşmeleri ve teknik direktör uyumundan deterministik olarak üretilen oyun tahminidir.</small></section>}
      {season&&season.length>1&&<section className="tournament"><p className="eyebrow">SEZON · {season.round}/{season.length}</p><div className="season-list">{Object.values(season.standings).sort((a,b)=>b.points-a.points||b.totalScore-a.totalScore).map((row,index)=><p key={row.name}><b>{index+1}. {row.name}</b><span>{row.points} puan · {row.wins} galibiyet</span></p>)}</div></section>}
      {audit.length>0&&<details className="result-audit"><summary>Oyun kararları ve otomatik atamalar</summary>{audit.map((item,index)=><p key={`${item}-${index}`}>{item}</p>)}</details>}
      <button className="share-card" onClick={shareCard}>↗ Sonuç kartını paylaş</button>
      {onRematch&&<button className="start mx-auto mt-4" onClick={onRematch}>Aynı menajerlerle rövanş <span>↻</span></button>}
      <p>Bu sonuç odada 7 gün boyunca saklanır.</p>
    </section>
  );
}

export default function OnlineRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    params.set('mode', 'online');
    location.replace(`/?${params.toString()}`);
  }, []);
  return <main className="online-loading">Kadro İhalesi deneyimine yönlendiriliyor…</main>;
}
