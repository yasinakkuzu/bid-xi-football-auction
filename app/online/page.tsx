'use client';

import Link from 'next/link';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {rankManagers,ratingLevel,RATING_TIERS,SLOT_KEYS,type Footballer,type Manager,type RatingTier,type Slot} from '../../lib/game-engine';

type Member={id:string;name:string;role:'manager'|'spectator';approved:boolean};
type AuctionMode='live'|'manual';
type Settings={era:'current'|'legends';quality:'best'|'all';revealRatings:boolean;selectedTiers:RatingTier[];auctionMode?:AuctionMode};
type Game={managers:Manager[];pool:Footballer[];index:number;bid:number;leader:number|null;passed:number[];activeTurn:number|null;paused:boolean;deadline:number|null;feed:string[]};
type Room={code:string;status:'lobby'|'auction'|'results';settings:Settings;members:Member[];game?:Game};
type Session={code:string;token:string;memberToken?:string};

const money=(n:number)=>`$${n}M`;
const defaults:Settings={era:'current',quality:'best',revealRatings:false,selectedTiers:RATING_TIERS,auctionMode:'live'};
const coordinates:Record<Slot,{left:string;top:string}>={GK:{left:'50%',top:'91%'},RB:{left:'82%',top:'72%'},CB1:{left:'61%',top:'77%'},CB2:{left:'39%',top:'77%'},LB:{left:'18%',top:'72%'},DM:{left:'50%',top:'59%'},CM:{left:'31%',top:'48%'},AM:{left:'69%',top:'48%'},RW:{left:'82%',top:'27%'},LW:{left:'18%',top:'27%'},ST:{left:'50%',top:'13%'}};

async function json(url:string,options?:RequestInit){
  let response:Response;
  try{response=await fetch(url,options)}catch{throw new Error('Bağlantı kurulamadı. Lütfen tekrar deneyin.')}
  const text=await response.text();
  let data:Record<string,unknown>={};
  try{data=JSON.parse(text) as Record<string,unknown>}catch{}
  if(!response.ok)throw new Error(String(data.error||'İşlem başarısız'));
  return data;
}

function PlayerImage({player,className}:{player:Footballer;className:string}){
  if(!player.image)return <span className={`${className} player-image-placeholder`}>{player.name[0]}</span>;
  return <img className={className} src={player.image} alt={`${player.name} fotoğrafı`} referrerPolicy="no-referrer" onError={event=>{event.currentTarget.style.display='none'}}/>;
}

function SquadPanel({manager,compact=false}:{manager:Manager;compact?:boolean}){
  return <section className={`online-squad-panel ${compact?'compact':''}`}>
    <div className="online-squad-summary"><div><p className="eyebrow">4-2-3-1 KADRO</p><h2>{manager.name}</h2></div><div><small>KALAN BÜTÇE</small><strong>{money(manager.budget)}</strong><span>{Object.keys(manager.squad).length}/11 oyuncu</span></div></div>
    <div className="online-squad-formation" aria-label={`${manager.name} kadro dizilimi`}><span className="online-halfway"/><span className="online-center-circle"/>{SLOT_KEYS.map(slot=>{const player=manager.squad[slot];return <div className={`online-formation-player ${player?'filled':''}`} style={coordinates[slot]} key={slot}>{player?<><PlayerImage player={player} className="squad-player-photo"/><b>{player.name}</b><small>{slot}</small></>:<><span>{slot}</span><b>Boş</b></>}</div>})}</div>
    <div className="online-squad-list">{SLOT_KEYS.map(slot=>{const player=manager.squad[slot];return <article key={slot}><span>{slot}</span>{player?<><PlayerImage player={player} className="squad-list-photo"/><div><b>{player.name}</b><small>{player.club||player.role}</small></div><em>{player.rating}</em></>:<div><b>Henüz boş</b><small>{slot}</small></div>}</article>})}</div>
  </section>;
}

