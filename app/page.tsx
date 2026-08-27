'use client';
/* Remote Transfermarkt images are optional enhancements; CSS fallbacks remain visible when they fail. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from 'react';
import {auctionGroupKey,auctionLimit,auctionOpeningPrice,auctionPassIsSafe,auctionProgressLabel,BENCH_SLOTS,calculateStartingBudget,canPlaceLotBid,fillMissingBenchSlot,fillMissingCoaches,fillMissingSlot,hashSeed,isBonusPlayerLot,isCoach,lotFilled,mixedAuctionLots,positionAuctionLots,randomSlotOrder,rankManagers,ratingLevel,RATING_TIERS,resultInsights,safeCsvCell,seededRandom,shuffleSeeded,validManagerNames,type AuctionLot,type BenchSlot,type Era,type Footballer,type ForcedAssignment,type Manager,type PoolSourceEntry,type QualityMode,type RatingTier,type Slot} from '../lib/game-engine';
import {COACHES} from '../lib/coaches';
import {OnlineGame} from './online/page';

type Stage = 'setup' | 'names' | 'auction' | 'results';
type BonusReveal={name:string;rating:number;role:string;image?:string};
type GameSnapshot = { managers:Manager[];pool:AuctionLot[];index:number;bid:number;leader:number|null;feed:string[];passed:number[];activeTurn:number|null;era:Era;quality:QualityMode;revealRatings:boolean;selectedTiers:RatingTier[];includeBench:boolean;count:number;names:string[];bonusReveal?:BonusReveal;autoAssignments?:ForcedAssignment[] };
type PoolSource = Partial<Record<Era,Record<Slot,PoolSourceEntry[]>>>;
type SavedGame = GameSnapshot&{version:2;gameId:string;paused:boolean;soundOn:boolean;remainingMs:number;undoSnapshot:GameSnapshot|null};

const SLOTS: {key:Slot; label:string; short:string}[] = [
  {key:'GK',label:'Kaleci',short:'KL'},{key:'RB',label:'Sağ Bek',short:'SB'},{key:'CB1',label:'Stoper',short:'STP'},{key:'CB2',label:'Stoper',short:'STP'},{key:'LB',label:'Sol Bek',short:'SLB'},
  {key:'DM',label:'Savunmacı Merkez Orta Saha',short:'SMOS'},{key:'CM',label:'İki Yönlü Merkez Orta Saha',short:'MO'},{key:'AM',label:'Ofansif Orta Saha',short:'OOS'},
  {key:'RW',label:'Sağ Açık',short:'SA'},{key:'LW',label:'Sol Açık',short:'SLA'},{key:'ST',label:'Forvet',short:'FV'}
];

const POOLS: Record<Era,Record<Slot,string[]>> = {
  current: {
    GK:['Alisson','G. Donnarumma','Thibaut Courtois','Ederson','David Raya','Mike Maignan','Jan Oblak','Diogo Costa'],
    RB:['Achraf Hakimi','Trent Alexander-Arnold','Jules Koundé','Jeremie Frimpong','Pedro Porro','Dani Carvajal','Ben White','Diogo Dalot'],
    CB1:['Virgil van Dijk','William Saliba','Rúben Dias','Antonio Rüdiger','Alessandro Bastoni','Gabriel Magalhães','Ronald Araújo','Pau Cubarsí'],
    CB2:['Ibrahima Konaté','Marquinhos','Bremer','Jonathan Tah','Kim Min-jae','Cristian Romero','Joško Gvardiol','Leny Yoro'],
    LB:['Nuno Mendes','Theo Hernández','Alphonso Davies','Federico Dimarco','Alejandro Balde','Milos Kerkez','Marc Cucurella','Destiny Udogie'],
    DM:['Rodri','Declan Rice','Moisés Caicedo','Aurélien Tchouaméni','Joshua Kimmich','Martín Zubimendi','João Neves','Sandro Tonali'],
    CM:['Jude Bellingham','Federico Valverde','Pedri','Vitinha','Frenkie de Jong','Nicolò Barella','Alexis Mac Allister','Bruno Guimarães'],
    AM:['Florian Wirtz','Jamal Musiala','Cole Palmer','Martin Ødegaard','Bruno Fernandes','Dani Olmo','Xavi Simons','Morgan Rogers'],
    RW:['Lamine Yamal','Mohamed Salah','Bukayo Saka','Rodrygo','Michael Olise','Khvicha Kvaratskhelia','Takefusa Kubo','Raphinha'],
    LW:['Vinícius Júnior','Kylian Mbappé','Luis Díaz','Rafael Leão','Nico Williams','Bradley Barcola','Cody Gakpo','Anthony Gordon'],
    ST:['Erling Haaland','Harry Kane','Lautaro Martínez','Alexander Isak','Victor Osimhen','Julián Álvarez','Viktor Gyökeres','Benjamin Šeško']
  },
  legends: {
    GK:['Gianluigi Buffon','Iker Casillas','Manuel Neuer','Peter Schmeichel','Petr Čech','Edwin van der Sar','Oliver Kahn','Dida'],
    RB:['Cafu','Dani Alves','Philipp Lahm','Javier Zanetti','Lilian Thuram','Maicon','Gary Neville','João Cancelo'],
    CB1:['Paolo Maldini','Franz Beckenbauer','Sergio Ramos','Fabio Cannavaro','Carles Puyol','Alessandro Nesta','Rio Ferdinand','Nemanja Vidić'],
    CB2:['Franco Baresi','John Terry','Jaap Stam','Thiago Silva','Giorgio Chiellini','Lúcio','Raphaël Varane','Vincent Kompany'],
    LB:['Roberto Carlos','Marcelo','Ashley Cole','Patrice Evra','Jordi Alba','Bixente Lizarazu','Eric Abidal','Filipe Luís'],
    DM:['Claude Makélélé','Sergio Busquets','Patrick Vieira','Roy Keane','Casemiro','N’Golo Kanté','Javier Mascherano','Michael Essien'],
    CM:['Xavi','Andrés Iniesta','Luka Modrić','Andrea Pirlo','Steven Gerrard','Frank Lampard','Paul Scholes','Clarence Seedorf'],
    AM:['Zinedine Zidane','Kaká','Ronaldinho','Dennis Bergkamp','Juan Román Riquelme','Mesut Özil','Wesley Sneijder','David Silva'],
    RW:['Lionel Messi','Arjen Robben','Luís Figo','David Beckham','Mohamed Salah','Garrincha','Riyad Mahrez','Ángel Di María'],
    LW:['Cristiano Ronaldo','Thierry Henry','Neymar','Ryan Giggs','Franck Ribéry','Eden Hazard','Ronaldinho','Gareth Bale'],
    ST:['Ronaldo Nazário','Marco van Basten','Robert Lewandowski','Luis Suárez','Karim Benzema','Didier Drogba','Samuel Eto’o','Andriy Shevchenko']
  }
};

const NATIONS = ['🇧🇷','🇫🇷','🇪🇸','🇩🇪','🇮🇹','🇦🇷','🇵🇹','🇳🇱'];
const DEFAULT_MANAGER_NAMES = ['Yasin','Yakup','Mehmet','Burak','Haktan','Emirhan','Muhammet','Menajer 8'];
const FORMATION_POSITIONS: Record<Slot,{left:string;top:string}> = {
  GK:{left:'50%',top:'89%'}, RB:{left:'84%',top:'70%'}, CB1:{left:'62%',top:'75%'}, CB2:{left:'38%',top:'75%'}, LB:{left:'16%',top:'70%'},
  DM:{left:'36%',top:'55%'}, CM:{left:'64%',top:'55%'}, AM:{left:'50%',top:'30%'}, RW:{left:'82%',top:'30%'}, LW:{left:'18%',top:'30%'}, ST:{left:'50%',top:'10%'}
};
const money = (n:number) => `$${n}M`;
function buildPool(generated:PoolSource,era:Era,count:number,quality:QualityMode,selectedTiers:RatingTier[],includeBench:boolean,gameId:string,excluded:Set<string>):AuctionLot[] {
  const random=seededRandom(hashSeed(gameId));
  const footballers=randomSlotOrder(SLOTS,random).flatMap((s,slotIndex) => {
    const source=generated[era]?.[s.key]||[],selected=source.filter(p=>selectedTiers.includes(ratingLevel(p.rating) as RatingTier)),candidates=selected;
    if(candidates.length){
      const needed=count+1;
      const mapped=candidates.map(p=>({id:`tm-${p.id}-${s.key}`,name:p.name,slot:s.key,role:s.label,rating:p.rating,price:p.price,nation:p.country.slice(0,3).toUpperCase(),club:p.club,image:p.image,clubLogo:p.clubLogo} satisfies Footballer));
      const window=quality==='best'?mapped.slice(0,Math.max(96,needed*10)):mapped;
      return positionAuctionLots(window,excluded,needed,random,s.key==='ST'?.72:.3,s.key==='ST'?3:2.5);
    }
    const fallback=shuffleSeeded(POOLS[era][s.key],random).map((name,i)=>({id:`${era}-${s.key}-${name}`,name,slot:s.key,role:s.label,rating:Math.max(78,(era==='legends'?96:93)-i-((slotIndex+i)%3)),price:Math.max(20,(era==='legends'?100:85)-i*8+(slotIndex%4)*3),nation:NATIONS[(slotIndex+i)%NATIONS.length]} satisfies Footballer));
    return positionAuctionLots(fallback,excluded,count+1,random,s.key==='ST'?.72:.3,s.key==='ST'?3:2.5);
  });
  const starterNames=new Set(footballers.map(player=>player.name));
  const bench=includeBench?randomSlotOrder(BENCH_SLOTS,random).flatMap(group=>{
    const candidates=group.sourceSlots.flatMap(slot=>(generated[era]?.[slot]||[]).filter(p=>selectedTiers.includes(ratingLevel(p.rating) as RatingTier)).map(p=>({id:`tm-${p.id}-${group.key}`,name:p.name,slot,benchSlot:group.key,role:group.label,rating:p.rating,price:p.price,nation:p.country.slice(0,3).toUpperCase(),club:p.club,image:p.image,clubLogo:p.clubLogo} satisfies Footballer))).filter(player=>!starterNames.has(player.name)).sort((a,b)=>b.rating-a.rating);
    const window=quality==='best'?candidates.slice(0,Math.max(160,(count+1)*14)):candidates;
    return positionAuctionLots(window,excluded,count+1,random,.45,3);
  }):[];
  return[...footballers,...bench,...mixedAuctionLots(COACHES,excluded,count+2,random)];
}

export default function Home(){
  const [mode,setMode]=useState<'choose'|'local'|'online'>('choose');
  useEffect(()=>{const id=setTimeout(()=>{const params=new URLSearchParams(location.search);if(params.get('mode')==='online'||params.has('room'))setMode('online');else if(params.get('mode')==='local')setMode('local')},0);return()=>clearTimeout(id)},[]);
  const showOnline=()=>{history.replaceState(null,'','/?mode=online');setMode('online')};
  const showLocal=()=>{history.replaceState(null,'','/?mode=local');setMode('local')};
  const showHome=()=>{history.replaceState(null,'','/');setMode('choose')};
  return mode==='choose'?<ModeChooser onLocal={showLocal} onOnline={showOnline}/>:mode==='online'?<OnlineGame/>:<LocalGame onHome={showHome}/>;
}

function ModeChooser({onLocal,onOnline}:{onLocal:()=>void;onOnline:()=>void}){
  return <main className="mode-home"><nav><Brand/><span>ÜCRETSİZ · KAYIT GEREKTİRMEZ</span></nav><section className="home-hero"><div className="home-copy"><p className="eyebrow">CANLI FUTBOL AÇIK ARTIRMASI</p><h1>Bütçeni yönet.<br/><em>Rüya kadronu kur.</em><br/>Masayı kazan.</h1><p>Dünyanın yıldızlarını açık artırmada kap. Arkadaşlarınla veya ücretsiz AI rakiplerle yarış; ilk 11&apos;ini, yedeklerini ve teknik direktörünü kur.</p><div className="home-proof"><span>2–8 menajer</span><span>Ücretsiz AI rakipler</span><span>Telefon &amp; tablet uyumlu</span></div><div className="home-steps" aria-label="Nasıl oynanır"><div><b>01</b><span>Odanı kur</span></div><i/><div><b>02</b><span>Teklif ver</span></div><i/><div><b>03</b><span>Kadronu yarıştır</span></div></div></div><div className="mode-cards"><button className="featured" onClick={onOnline}><span>ÖNERİLEN · CANLI</span><h2>Arkadaşlarla online</h2><p>Oda kodunu paylaş; herkes kendi telefonundan teklif versin. İstersen AI menajerlerle masayı doldur.</p><b>Oda oluştur veya katıl <i>→</i></b></button><button onClick={onLocal}><span>AYNI EKRANDA</span><h2>Tek cihazda oyna</h2><p>Aynı cihazı sırayla kullanın. Hızlı kurulum, otomatik kayıt ve tüm açık artırma özellikleri.</p><b>Yerel oyunu kur <i>→</i></b></button></div></section><footer className="home-footer">Kadro İhalesi · Her oyun yeni bir transfer hikâyesi</footer></main>;
}

function Brand({onClick}:{onClick?:()=>void}){const content=<><img src="/brand-mark.svg" alt=""/><div><b>KADRO İHALESİ</b><small>FUTBOL AÇIK ARTIRMA OYUNU</small></div></>;return onClick?<button className="brand-lockup brand-home" onClick={onClick} aria-label="Kadro İhalesi ana sayfasına dön">{content}</button>:<div className="brand-lockup">{content}</div>}

function LocalGame({onHome}:{onHome:()=>void}) {
  const [stage,setStage] = useState<Stage>('setup');
  const [count,setCount] = useState(3);
  const [era,setEra] = useState<Era>('current');
  const [quality,setQuality] = useState<QualityMode>('all');
  const [revealRatings,setRevealRatings] = useState(false);
  const [selectedTiers,setSelectedTiers] = useState<RatingTier[]>(RATING_TIERS);
  const [includeBench,setIncludeBench] = useState(false);
  const [names,setNames] = useState<string[]>(DEFAULT_MANAGER_NAMES.slice(0,3));
  const [managers,setManagers] = useState<Manager[]>([]);
  const [pool,setPool] = useState<AuctionLot[]>([]);
  const [index,setIndex] = useState(0);
  const [bid,setBid] = useState(0);
  const [leader,setLeader] = useState<number|null>(null);
  const [feed,setFeed] = useState<string[]>([]);
  const [activeTurn,setActiveTurn] = useState<number|null>(null);
  const [passed,setPassed] = useState<number[]>([]);
  const [paused,setPaused] = useState(false);
  const [timeLeft,setTimeLeft] = useState(20);
  const [selectedManager,setSelectedManager] = useState<number|null>(null);
  const [undoSnapshot,setUndoSnapshot] = useState<GameSnapshot|null>(null);
  const [hasSaved,setHasSaved] = useState(false);
  const [soundOn,setSoundOn] = useState(true);
  const [saleFlash,setSaleFlash] = useState('');
  const [bonusReveal,setBonusReveal]=useState<BonusReveal|undefined>();
  const [autoAssignments,setAutoAssignments]=useState<ForcedAssignment[]>([]);
  const [poolSource,setPoolSource] = useState<PoolSource|null>(null);
  const [poolLoading,setPoolLoading] = useState(false);
  const [poolError,setPoolError] = useState('');
  const [gameId,setGameId] = useState('');
  const [deadline,setDeadline] = useState<number|null>(null);
  const audioRef=useRef<AudioContext|null>(null);
  const timeoutActionRef=useRef<()=>void>(()=>{});
  const current = pool[index];
  const auctionGroups=useMemo(()=>{const seen=new Set<string>();return pool.filter((lot):lot is Footballer=>!isCoach(lot)).flatMap(lot=>{const key=auctionGroupKey(lot);if(seen.has(key))return[];seen.add(key);const bench=lot.benchSlot&&BENCH_SLOTS.find(item=>item.key===lot.benchSlot),starter=SLOTS.find(item=>item.key===lot.slot);return[{key,label:bench?.label||starter?.label||lot.role}]})},[pool]);
  const currentSlotOrder=current&&!isCoach(current)?auctionGroups.findIndex(item=>item.key===auctionGroupKey(current)):-1;
  const bonusLot=isBonusPlayerLot(pool,index,managers.length);
  const nextGroupLabel=bonusLot?(auctionGroups[currentSlotOrder+1]?.label||'teknik direktör açık artırması'):'';

  useEffect(()=>{const id=setTimeout(()=>setHasSaved(Boolean(localStorage.getItem('bidxi-game'))),0);return()=>clearTimeout(id)},[]);
  useEffect(()=>{performance.mark('bidxi-ready');const record=(kind:string,value:unknown)=>{try{const old=JSON.parse(localStorage.getItem('bidxi-errors')||'[]') as unknown[];localStorage.setItem('bidxi-errors',JSON.stringify([{at:new Date().toISOString(),kind,value:String(value)},...old].slice(0,20)))}catch{}};const error=(e:ErrorEvent)=>record('error',e.message);const rejection=(e:PromiseRejectionEvent)=>record('promise',e.reason);window.addEventListener('error',error);window.addEventListener('unhandledrejection',rejection);return()=>{window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',rejection)}},[]);
  useEffect(()=>{
    if(stage!=='auction'||!current) return;
    const snapshot:SavedGame={version:2,gameId,managers,pool,index,bid,leader,feed,passed,activeTurn,era,quality,revealRatings,selectedTiers,includeBench,count,names,paused,soundOn,remainingMs:deadline?Math.max(0,deadline-Date.now()):20000,undoSnapshot,bonusReveal,autoAssignments};
    localStorage.setItem('bidxi-game',JSON.stringify(snapshot));
  },[stage,managers,pool,index,bid,leader,feed,passed,activeTurn,era,quality,revealRatings,selectedTiers,includeBench,count,names,current,paused,soundOn,deadline,gameId,undoSnapshot,bonusReveal,autoAssignments]);
  useEffect(()=>{
    if(stage!=='auction'||paused||activeTurn===null||deadline===null) return;
    const tick=()=>{const remaining=Math.max(0,deadline-Date.now());setTimeLeft(Math.ceil(remaining/1000));if(remaining===0){setDeadline(null);timeoutActionRef.current()}};
    tick();const timer=setInterval(tick,250);
    return()=>clearInterval(timer);
  },[stage,paused,activeTurn,deadline]);
  useEffect(()=>()=>{void audioRef.current?.close()},[]);
  const openingPrice = current ? auctionOpeningPrice(current,managers) : 5;
  const visibleBid = leader === null ? openingPrice : bid;
  const canBid = (m:Manager,offer:number) => Boolean(current&&leader!==m.id&&canPlaceLotBid(m,current,offer,m.id,passed));
  const remainingForSlot = current ? pool.slice(index).filter(p=>auctionGroupKey(p)===auctionGroupKey(current)).length : 0;
  const passIsSafe = auctionPassIsSafe(pool,index,managers);
  timeoutActionRef.current=passTurn;
  const resetClock=()=>{setTimeLeft(20);setDeadline(Date.now()+20000)};

  function tone(kind:'bid'|'sold'){
    if(!soundOn||typeof window==='undefined')return;
    const AudioCtx=window.AudioContext||(window as typeof window&{webkitAudioContext:typeof AudioContext}).webkitAudioContext;
    const ctx=audioRef.current??new AudioCtx();audioRef.current=ctx;const osc=ctx.createOscillator(),gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.frequency.value=kind==='sold'?180:520;gain.gain.setValueAtTime(.05,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.16);osc.start();osc.stop(ctx.currentTime+.16);
  }
  function nextEligible(after:number,offer:number,newPassed=passed,newLeader=leader,ms=managers,lot=current){
    if(!lot)return null;
    for(let step=1;step<=ms.length;step++){const id=(after+step)%ms.length,m=ms[id];if(id!==newLeader&&canPlaceLotBid(m,lot,offer,id,newPassed))return id}
    return null;
  }
  const fallbackFeed=(assignments:ForcedAssignment[])=>assignments.map(item=>`${item.managerName}, ${item.player.benchSlot?BENCH_SLOTS.find(group=>group.key===item.player.benchSlot)?.label:SLOTS.find(slot=>slot.key===item.player.slot)?.label} yuvasını boş bıraktığı için ${item.player.name} standart altı oyuncu olarak ${money(item.fee)} karşılığında otomatik atandı.`);
  function fallbackCandidates(slot:Slot){if(poolSource?.[era]?.[slot]?.length)return poolSource[era][slot];return pool.filter((lot):lot is Footballer=>!isCoach(lot)&&lot.slot===slot).map((lot,i)=>({id:i+1,name:lot.name,country:lot.nation,club:lot.club||'',rating:lot.rating,price:lot.price,value:lot.price*1000000,image:lot.image,clubLogo:lot.clubLogo}))}
  function benchFallbackCandidates(benchSlot:BenchSlot){const group=BENCH_SLOTS.find(item=>item.key===benchSlot);return(group?.sourceSlots||[]).flatMap(slot=>(poolSource?.[era]?.[slot]||[]).map(player=>({...player,slot})))}
  function completeLeavingSlot(ms:Manager[],lot:AuctionLot,nextIndex:number){if(isCoach(lot)||(nextIndex<pool.length&&auctionGroupKey(pool[nextIndex])===auctionGroupKey(lot)))return{managers:ms,assignments:[] as ForcedAssignment[]};if(lot.benchSlot){const group=BENCH_SLOTS.find(item=>item.key===lot.benchSlot);return fillMissingBenchSlot(ms,lot.benchSlot,benchFallbackCandidates(lot.benchSlot),group?.label||lot.benchSlot,`${gameId}-${index}`,pool.map(item=>item.name))}const info=SLOTS.find(item=>item.key===lot.slot);return fillMissingSlot(ms,lot.slot,fallbackCandidates(lot.slot),info?.label||lot.slot,`${gameId}-${index}`,pool.map(item=>item.name))}
  function finishGame(ms:Manager[]){let completed=ms;const assignments:ForcedAssignment[]=[];for(const info of SLOTS){const result=fillMissingSlot(completed,info.key,fallbackCandidates(info.key),info.label,`${gameId}-final-${info.key}`,pool.map(item=>item.name));completed=result.managers;assignments.push(...result.assignments)}if(includeBench)for(const group of BENCH_SLOTS){const result=fillMissingBenchSlot(completed,group.key,benchFallbackCandidates(group.key),group.label,`${gameId}-final-${group.key}`,pool.map(item=>item.name));completed=result.managers;assignments.push(...result.assignments)}const coachResult=fillMissingCoaches(completed,COACHES,`${gameId}-final`);completed=coachResult.managers;setManagers(completed);const coachNotes=coachResult.assignments.map(item=>`${item.managerName}, teknik direktör seçmediği için ${item.coach.name} $${item.fee}M karşılığında otomatik atandı.`);if(assignments.length||coachNotes.length)setFeed(f=>[...coachNotes,...fallbackFeed(assignments),...f].slice(0,8));localStorage.removeItem('bidxi-game');setStage('results')}

  async function goNames(){setPoolLoading(true);setPoolError('');try{if(!poolSource?.[era]){const response=await fetch(`/api/pool?era=${era}`);if(!response.ok)throw new Error('Havuz yüklenemedi');const loaded=await response.json() as Record<Slot,PoolSourceEntry[]>;setPoolSource(old=>({...old,[era]:loaded}))}setStage('names')}catch{setPoolError('Oyuncu havuzu yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.')}finally{setPoolLoading(false)}}
  function begin(){
    if(!poolSource)return;if(!validManagerNames(names)){window.alert('Menajer adları boş, aynı veya 24 karakterden uzun olamaz.');return}const newGameId=`${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
    let history:string[][]=[];try{history=JSON.parse(localStorage.getItem('bidxi-recent-pools')||'[]') as string[][]}catch{}const p = buildPool(poolSource,era,count,quality,selectedTiers,includeBench,newGameId,new Set(history.flat()));
    localStorage.setItem('bidxi-recent-pools',JSON.stringify([p.map(lot=>lot.id),...history].slice(0,8)));
    const startingBudget=calculateStartingBudget(p.filter((lot):lot is Footballer=>!isCoach(lot)&&!lot.benchSlot),quality)+(includeBench?250:0);
    const ms = names.map((name,i)=>({id:i,name:name.trim()||`Menajer ${i+1}`,budget:startingBudget,spent:0,squad:{},...(includeBench?{bench:{}}:{})}));
    setGameId(newGameId);setManagers(ms);setPool(p);setIndex(0);setBid(0);setLeader(null);setFeed([`Oyun ${newGameId}: ${p.length} lot · ${includeBench?'11 oyuncu + 4 yedek':'11 oyuncu'} sonrası teknik direktör açık artırması · kişi başı ${money(startingBudget)}.`]);setPassed([]);setActiveTurn(0);resetClock();setPaused(false);setUndoSnapshot(null);setBonusReveal(undefined);setAutoAssignments([]);setHasSaved(true);setStage('auction');
  }
  function placeBid(inc:number){
    if(activeTurn===null||paused)return;
    const id=activeTurn;
    const m = managers[id];
    const next = leader === null ? openingPrice : bid+inc;
    if(!canBid(m,next)) return;
    tone('bid');setBid(next);setLeader(id);setFeed(f=>[`${m.name}, ${money(next)} teklif verdi.`,...f].slice(0,6));resetClock();
    setActiveTurn(nextEligible(id,next+5,passed,id));
  }
  function passTurn(){
    if(activeTurn===null||paused)return;
    const id=activeTurn,nextPassed=[...passed,id];setPassed(nextPassed);setFeed(f=>[`${managers[id].name} pas geçti.`,...f].slice(0,6));resetClock();
    const next=nextEligible(id,(leader===null?openingPrice:bid+5),nextPassed,leader);
    if(next===null){setTimeout(()=>leader===null?skipLot():sell(),0);return}
    setActiveTurn(next);
  }
  function skipLot(){
    const nextIndex=index+1,completion=completeLeavingSlot(managers,current,nextIndex),updated=completion.managers;setManagers(updated);setAutoAssignments(completion.assignments);setFeed(f=>[...fallbackFeed(completion.assignments),`${current.name} için teklif çıkmadı.`,...f].slice(0,8));
    if(nextIndex>=pool.length){finishGame(updated);return}
    const nextPlayer=pool[nextIndex];
    if(updated.every(m=>lotFilled(m,nextPlayer))){setIndex(nextIndex);setTimeout(()=>skipFilledLots(nextIndex,updated),0);return}
    setBonusReveal(undefined);const nextOpening=auctionOpeningPrice(nextPlayer,updated);setIndex(nextIndex);setBid(0);setLeader(null);setPassed([]);resetClock();setActiveTurn(updated.find(m=>canPlaceLotBid(m,nextPlayer,nextOpening,m.id))?.id??null);
  }
  function skipFilledLots(from:number,ms=managers){
    let next=from;const skipped:Footballer[]=[];while(next<pool.length&&ms.every(m=>lotFilled(m,pool[next]))){if(!isCoach(pool[next])&&isBonusPlayerLot(pool,next,ms.length))skipped.push(pool[next] as Footballer);next++}const missed=skipped.at(-1);setBonusReveal(missed?{name:missed.name,rating:missed.rating,role:missed.role,image:missed.image}:undefined);
    if(next>=pool.length){finishGame(ms);return}
    const nextPlayer=pool[next],nextOpening=auctionOpeningPrice(nextPlayer,ms);setIndex(next);setBid(0);setLeader(null);setPassed([]);resetClock();setActiveTurn(ms.find(m=>canPlaceLotBid(m,nextPlayer,nextOpening,m.id))?.id??null);
  }
  function sell(){
    if(leader === null) return;
    const winner = managers[leader];
    setUndoSnapshot({managers,pool,index,bid,leader,feed,passed,activeTurn,era,quality,revealRatings,selectedTiers,includeBench,count,names,bonusReveal,autoAssignments});
    let updated=managers.map(m=>m.id===leader?(isCoach(current)?{...m,budget:m.budget-bid,spent:m.spent+bid,coach:current}:current.benchSlot?{...m,budget:m.budget-bid,spent:m.spent+bid,bench:{...(m.bench||{}),[current.benchSlot]:current}}:{...m,budget:m.budget-bid,spent:m.spent+bid,squad:{...m.squad,[current.slot]:current}}):m);
    const message=`${current.name}, ${winner.name} takımına ${money(bid)} karşılığında katıldı.`;tone('sold');setSaleFlash(`${current.name} → ${winner.name}`);setTimeout(()=>setSaleFlash(''),1100);
    let nextIndex=index+1;const skipped:Footballer[]=[];while(nextIndex<pool.length&&updated.every(m=>lotFilled(m,pool[nextIndex]))){if(!isCoach(pool[nextIndex])&&isBonusPlayerLot(pool,nextIndex,updated.length))skipped.push(pool[nextIndex] as Footballer);nextIndex++}const missed=skipped.at(-1);setBonusReveal(missed?{name:missed.name,rating:missed.rating,role:missed.role,image:missed.image}:undefined);const completion=completeLeavingSlot(updated,current,nextIndex);updated=completion.managers;setManagers(updated);setAutoAssignments(completion.assignments);setFeed(f=>[...fallbackFeed(completion.assignments),message,...f].slice(0,8));
    if(nextIndex>=pool.length){finishGame(updated);return}
    const nextPlayer=pool[nextIndex];
    const nextLimits=updated.filter(m=>!lotFilled(m,nextPlayer)).map(m=>auctionLimit(m,nextPlayer));
    const nextOpening=Math.max(5,Math.min(nextPlayer.price,Math.max(5,...nextLimits)));
    setIndex(nextIndex);setBid(0);setLeader(null);setPassed([]);resetClock();setActiveTurn(updated.find(m=>canPlaceLotBid(m,nextPlayer,nextOpening,m.id))?.id??null);
  }
  function undoSale(){if(!undoSnapshot)return;const s=undoSnapshot;setManagers(s.managers);setPool(s.pool);setIndex(s.index);setBid(s.bid);setLeader(s.leader);setFeed(s.feed);setPassed(s.passed);setActiveTurn(s.activeTurn);setEra(s.era);setQuality(s.quality||'best');setRevealRatings(s.revealRatings||false);setSelectedTiers(s.selectedTiers||RATING_TIERS);setIncludeBench(Boolean(s.includeBench));setCount(s.count);setNames(s.names);setBonusReveal(s.bonusReveal);setAutoAssignments(s.autoAssignments||[]);setUndoSnapshot(null);setStage('auction')}
  async function resume(){const raw=localStorage.getItem('bidxi-game');if(!raw)return;try{const s=JSON.parse(raw) as SavedGame;if(s.version!==2||!Array.isArray(s.managers)||!Array.isArray(s.pool)||s.index<0||s.index>=s.pool.length)throw new Error('Geçersiz kayıt');if(!poolSource?.[s.era]){const response=await fetch(`/api/pool?era=${s.era}`);if(!response.ok)throw new Error('Havuz yüklenemedi');const loaded=await response.json() as Record<Slot,PoolSourceEntry[]>;setPoolSource(old=>({...old,[s.era]:loaded}))}setManagers(s.managers);setPool(s.pool);setIndex(s.index);setBid(s.bid);setLeader(s.leader);setFeed(s.feed);setPassed(s.passed||[]);setActiveTurn(s.activeTurn);setEra(s.era);setQuality(s.quality);setRevealRatings(s.revealRatings);setSelectedTiers(s.selectedTiers);setIncludeBench(Boolean(s.includeBench));setCount(s.count);setNames(s.names);setBonusReveal(s.bonusReveal);setAutoAssignments(s.autoAssignments||[]);setGameId(s.gameId);setPaused(s.paused);setSoundOn(s.soundOn);setUndoSnapshot(s.undoSnapshot);setTimeLeft(Math.max(1,Math.ceil(s.remainingMs/1000)));setDeadline(s.paused?null:Date.now()+s.remainingMs);setStage('auction')}catch{localStorage.removeItem('bidxi-game');setHasSaved(false)}}
  function reset(){if(managers.length&&typeof window!=='undefined'&&!window.confirm('Mevcut oyun silinecek. Yeni oyun kurulsun mu?'))return;localStorage.removeItem('bidxi-game');setHasSaved(false);setStage('setup');setManagers([]);setPool([]);setIndex(0);setBid(0);setLeader(null);setDeadline(null);setBonusReveal(undefined);setAutoAssignments([]);setSelectedManager(null)}
  function togglePause(){setPaused(p=>{if(p)setDeadline(Date.now()+timeLeft*1000);else setDeadline(null);return !p})}
  function changeCount(n:number){setCount(n);setNames(old=>Array.from({length:n},(_,i)=>old[i]||DEFAULT_MANAGER_NAMES[i]||`Menajer ${i+1}`))}
  function goHome(){if((stage==='auction'||stage==='results')&&!window.confirm('Oyundan çıkıp ana sayfaya dönmek istediğinize emin misiniz?'))return;if(stage==='auction'||stage==='results'){localStorage.removeItem('bidxi-game');setHasSaved(false)}onHome()}

  if(stage==='setup') return <Shell onHome={goHome}><Setup count={count} setCount={changeCount} era={era} setEra={setEra} setQuality={setQuality} revealRatings={revealRatings} setRevealRatings={setRevealRatings} selectedTiers={selectedTiers} setSelectedTiers={setSelectedTiers} includeBench={includeBench} setIncludeBench={setIncludeBench} onNext={goNames} hasSaved={hasSaved} onResume={resume} loading={poolLoading} loadError={poolError}/></Shell>;
  if(stage==='names'&&poolSource) return <Shell onHome={goHome}><Names source={poolSource} names={names} setNames={setNames} era={era} revealRatings={revealRatings} selectedTiers={selectedTiers} includeBench={includeBench} onBack={()=>setStage('setup')} onBegin={begin}/></Shell>;
  if(stage==='results') return <Shell onHome={goHome}><Results managers={managers} onReset={reset}/></Shell>;
  return <Shell compact onHome={goHome}>
    {saleFlash&&<div className="sale-flash" role="status" aria-live="polite">✓ {saleFlash}</div>}
    <div className="auction-grid mx-auto max-w-7xl py-5">
      <aside className="order-2 lg:order-1">
        <p className="eyebrow">MASA DURUMU</p><h2 className="mb-5 mt-2 text-xl font-bold">Menajerler</h2>
        <div className="space-y-2">{managers.map(m=><button key={m.id} onClick={()=>setSelectedManager(m.id)} className={`manager ${leader===m.id?'leading':''} ${activeTurn===m.id?'turn':''}`}><span className="avatar">{m.name.slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1 text-left"><b className="block truncate">{m.name}</b><small>{Object.keys(m.squad).length}/11 oyuncu {m.bench?`· ${Object.keys(m.bench).length}/4 yedek`:''} {m.coach?'· TD ✓':''} {passed.includes(m.id)?'· PAS':''}</small></span><strong>{money(m.budget)}</strong></button>)}</div>
        <p className="mt-4 text-xs leading-5 text-zinc-600">Menajere dokunarak kadrosunu aç. Yeşil çerçeve teklif sırasını gösterir.</p>
      </aside>
      <section className="order-1 lg:order-2">
        <div className="auction-toolbar mb-4 flex items-center justify-between"><div className="flex gap-2"><span className="pill">{isCoach(current)?'TEKNİK DİREKTÖR':`LOT ${index+1}/${pool.length}`}</span><button className="tool-btn" aria-pressed={paused} onClick={togglePause}>{paused?'▶ Devam':'Ⅱ Duraklat'}</button><button className="tool-btn" aria-pressed={!soundOn} onClick={()=>setSoundOn(s=>!s)}>{soundOn?'♪ Ses':'× Sessiz'}</button>{undoSnapshot&&<button className="tool-btn" onClick={undoSale}>↶ Geri al</button>}</div><span className="text-xs text-zinc-500">{era==='current'?'Güncel':'Son 30 yıl'} · {gameId}</span></div>
        {bonusReveal&&<div className="missed-bonus-card">{bonusReveal.image?<img src={bonusReveal.image} alt=""/>:<span>?</span>}<div><b>KAÇAN BONUS</b><p>Eğer bonus açılsaydı <strong>{bonusReveal.name}</strong> oyuncusu gelecekti.</p><small>{bonusReveal.role} · Puanı: <strong>{bonusReveal.rating.toFixed(1)}</strong></small></div></div>}{autoAssignments.map(item=><div className="auto-assignment-card" key={`${item.managerId}-${item.player.id}`}><span>✓</span><div><b>EKSİK POZİSYON TAMAMLANDI</b><p><strong>{item.managerName}</strong> kadrosuna <strong>{item.player.name}</strong> otomatik atandı.</p><small>{item.player.role} · {money(item.fee)} bütçeden düşüldü</small></div></div>)}<p className="lot-progress-note">{auctionProgressLabel(pool,index)}</p>
        {bonusLot&&<div className="bonus-lot-alert"><b>⚠ BONUS OYUNCU</b><span>Bu pozisyonun son açık artırması. Ardından {nextGroupLabel} başlayacak.</span></div>}
        <div className={`player-card ${bonusLot?'bonus-lot-card':''}`}>
          <div className="pitch-lines"/><div className="player-top"><span className="position">{isCoach(current)?'TD':current.benchSlot?BENCH_SLOTS.find(group=>group.key===current.benchSlot)?.short:SLOTS.find(s=>s.key===current.slot)?.short}</span><div className="flex items-center gap-3">{(revealRatings||isCoach(current))&&<span className="rating-badge"><b>{current.rating.toFixed(1)}</b><small>{isCoach(current)?'TEKNİK DİREKTÖR':ratingLevel(current.rating)}</small></span>}<span className="nation">{current.nation}</span></div></div>
          {current.image&&<img className="player-photo" src={current.image} alt={`${current.name} fotoğrafı`} width="320" height="420" decoding="async" onError={e=>e.currentTarget.remove()}/>}
          {isCoach(current)?<div className="formation-map coach-profile"><p><b>Taktik</b><span>{current.tactics}</span></p><p><b>Motivasyon</b><span>{current.motivation}</span></p><p><b>Uyum</b><span>{current.adaptability}</span></p><p><b>Gelişim</b><span>{current.development}</span></p><strong>Tercih: {current.preferredFormation}</strong></div>:<FormationMap active={current.slot}/>}
          <div className="relative"><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-lime-300">{current.role}</p><h1 className="text-4xl font-black tracking-tight sm:text-5xl">{current.name}</h1>{isCoach(current)?<div className="mt-3 text-sm text-zinc-400">{current.preferredFormation} · {current.specialty==='attack'?'Hücum':current.specialty==='defense'?'Savunma':current.specialty==='development'?'Oyuncu gelişimi':current.specialty==='motivation'?'Motivasyon':'Dengeli'} uzmanı</div>:<div className="mt-3 flex items-center gap-2 text-sm text-zinc-400">{current.clubLogo&&<img className="club-logo" src={current.clubLogo} alt="" onError={e=>e.currentTarget.remove()}/>}<span>{current.club||'Kulüp bilgisi yok'} · {revealRatings?`${current.rating.toFixed(1)}/100 · ${ratingLevel(current.rating)}`:'Seviye gizli'}</span></div>}</div>
        </div>
        <div className="bid-panel">
          <div aria-live="polite"><p className="text-xs uppercase tracking-widest text-zinc-500">{leader===null?'Açılış fiyatı':'Mevcut teklif'}</p><p className="mt-1 text-4xl font-black text-lime-300">{money(visibleBid)}</p><p className="mt-1 text-sm text-zinc-400">{leader===null?'İlk teklif bu tutardan başlar':`Lider: ${managers[leader].name}`}</p></div>
          <div className="turn-controls"><div className="turn-label"><span>{paused?'DURAKLATILDI':activeTurn===null?'TEKLİFLER BİTTİ':`SIRA: ${managers[activeTurn].name}`}</span><b>{activeTurn===null?'—':`${timeLeft}s`}</b></div><div className="flex flex-wrap gap-2">{leader===null?<button disabled={activeTurn===null||paused||!canBid(managers[activeTurn],openingPrice)} onClick={()=>placeBid(0)} className="increment primary">{money(openingPrice)} teklif ver</button>:[5,10,25].map(n=><button key={n} disabled={activeTurn===null||paused||!canBid(managers[activeTurn],bid+n)} onClick={()=>placeBid(n)} className="increment">+{n}M</button>)}<button disabled={activeTurn===null||paused} onClick={passTurn} className="pass">Pas</button><button disabled={leader===null||activeTurn!==null||paused} onClick={sell} className="sell">Satışı Bitir</button></div>{leader===null&&<p className="pass-hint">{isCoach(current)?'Teknik direktör adayını pas geçebilirsin.':passIsSafe?`Bu pozisyonda ${remainingForSlot} normal aday kaldı.`:'Bu son normal aday da geçilirse eksik pozisyona 5M karşılığında standart altı oyuncu atanır.'}</p>}</div>
        </div>
      </section>
      <aside className="order-3"><p className="eyebrow">4-2-3-1 PLANI</p><h2 className="mb-5 mt-2 text-xl font-bold">Karışık açık artırma sırası</h2><div className="slot-list">{auctionGroups.map((group,i)=><div key={group.key} className={`${!isCoach(current)&&i===currentSlotOrder?'now':''} ${isCoach(current)||i<currentSlotOrder?'done':''}`}><span>{i+1}</span><p>{group.label}</p></div>)}<div className={isCoach(current)?'now':''}><span>{auctionGroups.length+1}</span><p>Teknik direktör</p></div></div>{feed.length>0&&<div className="feed">{feed.map((f,i)=><p key={i}>{f}</p>)}</div>}</aside>
    </div>
    {selectedManager!==null&&<SquadDrawer manager={managers[selectedManager]} onClose={()=>setSelectedManager(null)}/>} 
  </Shell>;
}

function FormationMap({active}:{active:Slot}){
  return <div className="formation-map" aria-label={`4-2-3-1 dizilişinde seçili pozisyon: ${SLOTS.find(s=>s.key===active)?.label}`}>
    <div className="formation-box top-box"/><div className="formation-box bottom-box"/><div className="halfway"/><div className="center-circle"/>
    {SLOTS.map(s=><div key={s.key} title={s.label} className={`formation-dot ${s.key===active?'active':''}`} style={FORMATION_POSITIONS[s.key]}><span>{s.short}</span></div>)}
  </div>;
}

function SquadDrawer({manager,onClose}:{manager:Manager;onClose:()=>void}){
  const closeRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{closeRef.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)},[onClose]);
  return <div className="drawer-backdrop" onClick={onClose}><aside role="dialog" aria-modal="true" aria-labelledby="squad-title" className="squad-drawer" onClick={e=>e.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">CANLI KADRO</p><h2 id="squad-title">{manager.name}</h2><span>{Object.keys(manager.squad).length}/11 oyuncu {manager.bench?`· ${Object.keys(manager.bench).length}/4 yedek`:''} · {money(manager.budget)} kaldı</span></div><button ref={closeRef} onClick={onClose} aria-label="Kadro önizlemesini kapat">×</button></div><ResultFormation squad={manager.squad}/><div className="mini-squad drawer-list">{SLOTS.map(s=><div key={s.key}><span>{s.short}</span><p>{manager.squad[s.key]?.name||'Henüz alınmadı'}</p><b>{manager.squad[s.key]?'✓':'—'}</b></div>)}{manager.bench&&BENCH_SLOTS.map(group=><div className="bench-row" key={group.key}><span>{group.short}</span><p>{manager.bench?.[group.key]?.name||'Henüz alınmadı'}</p><b>{manager.bench?.[group.key]?.rating||'—'}</b></div>)}<div className="coach-row"><span>TD</span><p>{manager.coach?.name||'Henüz alınmadı'}</p><b>{manager.coach?.rating||'—'}</b></div></div>{manager.coach&&<p className="coach-summary">{manager.coach.preferredFormation} · Taktik {manager.coach.tactics} · Motivasyon {manager.coach.motivation} · Uyum {manager.coach.adaptability}</p>}</aside></div>;
}

function Shell({children,onHome}:{children:React.ReactNode;compact?:boolean;onHome:()=>void}){
  return <main className="site-shell min-h-screen px-5 py-6 md:px-10 md:py-8"><nav className="mx-auto flex max-w-7xl items-center justify-between"><Brand onClick={onHome}/><span className="mode-label">Tek cihaz</span></nav>{children}</main>
}

function Setup({count,setCount,era,setEra,setQuality,revealRatings,setRevealRatings,selectedTiers,setSelectedTiers,includeBench,setIncludeBench,onNext,hasSaved,onResume,loading,loadError}:{count:number;setCount:(n:number)=>void;era:Era;setEra:(e:Era)=>void;setQuality:(q:QualityMode)=>void;revealRatings:boolean;setRevealRatings:(v:boolean)=>void;selectedTiers:RatingTier[];setSelectedTiers:(v:RatingTier[])=>void;includeBench:boolean;setIncludeBench:(v:boolean)=>void;onNext:()=>void;hasSaved:boolean;onResume:()=>void;loading:boolean;loadError:string}){
  const choose=(e:Era)=>{setEra(e);setQuality('all')};
  const toggleTier=(tier:RatingTier)=>setSelectedTiers(selectedTiers.includes(tier)?(selectedTiers.length===1?selectedTiers:selectedTiers.filter(t=>t!==tier)):[...selectedTiers,tier]);
  return <section className="setup-layout mx-auto grid min-h-[calc(100vh-110px)] max-w-7xl items-center gap-12 py-12 lg:grid-cols-[1.05fr_.95fr]">
    <div><p className="eyebrow mb-5">KADRONU KUR. BÜTÇENİ KORU. MASAYI KAZAN.</p><h1 className="hero">Bütçeni yönet,<br/><span className="text-lime-300">kusursuz kadronu</span> kur.</h1><p className="mt-7 max-w-xl leading-7 text-zinc-400">Futbolcular sırayla açıklanır. 4-2-3-1 kadronu dilersen dört yedekle tamamlar, kalan bütçenle teknik direktörünü açık artırmada seçersin.</p><div className="mt-8 flex flex-wrap gap-5 text-sm text-zinc-300"><span>● Her oyunda tazelenen havuz</span><span>● 100 üzerinden puan</span><span>● Teknik direktör etkisi</span></div></div>
    <div className="panel setup-panel rounded-[28px] p-6 sm:p-8">
      <div className="mb-7 flex items-start justify-between"><div><p className="eyebrow">YENİ MASA</p><h2 className="mt-2 text-2xl font-bold">Oyunu hazırla</h2></div><span className="text-3xl">⚽</span></div>
      {hasSaved&&<button onClick={onResume} className="resume-game"><b>Devam eden oyun bulundu</b><span>Kaldığın lota dön →</span></button>}
      <label className="label">Kaç menajer oynayacak?</label><div className="grid grid-cols-4 gap-2">{[2,3,4,5,6,7,8].map(n=><button aria-pressed={count===n} key={n} onClick={()=>setCount(n)} className={`choice ${count===n?'active':''}`}>{n}</button>)}</div>
      <label className="label mt-7">Futbolcu dönemi</label><div className="grid gap-3 sm:grid-cols-2"><button onClick={()=>choose('current')} className={`era ${era==='current'?'active':''}`}><strong>Güncel</strong><span>Bugünün aktif futbolcuları</span></button><button onClick={()=>choose('legends')} className={`era ${era==='legends'?'active':''}`}><strong>Son 30 Yıl</strong><span>Son 30 yılın prime dönem oyuncuları</span></button></div>
      <label className="label mt-7">Havuza dahil edilecek seviyeler</label><div className="tier-picker">{RATING_TIERS.map(t=><button key={t} onClick={()=>toggleTier(t)} className={selectedTiers.includes(t)?'active':''}><span>{selectedTiers.includes(t)?'✓':'+'}</span>{t}</button>)}</div><div className="tier-tools"><button onClick={()=>setSelectedTiers(RATING_TIERS)}>Tümünü seç</button><span>{selectedTiers.length}/6 seviye seçili</span></div>
      <label className="label mt-7">Oyuncu yetenekleri</label><div className="grid grid-cols-2 gap-3"><button onClick={()=>setRevealRatings(true)} className={`ability-choice ${revealRatings?'active':''}`}><strong>Göster</strong><span>Puan ve seviye açık</span></button><button onClick={()=>setRevealRatings(false)} className={`ability-choice ${!revealRatings?'active':''}`}><strong>Gizle</strong><span>Sürpriz açık artırma</span></button></div>
      <label className="label mt-7">Yedek oyuncular</label><div className="reserve-picker"><button onClick={()=>setIncludeBench(false)} className={!includeBench?'active':''}><strong>Yedek olmasın</strong><span>11 oyuncu + teknik direktör</span></button><button onClick={()=>setIncludeBench(true)} className={includeBench?'active':''}><strong>4 yedek olsun</strong><span>1 kaleci · 1 defans · 1 orta saha · 1 forvet<br/><b>+250 milyon $ bütçe</b></span></button></div>
      <div className="mt-7 grid grid-cols-2 gap-4 border-t border-white/10 pt-5 text-sm"><span className="text-zinc-500">Pozisyon başına<br/><b className="text-white">{count+1} futbolcu</b></span><span className="text-right text-zinc-500">Menajer bütçesi<br/><b className="text-white">{`Havuza göre${includeBench?' + $250M':''}`}</b></span></div>
      <button disabled={loading} aria-busy={loading} onClick={onNext} className="start mt-5 w-full">{loading?'Oyuncu havuzu yükleniyor…':'Menajerleri belirle'} <span>{loading?'':'→'}</span></button>{loadError&&<p className="load-error" role="alert">{loadError}</p>}<p className="source-note">Oyuncu verileri: transfermarkt-datasets (CC0). Kadro İhalesi puanları piyasa değeri ve kariyer verilerinden türetilir.</p>
    </div>
  </section>;
}

function Names({source,names,setNames,era,revealRatings,selectedTiers,includeBench,onBack,onBegin}:{source:PoolSource;names:string[];setNames:(v:string[])=>void;era:Era;revealRatings:boolean;selectedTiers:RatingTier[];includeBench:boolean;onBack:()=>void;onBegin:()=>void}){
  const [query,setQuery]=useState('');
  const [slot,setSlot]=useState<Slot|'all'>('all');
  const namesValid=validManagerNames(names);
  const matches=useMemo(()=>{const seen=new Set<number>();return Object.entries(source[era]||{}).flatMap(([key,list])=>(slot==='all'||slot===key)?list.map(p=>({...p,slot:key as Slot})):[]).filter(p=>{if(seen.has(p.id)||!selectedTiers.includes(ratingLevel(p.rating)))return false;seen.add(p.id);const q=query.toLocaleLowerCase('tr');return q.length>1&&`${p.name} ${p.club} ${p.country}`.toLocaleLowerCase('tr').includes(q)}).slice(0,6)},[query,slot,era,source,selectedTiers]);
  return <section className="mx-auto max-w-3xl py-14">
    <button className="back" onClick={onBack}>← Geri</button>
    <div className="panel rounded-[28px] p-6 sm:p-10">
      <p className="eyebrow">MASA KURULUMU · 02</p><h1 className="mt-3 text-4xl font-black">Menajerler kim?</h1>
      <p className="mt-3 text-zinc-400">Başlangıç bütçesi kişi başı $1 milyardır; dört yedek seçildiyse $250M eklenir. Pozisyon sırası her yeni oyunda rastgele belirlenir.</p>
      <div className="my-8 grid gap-3 sm:grid-cols-2">{names.map((n,i)=><label key={i} className="name-field"><span>{i+1}</span><input maxLength={24} aria-invalid={!n.trim()||names.some((x,j)=>j!==i&&x.trim().toLocaleLowerCase('tr')===n.trim().toLocaleLowerCase('tr'))} aria-label={`${i+1}. menajer`} value={n} onChange={e=>setNames(names.map((x,j)=>j===i?e.target.value:x))}/></label>)}</div>
      {!namesValid&&<p className="form-error" role="alert">Adlar boş veya aynı olamaz; en fazla 24 karakter kullanın.</p>}
      <details className="pool-browser"><summary>Havuzu incele ve filtrele</summary><div className="pool-search"><input placeholder="Futbolcu, kulüp veya ülke ara" value={query} onChange={e=>setQuery(e.target.value)}/><select value={slot} onChange={e=>setSlot(e.target.value as Slot|'all')}><option value="all">Tüm pozisyonlar</option>{SLOTS.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select></div>{matches.length>0&&<div className="search-results">{matches.map(p=><div key={p.id}>{p.image?<img src={p.image} alt={`${p.name} fotoğrafı`} width="44" height="52" loading="lazy" decoding="async" onError={e=>e.currentTarget.remove()}/>:<span className="image-fallback">?</span>}<span><b>{p.name}</b><small>{p.club||'Kulüp bilinmiyor'} · {p.country||'Ülke bilinmiyor'}</small></span><em>{SLOTS.find(s=>s.key===p.slot)?.short}</em></div>)}</div>}<p>Arama yalnızca havuzu incelemek içindir; seçilen görünürlük kuralı açık artırmada uygulanır.</p></details>
      <div className="rule-box"><b>{era==='current'?'Güncel':'Son 30 yıl'}</b><span> · {selectedTiers.join(', ')} · puanlar {revealRatings?'görünür':'gizli'} · {includeBench?'11 oyuncu + 4 yedek (+$250M)':'11 oyuncu'} · pozisyon başına {names.length+1} aday</span></div>
      <button disabled={!namesValid} onClick={onBegin} className="start mt-6 w-full">Açık artırmayı başlat <span>→</span></button>
    </div>
  </section>;
}

function Results({managers,onReset}:{managers:Manager[];onReset:()=>void}){
  const [formationViews,setFormationViews] = useState<Record<number,boolean>>({});
  const ranked = useMemo(()=>rankManagers(managers),[managers]);
  const insights = useMemo(()=>resultInsights(ranked),[ranked]);
  function exportCsv(){const lines=['Sıra,Menajer,Puan,Pozisyon,Futbolcu veya TD,Puan,Kalan Bütçe'];ranked.forEach((m,i)=>{SLOTS.forEach(s=>lines.push([i+1,safeCsvCell(m.name),m.score.toFixed(2),s.short,safeCsvCell(m.squad[s.key]?.name||''),m.squad[s.key]?.rating||'',m.budget].join(',')));if(m.bench)BENCH_SLOTS.forEach(group=>lines.push([i+1,safeCsvCell(m.name),m.score.toFixed(2),group.short,safeCsvCell(m.bench?.[group.key]?.name||''),m.bench?.[group.key]?.rating||'',m.budget].join(',')));lines.push([i+1,safeCsvCell(m.name),m.score.toFixed(2),'TD',safeCsvCell(m.coach?.name||''),m.coach?.rating||'',m.budget].join(','))});const url=URL.createObjectURL(new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='bid-xi-sonuclari.csv';a.click();URL.revokeObjectURL(url)}
  async function share(){const text=`Kadro İhalesi sonucu: ${ranked.map((m,i)=>`${i+1}. ${m.name} (${m.score.toFixed(2)})`).join(' · ')} · Maç tahmini: ${insights.match.scoreLine}`;try{if(navigator.share)await navigator.share({title:'Kadro İhalesi Sonuçları',text});else await navigator.clipboard.writeText(text)}catch(error){if((error as DOMException).name!=='AbortError')window.alert('Sonuç paylaşılamadı. Tarayıcı izinlerini kontrol edin.')}}
  return <section className="mx-auto max-w-6xl py-12">
    <div className="text-center"><p className="eyebrow">İHALE TAMAMLANDI</p><h1 className="mt-3 text-5xl font-black">Gecenin şampiyonu</h1><p className="mt-3 text-zinc-400">Kadro gücü, denge, bütçe verimliliği ve teknik direktör uyumuna göre.</p></div>
    {ranked[0]&&<div className="winner"><span className="crown">♛</span><p>1. SIRA</p><h2>{ranked[0].name}</h2><strong>{ranked[0].score.toFixed(2)}</strong><small>TAKIM PUANI</small></div>}
    {ranked[1]&&<section className="result-analysis"><div><p className="eyebrow">SIRALAMA ANALİZİ</p><h2>Neden birinci ve ikinci oldular?</h2><p>{insights.winner}</p><p>{insights.runnerUp}</p></div><aside><span>MUHTEMEL MAÇ</span><strong>{insights.match.scoreLine}</strong><p>{insights.match.summary}</p></aside></section>}
    <div className="result-grid">{ranked.map((m,i)=><article key={m.id} className="result-card"><div className="flex items-center justify-between"><span className="rank">#{i+1}</span><div className="flex items-center gap-3"><button aria-pressed={Boolean(formationViews[m.id])} className="view-toggle" onClick={()=>setFormationViews(v=>({...v,[m.id]:!v[m.id]}))}>{formationViews[m.id]?'☰ Liste':'⌄ Diziliş'}</button><span className="score">{m.score.toFixed(2)}</span></div></div><h3>{m.name}</h3><div className="stats"><span>Ort. <b>{m.avg}</b></span><span>DEF <b>{m.defense}</b></span><span>ORT <b>{m.midfield}</b></span><span>HÜC <b>{m.attack}</b></span><span>Kalan <b>{money(m.budget)}</b></span></div><div className="result-coach"><span>TD</span><p><b>{m.coach?.name||'Teknik direktör yok'}</b>{m.coach&&<small>{m.coach.preferredFormation} · +{m.coachBoost} takım puanı · %{m.coachFit} uyum</small>}</p></div><details className="score-details"><summary>Puan hesabı</summary><p>En zayıf halka <b>{m.weakest}</b> · Denge <b>{m.balance}</b> · Tamamlama <b>%{m.completion}</b> · Yedek derinliği <b>+{m.benchDepth}</b> · Bütçe verimi <b>{m.budgetEfficiency}</b> (puan etkisi en fazla 0,15) · TD katkısı <b>+{m.coachBoost}</b></p></details>{formationViews[m.id]?<ResultFormation squad={m.squad}/>:<div className="mini-squad">{SLOTS.map(s=>{const p=m.squad[s.key];return <div className={p?.id.startsWith('fallback-')?'auto-assigned':''} key={s.key}><span>{s.short}</span><p>{p?.name||'Boş'}{p?.id.startsWith('fallback-')&&<em>OTOMATİK</em>}</p><b>{p?.rating||'—'}</b></div>})}{m.bench&&BENCH_SLOTS.map(group=>{const p=m.bench?.[group.key];return <div className={`bench-row ${p?.id.startsWith('fallback-')?'auto-assigned':''}`} key={group.key}><span>{group.short}</span><p>{p?.name||'Boş'}{p?.id.startsWith('fallback-')&&<em>OTOMATİK</em>}</p><b>{p?.rating||'—'}</b></div>})}</div>}</article>)}</div>
    <div className="result-actions"><button onClick={exportCsv}>↓ CSV indir</button><button onClick={share}>↗ Sonucu paylaş</button></div><button onClick={onReset} className="start mx-auto mt-4 w-full max-w-md">Yeni oyun kur <span>↻</span></button>
  </section>;
}

function ResultFormation({squad}:{squad:Partial<Record<Slot,Footballer>>}){
  return <div className="result-formation"><div className="result-halfway"/><div className="result-center-circle"/>{SLOTS.map(s=>{const player=squad[s.key];return <div key={s.key} className="result-player" style={FORMATION_POSITIONS[s.key]}><b>{player?.rating||'—'}</b><span>{player?.name||s.short}</span></div>})}</div>;
}

