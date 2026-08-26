export type Era = 'current' | 'legends';
export type QualityMode = 'best' | 'all';
export type RatingTier = 'Süperstar'|'Elit'|'Çok iyi'|'İyi'|'Ortalama'|'Standart';
export type Slot = 'GK'|'RB'|'CB1'|'CB2'|'LB'|'DM'|'CM'|'AM'|'RW'|'LW'|'ST';
export type BenchSlot='BGK'|'BDEF'|'BMID'|'BFWD';
export type Footballer = { id:string; name:string; slot:Slot; role:string; rating:number; price:number; nation:string; club?:string; image?:string; clubLogo?:string; benchSlot?:BenchSlot };
export type CoachSpecialty='attack'|'defense'|'balance'|'development'|'motivation';
export type Coach={kind:'coach';id:string;name:string;slot:'COACH';role:'Teknik Direktör';rating:number;price:number;nation:string;tactics:number;motivation:number;adaptability:number;development:number;preferredFormation:string;specialty:CoachSpecialty;image?:string};
export type AuctionLot=Footballer|Coach;
export type Manager = { id:number; name:string; budget:number; squad:Partial<Record<Slot,Footballer>>; spent:number; bench?:Partial<Record<BenchSlot,Footballer>>; coach?:Coach };
export type PoolSourceEntry = { id:number; name:string; country:string; club:string; rating:number; price:number; value:number; image?:string; clubLogo?:string };
export type ScoreBreakdown = Manager & {score:number;avg:number;defense:number;midfield:number;attack:number;weakest:number;balance:number;completion:number;budgetEfficiency:number;coachBoost:number;coachFit:number};
export type ForcedAssignment={managerId:number;managerName:string;player:Footballer;fee:number};
export type ResultInsights={winner:string;runnerUp:string;match:{scoreLine:string;summary:string}};

export const SLOT_KEYS:Slot[]=['GK','RB','CB1','CB2','LB','DM','CM','AM','RW','LW','ST'];
export const BENCH_SLOTS:{key:BenchSlot;label:string;short:string;sourceSlots:Slot[]}[]=[
 {key:'BGK',label:'Yedek Kaleci',short:'Y-KL',sourceSlots:['GK']},
 {key:'BDEF',label:'Yedek Defans',short:'Y-DEF',sourceSlots:['RB','CB1','CB2','LB']},
 {key:'BMID',label:'Yedek Orta Saha',short:'Y-ORT',sourceSlots:['DM','CM','AM']},
 {key:'BFWD',label:'Yedek Forvet',short:'Y-FV',sourceSlots:['RW','LW','ST']}
];
export const RATING_TIERS:RatingTier[]=['Süperstar','Elit','Çok iyi','İyi','Ortalama','Standart'];
export function ratingLevel(r:number):RatingTier{return r>=93?'Süperstar':r>=90?'Elit':r>=86?'Çok iyi':r>=82?'İyi':r>=77?'Ortalama':'Standart'}