function ManagerDrawer({manager,onClose}:{manager:Manager;onClose:()=>void}){
  return <div className="drawer-backdrop" onClick={onClose}><aside className="squad-drawer online-manager-drawer" onClick={event=>event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">MENAJER DETAYI</p></div><button onClick={onClose} aria-label="Kadroyu kapat">×</button></div><SquadPanel manager={manager} compact/></aside></div>;
}

function ManualControls({game,current,busy,onAction}:{game:Game;current:Footballer;busy:boolean;onAction:(type:string,payload?:Record<string,unknown>)=>Promise<void>}){
  const first=game.managers.findIndex(manager=>!manager.squad[current.slot]);
  const [managerIndex,setManagerIndex]=useState(first>=0?String(first):'');
  const [amount,setAmount]=useState(String(current.price));
  return <div className="manual-controls"><select value={managerIndex} onChange={event=>setManagerIndex(event.target.value)} aria-label="Oyuncuyu alacak menajer">{game.managers.map((manager,index)=><option value={index} disabled={Boolean(manager.squad[current.slot])} key={manager.id}>{manager.name} · {money(manager.budget)}</option>)}</select><div><input type="number" min="5" step="1" value={amount} onChange={event=>setAmount(event.target.value)} aria-label="Satış tutarı"/><span>M</span></div><button className="manual-award" disabled={busy||managerIndex===''} onClick={()=>onAction('manualSell',{managerIndex:Number(managerIndex),amount:Number(amount)})}>Oyuncuyu ata</button><button disabled={busy} onClick={()=>onAction('manualSkip')}>Satılmadı · Geç</button></div>;
}

export default function Online(){
  const [screen,setScreen]=useState<'entry'|'room'>('entry');
  const [tab,setTab]=useState<'create'|'join'>('create');
  const [name,setName]=useState('');
  const [code,setCode]=useState('');
  const [role,setRole]=useState<'manager'|'spectator'>('manager');
  const [settings,setSettings]=useState(defaults);
  const [session,setSession]=useState<Session|null>(null);
  const [room,setRoom]=useState<Room|null>(null);
  const [isHost,setIsHost]=useState(false);
  const [memberId,setMemberId]=useState<string|null>(null);
  const [online,setOnline]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [now,setNow]=useState(0);
  const [view,setView]=useState<'auction'|'squad'>('auction');
  const [selectedManager,setSelectedManager]=useState<number|null>(null);

  const loadRoom=useCallback(async(s:Session)=>{
    try{
      const data=await json(`/api/rooms/${s.code}?token=${encodeURIComponent(s.token)}`),next=data.state as Room;
      if(next.game&&next.game.activeTurn!==null&&next.game.activeTurn<0)next.game.activeTurn=null;
      setRoom(next);setIsHost(Boolean(data.isHost));setMemberId(data.memberId as string|null);setOnline(true);
    }catch{setOnline(false)}
  },[]);
  const refresh=useCallback(async()=>{if(session)await loadRoom(session)},[loadRoom,session]);

  useEffect(()=>{const id=setTimeout(()=>{const params=new URLSearchParams(location.search),shared=params.get('room');if(shared){setCode(shared.toUpperCase());setTab('join')}if(params.has('fresh'))return;const raw=localStorage.getItem('bidxi-room');if(raw)try{const saved=JSON.parse(raw) as Session;setSession(saved);setScreen('room');void loadRoom(saved)}catch{}},0);return()=>clearTimeout(id)},[loadRoom]);
  useEffect(()=>{if(!session)return;const id=setInterval(()=>void refresh(),1200);return()=>clearInterval(id)},[refresh,session]);
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(id)},[]);

  const game=room?.game;
  const approvedManagers=room?.members.filter(member=>member.role==='manager'&&member.approved)||[];
  const myManagerIndex=approvedManagers.findIndex(member=>member.id===memberId);
  const myManager=myManagerIndex>=0?game?.managers[myManagerIndex]:undefined;
  const current=game?.pool[game.index];
  const mode:AuctionMode=room?.settings.auctionMode||'live';

  async function enter(){
    if(!name.trim()){setError('İsim gerekli');return}
    setBusy(true);setError('');
    try{
      const data=tab==='create'?await json('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,settings})}):await json('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'join',code,name,role})});
      const nextSession:Session=tab==='create'?{code:String(data.code),token:String(data.hostToken),memberToken:String(data.memberToken)}:{code:String(data.code),token:String(data.memberToken)};
      localStorage.setItem('bidxi-room',JSON.stringify(nextSession));setSession(nextSession);setScreen('room');await loadRoom(nextSession);
    }catch(caught){setError((caught as Error).message)}finally{setBusy(false)}
  }

  async function action(type:string,payload:Record<string,unknown>={}){
    if(!session)return;
    setBusy(true);
    try{const data=await json(`/api/rooms/${session.code}/actions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:session.token,type,payload})});setRoom(data.state as Room);setError('')}
    catch(caught){setError((caught as Error).message);await refresh()}
    finally{setBusy(false)}
  }

  function leave(){localStorage.removeItem('bidxi-room');setSession(null);setRoom(null);setScreen('entry');setView('auction')}

  if(screen==='entry')return <main className="online-shell"><nav className="online-nav"><Link href="/">← Yerel oyun</Link><b>BID XI ONLINE</b><span>2–8 kişi</span></nav><section className="online-entry"><div><p className="eyebrow">AYNI MASA · HER CİHAZ</p><h1>Arkadaşlarınla<br/><span>canlı açık artırma.</span></h1><p>Oda koduyla katıl, canlı teklif ver veya kurucunun yönettiği manuel modda kadronu telefonundan takip et.</p><div className="online-points"><span>● Tam kurucu kontrolü</span><span>● Canlı veya manuel mod</span><span>● Anlık kadro ekranı</span></div></div><div className="panel online-panel"><div className="online-tabs"><button className={tab==='create'?'active':''} onClick={()=>setTab('create')}>Oda oluştur</button><button className={tab==='join'?'active':''} onClick={()=>setTab('join')}>Odaya katıl</button></div><label className="label">Görünen adınız</label><input className="online-input" maxLength={24} value={name} onChange={event=>setName(event.target.value)} placeholder="Menajer adı"/>{tab==='join'?<><label className="label mt-5">Oda kodu</label><input className="online-input room-code-input" maxLength={6} value={code} onChange={event=>setCode(event.target.value.toUpperCase())} placeholder="ABC234"/><div className="role-choice"><button className={role==='manager'?'active':''} onClick={()=>setRole('manager')}>Menajer</button><button className={role==='spectator'?'active':''} onClick={()=>setRole('spectator')}>Seyirci</button></div></>:<><label className="label mt-5">Oyun biçimi</label><div className="online-settings"><button className={settings.era==='current'?'active':''} onClick={()=>setSettings(value=>({...value,era:'current'}))}>Güncel</button><button className={settings.era==='legends'?'active':''} onClick={()=>setSettings(value=>({...value,era:'legends'}))}>Son 30 yıl</button><button className={settings.quality==='best'?'active':''} onClick={()=>setSettings(value=>({...value,quality:'best'}))}>En iyiler</button><button className={settings.quality==='all'?'active':''} onClick={()=>setSettings(value=>({...value,quality:'all'}))}>Herkes</button><button className={settings.revealRatings?'active':''} onClick={()=>setSettings(value=>({...value,revealRatings:!value.revealRatings}))}>{settings.revealRatings?'Puanlar açık':'Puanlar gizli'}</button></div><label className="label mt-5">Açık artırma kontrolü</label><div className="auction-mode-picker"><button className={(settings.auctionMode||'live')==='live'?'active':''} onClick={()=>setSettings(value=>({...value,auctionMode:'live'}))}><b>Canlı teklif</b><span>Her menajer kendi cihazından teklif verir.</span></button><button className={settings.auctionMode==='manual'?'active':''} onClick={()=>setSettings(value=>({...value,auctionMode:'manual'}))}><b>Manuel yönetim</b><span>Kurucu kazananı ve tutarı sisteme girer.</span></button></div></>}{error&&<p className="online-error" role="alert">{error}</p>}<button className="start mt-6 w-full" disabled={busy} onClick={enter}>{busy?'Bağlanıyor…':tab==='create'?'Odayı oluştur':'Odaya katıl'} <span>→</span></button></div></section></main>;

  if(!room||!session)return <main className="online-loading">Odaya bağlanılıyor…</main>;

  const me=room.members.find(member=>member.id===memberId);
  const approved=isHost||Boolean(me?.approved);
  const managers=room.members.filter(member=>member.role==='manager'&&member.approved);
  const remaining=game?.deadline?Math.max(0,Math.ceil((game.deadline-now)/1000)):0;
  const auctionOpen=game?.activeTurn!==null;
  const canParticipate=Boolean(game&&current&&approved&&me?.role==='manager'&&myManagerIndex>=0&&!game.paused&&auctionOpen&&!game.passed.includes(myManagerIndex)&&game.leader!==myManagerIndex&&!myManager?.squad[current.slot]);
  const selected=selectedManager===null?null:game?.managers[selectedManager]||null;

  return <main className="online-room"><header className="room-header"><div><Link href="/">BID XI</Link><span className={`connection ${online?'ok':''}`}>{online?'● Bağlı':'● Yeniden bağlanıyor'}</span></div>{myManager&&<div className="manager-identity"><small>MENAJER</small><b>{myManager.name}</b><strong>{money(myManager.budget)}</strong></div>}<button className="room-code" onClick={()=>navigator.clipboard.writeText(`${location.origin}/online?room=${room.code}`)}><small>ODA KODU</small><b>{room.code}</b></button><button className="tool-btn" onClick={leave}>Odadan çık</button></header>{game&&myManager&&room.status==='auction'&&<nav className="manager-view-tabs" aria-label="Menajer ekranı"><button className={view==='auction'?'active':''} onClick={()=>setView('auction')}>Anlık Açık Artırma</button><button className={view==='squad'?'active':''} onClick={()=>setView('squad')}>Kadrom <span>{Object.keys(myManager.squad).length}/11</span></button></nav>}{error&&<p className="online-toast">{error}</p>}

    {room.status==='lobby'?<section className="lobby"><div><p className="eyebrow">BEKLEME ODASI</p><h1>{isHost?'Arkadaşlarını bekle':'Oda sahibinin onayını bekle'}</h1><p>Oda kodunu paylaşın. Oyun, en az iki onaylı menajer olduğunda başlayabilir.</p><div className="member-list">{room.members.map(member=><article key={member.id}><span className="avatar">{member.name[0]?.toUpperCase()}</span><div><b>{member.name}{member.id===memberId?' · Siz':''}</b><small>{member.role==='manager'?'Menajer':'Seyirci'} · {member.approved?'Onaylandı':'Onay bekliyor'}</small></div>{isHost&&!member.approved?<button disabled={busy} onClick={()=>action('approve',{memberId:member.id})}>Onayla</button>:<em>{member.approved?'✓':'…'}</em>}</article>)}</div>{isHost?<button className="start" disabled={busy||managers.length<2} onClick={()=>action('start')}>Oyunu başlat <span>→</span></button>:!approved&&<div className="waiting">Oda sahibinin onayı bekleniyor…</div>}</div><aside className="panel room-rules"><p className="eyebrow">ODA KURALLARI</p><h3>{room.settings.era==='current'?'Güncel':'Son 30 yıl'} · {room.settings.quality==='best'?'En iyiler':'Herkes'}</h3><p>{mode==='manual'?'Manuel kurucu yönetimi':'Herkes kendi cihazından teklif verir'}</p><p>Puanlar {room.settings.revealRatings?'görünür':'gizli'}</p><p>{managers.length} onaylı menajer · {room.members.filter(member=>member.role==='spectator').length} seyirci</p><p>Oda ve sonuçlar 7 gün saklanır.</p></aside></section>:
    room.status==='results'&&game?<OnlineResults managers={game.managers}/>:
    view==='squad'&&myManager?<div className="my-squad-screen"><SquadPanel manager={myManager}/></div>:
    game&&current?<section className="online-auction"><aside><p className="eyebrow">MENAJERLER · KADRO İÇİN TIKLA</p>{game.managers.map((manager,index)=><button className={`online-manager-card ${game.leader===index?'leader':''}`} key={manager.id} onClick={()=>setSelectedManager(index)}><span className="avatar">{manager.name[0]}</span><span><b>{manager.name}</b><small>{Object.keys(manager.squad).length}/11 · {money(manager.budget)}</small></span><em>→</em></button>)}</aside><div><div className="online-lot-head"><span>LOT {game.index+1}/{game.pool.length}</span><b>{mode==='manual'?'MANUEL YÖNETİM':game.paused?'DURAKLATILDI':auctionOpen?'SERBEST TEKLİF':game.leader===null?'SONRAKİ LOT':'TEKLİFLER KAPANDI'}</b><em>{game.deadline?`${remaining}s`:'—'}</em></div><article className="online-player"><div className="online-player-visual"><span>{current.name[0]}</span><PlayerImage player={current} className="online-player-photo"/></div><div className="online-player-copy"><span>{current.role}</span><h1>{current.name}</h1><p>{current.club||'Kulüp bilgisi yok'} · {room.settings.revealRatings?`${current.rating}/100 · ${ratingLevel(current.rating)}`:'Seviye gizli'}</p></div></article><div className="online-bid"><div><small>{game.leader===null?'AÇILIŞ':'MEVCUT TEKLİF'}</small><strong>{money(game.leader===null?current.price:game.bid)}</strong>{game.leader!==null&&<span>{game.managers[game.leader].name}</span>}</div>{mode==='manual'?isHost?<ManualControls key={current.id} game={game} current={current} busy={busy} onAction={action}/>:<p className="manual-waiting">Kurucu, kazanan menajeri ve satış tutarını giriyor.</p>:me?.role==='spectator'?<p>Seyirci olarak açık artırmayı izliyorsunuz.</p>:<div className="online-action-stack"><div className="online-actions">{game.leader===null?<button className="primary-action" disabled={!canParticipate||busy} onClick={()=>action('bid',{increment:0})}>Teklif ver</button>:[5,10,25].map(increment=><button key={increment} disabled={!canParticipate||busy} onClick={()=>action('bid',{increment})}>+{increment}M</button>)}<button disabled={!canParticipate||busy} onClick={()=>action('pass')}>Pas</button></div>{isHost&&<div className="host-controls"><span>KURUCU KONTROLLERİ</span>{auctionOpen?<button disabled={busy} onClick={()=>action('close')}>Teklifleri kapat</button>:game.leader!==null&&<><button className="host-primary" disabled={busy} onClick={()=>action('sell')}>Satışı bitir</button><button disabled={busy} onClick={()=>action('reopen')}>Yeniden aç</button></>}<button disabled={busy||!auctionOpen} onClick={()=>action('pause')}>{game.paused?'Devam ettir':'Duraklat'}</button></div>}</div>}</div></div><aside><p className="eyebrow">CANLI AKIŞ</p>{game.feed.map((item,index)=><p className="online-feed" key={`${item}-${index}`}>{item}</p>)}</aside></section>:null}
    {selected&&<ManagerDrawer manager={selected} onClose={()=>setSelectedManager(null)}/>}</main>;
}

function OnlineResults({managers}:{managers:Manager[]}){const ranked=useMemo(()=>rankManagers(managers),[managers]);return <section className="online-results"><p className="eyebrow">ODA SONUCU</p><h1>{ranked[0]?.name} kazandı</h1><div>{ranked.map((manager,index)=><article key={manager.id}><span>#{index+1}</span><h2>{manager.name}</h2><strong>{manager.score.toFixed(2)}</strong><p>Ortalama {manager.avg} · Kalan {money(manager.budget)} · Kadro {Object.keys(manager.squad).length}/11</p></article>)}</div><p>Bu sonuç odada 7 gün boyunca saklanır.</p></section>}