export function hashSeed(text:string){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
export function seededRandom(seed:number){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export function shuffleSeeded<T>(input:T[],random:()=>number){const out=[...input];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
export function preferFresh<T extends {id:string}>(candidates:T[],excluded:Set<string>,needed:number,random:()=>number){const fresh=shuffleSeeded(candidates.filter(x=>!excluded.has(x.id)),random),repeats=shuffleSeeded(candidates.filter(x=>excluded.has(x.id)),random);return [...fresh,...repeats].slice(0,needed)}
export function mixedAuctionLots<T extends {id:string}>(candidates:T[],excluded:Set<string>,needed:number,random:()=>number){return shuffleSeeded(preferFresh(candidates,excluded,needed,random),random)}
export function randomSlotOrder<T>(slots:T[],random:()=>number){return shuffleSeeded(slots,random)}
export function positionAuctionLots<T extends {id:string;rating:number}>(candidates:T[],excluded:Set<string>,needed:number,random:()=>number,clusterChance=.3,spread=2.5){let pool=candidates;if(candidates.length>=needed&&random()<clusterChance){const anchor=candidates[Math.floor(random()*candidates.length)]?.rating,nearby=candidates.filter(candidate=>Math.abs(candidate.rating-anchor)<=spread);if(nearby.length>=needed)pool=nearby}return mixedAuctionLots(pool,excluded,needed,random)}
export function isCoach(lot:AuctionLot):lot is Coach{return lot.slot==='COACH'}

export function affordableLimit(m:Manager){const playerReserve=Math.max(0,10-Object.keys(m.squad).length)*5,benchReserve=m.bench?Math.max(0,4-Object.keys(m.bench).length)*5:0,coachReserve=m.coach?0:5;return m.budget-playerReserve-benchReserve-coachReserve}
export function canPlaceBid(m:Manager,lot:Footballer,offer:number,managerIndex:number,passed:number[]=[]){return !lotFilled(m,lot)&&!passed.includes(managerIndex)&&offer>=5&&offer<=affordableLimit(m)}
export function openingPrice(lot:Footballer,managers:Manager[]){const limits=managers.filter(m=>!m.squad[lot.slot]).map(affordableLimit);return Math.max(5,Math.min(lot.price,Math.max(5,...limits)))}
export function passIsSafe(pool:Footballer[],index:number,managers:Manager[]){const lot=pool[index];if(!lot)return false;return pool.slice(index).filter(p=>p.slot===lot.slot).length>managers.filter(m=>!m.squad[lot.slot]).length}
export function auctionLimit(m:Manager,lot:AuctionLot){if(isCoach(lot))return m.budget;if(!lot.benchSlot)return affordableLimit(m);const starterReserve=Math.max(0,11-Object.keys(m.squad).length)*5,benchReserve=Math.max(0,3-Object.keys(m.bench||{}).length)*5,coachReserve=m.coach?0:5;return m.budget-starterReserve-benchReserve-coachReserve}
export function lotFilled(m:Manager,lot:AuctionLot){return isCoach(lot)?Boolean(m.coach):lot.benchSlot?Boolean(m.bench?.[lot.benchSlot]):Boolean(m.squad[lot.slot])}
export function canPlaceLotBid(m:Manager,lot:AuctionLot,offer:number,managerIndex:number,passed:number[]=[]){return !lotFilled(m,lot)&&!passed.includes(managerIndex)&&offer>=5&&offer<=auctionLimit(m,lot)}
export function auctionOpeningPrice(lot:AuctionLot,managers:Manager[]){const limits=managers.filter(m=>!lotFilled(m,lot)).map(m=>auctionLimit(m,lot));return Math.max(5,Math.min(lot.price,Math.max(5,...limits)))}
export function auctionPassIsSafe(pool:AuctionLot[],index:number,managers:Manager[]){const lot=pool[index];if(!lot)return false;const key=auctionGroupKey(lot);return pool.slice(index).filter(p=>auctionGroupKey(p)===key).length>managers.filter(m=>!lotFilled(m,lot)).length}
export function calculateStartingBudget(pool:Footballer[],quality:QualityMode){if(quality==='best')return 1000;const expected=SLOT_KEYS.reduce((sum,slot)=>{const c=pool.filter(x=>x.slot===slot);return sum+c.reduce((n,x)=>n+x.price,0)/Math.max(1,c.length)},0);return Math.min(900,Math.max(300,Math.ceil(expected*1.18/10)*10))}

export function fillMissingSlot(managers:Manager[],slot:Slot,candidates:PoolSourceEntry[],role:string,seed:string,excludedNames:Iterable<string>=[]){
 const random=seededRandom(hashSeed(`${seed}-${slot}`)),used=new Set([...excludedNames,...managers.flatMap(m=>Object.values(m.squad).map(p=>p?.name||''))]);
 const lowPool=shuffleSeeded([...candidates].sort((a,b)=>a.rating-b.rating||a.value-b.value).slice(0,Math.max(24,managers.length*4)),random);
 const assignments:ForcedAssignment[]=[];let cursor=0;
 const next=managers.map(manager=>{if(manager.squad[slot])return manager;let source=lowPool.find((candidate,index)=>index>=cursor&&!used.has(candidate.name));if(!source)source=lowPool.find(candidate=>!used.has(candidate.name))||lowPool[cursor%Math.max(1,lowPool.length)];cursor++;
  const rating=62+Math.floor(random()*6),fee=Math.min(5,Math.max(0,manager.budget));
  const player:Footballer={id:`fallback-${source?.id||hashSeed(`${seed}-${manager.id}`)}-${slot}-${manager.id}`,name:source?.name||`Rastgele ${role}`,slot,role:`${role} · Standart altı`,rating,price:5,nation:(source?.country||'Bilinmiyor').slice(0,3).toUpperCase(),club:source?.club||'Serbest oyuncu',image:source?.image,clubLogo:source?.clubLogo};
  used.add(player.name);assignments.push({managerId:manager.id,managerName:manager.name,player,fee});return{...manager,budget:manager.budget-fee,spent:manager.spent+fee,squad:{...manager.squad,[slot]:player}}});
 return{managers:next,assignments};
}

export function fillMissingBenchSlot(managers:Manager[],benchSlot:BenchSlot,candidates:Array<PoolSourceEntry&{slot?:Slot}>,role:string,seed:string,excludedNames:Iterable<string>=[]){
 const random=seededRandom(hashSeed(`${seed}-${benchSlot}`)),used=new Set([...excludedNames,...managers.flatMap(m=>[...Object.values(m.squad),...Object.values(m.bench||{})].map(p=>p?.name||''))]);
 const lowPool=shuffleSeeded([...candidates].sort((a,b)=>a.rating-b.rating||a.value-b.value).slice(0,Math.max(24,managers.length*4)),random);
 const assignments:ForcedAssignment[]=[];let cursor=0;
 const next=managers.map(manager=>{if(manager.bench?.[benchSlot])return manager;let source=lowPool.find((candidate,index)=>index>=cursor&&!used.has(candidate.name));if(!source)source=lowPool.find(candidate=>!used.has(candidate.name))||lowPool[cursor%Math.max(1,lowPool.length)];cursor++;
  const rating=62+Math.floor(random()*6),fee=Math.min(5,Math.max(0,manager.budget)),slot=source?.slot||BENCH_SLOTS.find(item=>item.key===benchSlot)?.sourceSlots[0]||'GK';
  const player:Footballer={id:`fallback-${source?.id||hashSeed(`${seed}-${manager.id}`)}-${benchSlot}-${manager.id}`,name:source?.name||`Rastgele ${role}`,slot,benchSlot,role:`${role} · Standart altı`,rating,price:5,nation:(source?.country||'Bilinmiyor').slice(0,3).toUpperCase(),club:source?.club||'Serbest oyuncu',image:source?.image,clubLogo:source?.clubLogo};
  used.add(player.name);assignments.push({managerId:manager.id,managerName:manager.name,player,fee});return{...manager,budget:manager.budget-fee,spent:manager.spent+fee,bench:{...(manager.bench||{}),[benchSlot]:player}}});
 return{managers:next,assignments};
}

export function auctionGroupKey(lot:AuctionLot){return isCoach(lot)?'COACH':lot.benchSlot||lot.slot}
export function isBonusPlayerLot(pool:AuctionLot[],index:number,managerCount:number){const lot=pool[index];if(!lot||isCoach(lot))return false;const key=auctionGroupKey(lot),ordinal=pool.slice(0,index+1).filter(item=>auctionGroupKey(item)===key).length;return ordinal>managerCount}
export function auctionProgressLabel(pool:AuctionLot[],index:number){const lot=pool[index];if(!lot)return'';const key=auctionGroupKey(lot),ordinal=pool.slice(0,index+1).filter(item=>auctionGroupKey(item)===key).length;if(isCoach(lot))return`Teknik direktör için ${ordinal}. aday: ${lot.name}`;const label=lot.benchSlot?BENCH_SLOTS.find(item=>item.key===lot.benchSlot)?.label:lot.role;return`${label||lot.role} pozisyonu için ${ordinal}. oyuncu: ${lot.name}`}

export function coachImpact(m:Manager,defense:number,midfield:number,attack:number){
 const c=m.coach;if(!c)return{coachBoost:0,coachFit:0};
 const sector=c.specialty==='attack'?attack:c.specialty==='defense'?defense:c.specialty==='development'?Math.min(defense,midfield,attack):((defense+midfield+attack)/3);
 const formationFit=c.preferredFormation==='4-2-3-1'?100:Math.min(100,72+c.adaptability*.28);
 const fit=c.tactics*.3+c.motivation*.18+c.adaptability*.18+c.development*.1+formationFit*.14+sector*.1;
 const boost=Math.max(0,Math.min(6,(fit-72)*.18));
 return{coachBoost:Math.round(boost*10)/10,coachFit:Math.round(fit*10)/10};
}

export function scoreManager(m:Manager):ScoreBreakdown{
 const squad=Object.values(m.squad) as Footballer[];const r=(s:Slot)=>m.squad[s]?.rating||0;
 const avg=squad.length?squad.reduce((a,p)=>a+p.rating,0)/squad.length:0;
 const defense=(r('GK')+r('RB')+r('CB1')+r('CB2')+r('LB'))/5,midfield=(r('DM')+r('CM')+r('AM'))/3,attack=(r('RW')+r('LW')+r('ST'))/3;
 const weakest=squad.length?Math.min(...squad.map(p=>p.rating)):0,strongest=squad.length?Math.max(...squad.map(p=>p.rating)):0;
 const balance=Math.max(0,100-(strongest-weakest)*2.25),completion=squad.length/11*100,budgetEfficiency=Math.min(100,m.budget/2.5);
 const raw=avg*.46+defense*.13+midfield*.13+attack*.13+weakest*.06+balance*.035+completion*.045+budgetEfficiency*.0015;
 const {coachBoost,coachFit}=coachImpact(m,defense,midfield,attack);
 const one=(n:number)=>Math.round(n*10)/10;
 return {...m,score:Math.round((raw+coachBoost)*100)/100,avg:one(avg),defense:one(defense),midfield:one(midfield),attack:one(attack),weakest:one(weakest),balance:one(balance),completion:one(completion),budgetEfficiency:one(budgetEfficiency),coachBoost,coachFit};
}
export function rankManagers(ms:Manager[]){return ms.map(scoreManager).sort((a,b)=>b.score-a.score||b.avg-a.avg||b.budget-a.budget)}
export function resultInsights(ranked:ScoreBreakdown[]):ResultInsights{
 const first=ranked[0],second=ranked[1];if(!first)return{winner:'Sonuç üretilemedi.',runnerUp:'',match:{scoreLine:'—',summary:'Karşılaştırma için en az iki takım gerekir.'}};
 const sector=(team:ScoreBreakdown,mode:'best'|'weak')=>{const sectors=[['savunma',team.defense],['orta saha',team.midfield],['hücum',team.attack]] as const;return [...sectors].sort((a,b)=>mode==='best'?b[1]-a[1]:a[1]-b[1])[0]};
 const firstBest=sector(first,'best'),coachText=first.coach?`${first.coach.name} yönetimindeki ${first.coachBoost.toFixed(1)} puanlık teknik direktör katkısı`:'teknik direktör katkısı olmadan kurduğu kadro dengesi';
 const winner=`${first.name}, ${first.score.toFixed(2)} takım puanıyla birinci oldu. ${firstBest[0][0].toUpperCase()+firstBest[0].slice(1)} hattındaki ${firstBest[1].toFixed(1)} ortalama ve ${coachText} onu listenin tepesine taşıdı.`;
 if(!second)return{winner,runnerUp:'İkinci takım bulunmuyor.',match:{scoreLine:'—',summary:'Karşılaştırma için en az iki takım gerekir.'}};
 const secondBest=sector(second,'best'),secondWeak=sector(second,'weak'),gap=Math.max(0,first.score-second.score);
 const runnerUp=`${second.name}, ${second.score.toFixed(2)} puanla ikinci sırayı aldı; en güçlü bölgesi ${secondBest[1].toFixed(1)} ortalamalı ${secondBest[0]} hattı oldu. ${secondWeak[0][0].toUpperCase()+secondWeak[0].slice(1)} seviyesinin ${secondWeak[1].toFixed(1)} kalması ve liderle oluşan ${gap.toFixed(2)} puanlık fark birinciliği kaçırmasına neden oldu.`;
 const random=seededRandom(hashSeed(`${first.name}-${second.name}-${first.score}-${second.score}`)),firstEdge=(first.attack-second.defense)*.08+(first.midfield-second.midfield)*.04+gap*.18;
 let firstGoals=Math.max(1,Math.min(5,Math.round(1.45+firstEdge*.12+random()*1.5)));const secondGoals=Math.max(0,Math.min(4,Math.round(1.05-firstEdge*.04+random()*1.25)));if(firstGoals<=secondGoals)firstGoals=Math.min(5,secondGoals+1);
 const scoreLine=`${first.name} ${firstGoals}–${secondGoals} ${second.name}`,summary=`Tahmini maçta ${first.name}, ${first.attack.toFixed(1)} hücum gücüyle ${second.name} savunmasına karşı öne çıkıyor. ${second.name} güçlü ${secondBest[0]} hattıyla denge kurabilir; bu skor kadro puanları ve hat eşleşmelerinden üretilmiş bir oyun tahminidir.`;
 return{winner,runnerUp,match:{scoreLine,summary}};
}
export function safeCsvCell(value:unknown){const s=String(value??'');const neutral=/^[=+@\-]/.test(s)?`'${s}`:s;return `"${neutral.replaceAll('"','""')}"`}
export function validManagerNames(names:string[]){const clean=names.map(n=>n.trim());return clean.every(n=>n.length>0&&n.length<=24)&&new Set(clean.map(n=>n.toLocaleLowerCase('tr'))).size===clean.length}

