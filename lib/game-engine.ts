export type Era = 'current' | 'legends';
export type QualityMode = 'best' | 'all';
export type RatingTier = 'Süperstar'|'Elit'|'Çok iyi'|'İyi'|'Ortalama'|'Standart';
export type Formation = '4-2-3-1'|'4-3-3'|'4-1-4-1';
export type BotStyle = 'balanced'|'aggressive'|'value';
export type BotDifficulty='beginner'|'average'|'expert';
export type Slot = 'GK'|'RB'|'CB1'|'CB2'|'LB'|'DM'|'CM'|'AM'|'RW'|'LW'|'ST';
export type BenchSlot='BGK'|'BDEF'|'BMID'|'BFWD';
export type Footballer = { id:string; name:string; slot:Slot; role:string; rating:number; price:number; nation:string; club?:string; image?:string; clubLogo?:string; benchSlot?:BenchSlot };
export type CoachSpecialty='attack'|'defense'|'balance'|'development'|'motivation';
export type Coach={kind:'coach';id:string;name:string;slot:'COACH';role:'Teknik Direktör';rating:number;price:number;nation:string;tactics:number;motivation:number;adaptability:number;development:number;preferredFormation:string;specialty:CoachSpecialty;image?:string};
export type AuctionLot=Footballer|Coach;
export type Manager = { id:number; name:string; budget:number; squad:Partial<Record<Slot,Footballer>>; spent:number; bench?:Partial<Record<BenchSlot,Footballer>>; coach?:Coach; formation?:Formation; isBot?:boolean; botStyle?:BotStyle };
export type PoolSourceEntry = { id:number; name:string; country:string; club:string; rating:number; price:number; value:number; image?:string; clubLogo?:string };
export type ScoreBreakdown = Manager & {score:number;avg:number;defense:number;midfield:number;attack:number;weakest:number;balance:number;completion:number;budgetEfficiency:number;starterImpact:number;coachBoost:number;coachFit:number;benchDepth:number};
export type ForcedAssignment={managerId:number;managerName:string;player:Footballer;fee:number};
export type ResultInsights={winner:string;runnerUp:string;match:{scoreLine:string;summary:string}};
export type BotDecisionContext={difficulty?:BotDifficulty;lotIndex?:number;totalLots?:number;remainingLotsInGroup?:number;managersMissingGroup?:number};
export type AuctionEstimateInput={managerCount:number;benchEnabled?:boolean;turnSeconds?:number;transitionSeconds?:number;quickTurnSeconds?:number};
export type LeaderboardRules={era:Era;selectedTiers:RatingTier[];benchEnabled:boolean;mode?:'online'|'local'|'manual';auctionMode?:'live'|'manual';scenarioId?:string;customPool?:boolean;automationUsed?:boolean;aiManagerCount?:number;humanManagerCount?:number};

export const SLOT_KEYS:Slot[]=['GK','RB','CB1','CB2','LB','DM','CM','AM','RW','LW','ST'];
export const BENCH_SLOTS:{key:BenchSlot;label:string;short:string;sourceSlots:Slot[]}[]=[
 {key:'BGK',label:'Yedek Kaleci',short:'Y-KL',sourceSlots:['GK']},
 {key:'BDEF',label:'Yedek Defans',short:'Y-DEF',sourceSlots:['RB','CB1','CB2','LB']},
 {key:'BMID',label:'Yedek Orta Saha',short:'Y-ORT',sourceSlots:['DM','CM','AM']},
 {key:'BFWD',label:'Yedek Forvet',short:'Y-FV',sourceSlots:['RW','LW','ST']}
];
export const RATING_TIERS:RatingTier[]=['Süperstar','Elit','Çok iyi','İyi','Ortalama','Standart'];
export const FORMATIONS:Formation[]=['4-2-3-1','4-3-3','4-1-4-1'];
export const FORMATION_POSITIONS:Record<Formation,Record<Slot,{left:string;top:string}>>={
 '4-2-3-1':{GK:{left:'50%',top:'89%'},RB:{left:'84%',top:'70%'},CB1:{left:'62%',top:'75%'},CB2:{left:'38%',top:'75%'},LB:{left:'16%',top:'70%'},DM:{left:'36%',top:'55%'},CM:{left:'64%',top:'55%'},AM:{left:'50%',top:'30%'},RW:{left:'82%',top:'30%'},LW:{left:'18%',top:'30%'},ST:{left:'50%',top:'10%'}},
 '4-3-3':{GK:{left:'50%',top:'89%'},RB:{left:'84%',top:'70%'},CB1:{left:'62%',top:'75%'},CB2:{left:'38%',top:'75%'},LB:{left:'16%',top:'70%'},DM:{left:'50%',top:'58%'},CM:{left:'65%',top:'48%'},AM:{left:'35%',top:'48%'},RW:{left:'82%',top:'24%'},LW:{left:'18%',top:'24%'},ST:{left:'50%',top:'10%'}},
 '4-1-4-1':{GK:{left:'50%',top:'89%'},RB:{left:'84%',top:'70%'},CB1:{left:'62%',top:'75%'},CB2:{left:'38%',top:'75%'},LB:{left:'16%',top:'70%'},DM:{left:'50%',top:'59%'},CM:{left:'62%',top:'43%'},AM:{left:'38%',top:'43%'},RW:{left:'82%',top:'39%'},LW:{left:'18%',top:'39%'},ST:{left:'50%',top:'11%'}}
};
export function ratingLevel(r:number):RatingTier{return r>=93?'Süperstar':r>=90?'Elit':r>=86?'Çok iyi':r>=82?'İyi':r>=77?'Ortalama':'Standart'}
export function fallbackTierForSelection(selected:RatingTier[]=RATING_TIERS):RatingTier{const indexes=selected.map(tier=>RATING_TIERS.indexOf(tier)).filter(index=>index>=0),lowest=indexes.length?Math.max(...indexes):RATING_TIERS.length-1;return RATING_TIERS[Math.min(RATING_TIERS.length-1,lowest+1)]}

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
function botDifficulty(manager:Manager,context:BotDecisionContext):BotDifficulty{return context.difficulty||(manager.botStyle==='aggressive'?'expert':manager.botStyle==='value'?'beginner':'average')}
function botSector(slot:AuctionLot['slot']){return slot==='COACH'?'coach':['GK','RB','CB1','CB2','LB'].includes(slot)?'defense':['DM','CM','AM'].includes(slot)?'midfield':'attack'}
function botLineNeed(manager:Manager,lot:AuctionLot){if(isCoach(lot))return manager.coach?0:1;const sector=botSector(lot.slot),slots=sector==='defense'?(['GK','RB','CB1','CB2','LB'] as Slot[]):sector==='midfield'?(['DM','CM','AM'] as Slot[]):(['RW','LW','ST'] as Slot[]),filled=slots.map(slot=>manager.squad[slot]?.rating).filter((rating):rating is number=>typeof rating==='number');if(!filled.length)return 1;const average=filled.reduce((sum,rating)=>sum+rating,0)/filled.length;const allLines=[['GK','RB','CB1','CB2','LB'],['DM','CM','AM'],['RW','LW','ST']].map(line=>{const ratings=line.map(slot=>manager.squad[slot as Slot]?.rating).filter((rating):rating is number=>typeof rating==='number');return ratings.length?ratings.reduce((sum,rating)=>sum+rating,0)/ratings.length:0});return average<=Math.min(...allLines)+.5?1:.35}
function botTacticalFit(manager:Manager,lot:AuctionLot){if(isCoach(lot)){const formation=manager.formation||chooseBotFormation(manager);return lot.preferredFormation===formation?1:.35+lot.adaptability/200}const formation=manager.formation||chooseBotFormation(manager),favored:Record<Formation,Slot[]>= {'4-2-3-1':['DM','AM','ST'],'4-3-3':['RW','LW','ST'],'4-1-4-1':['DM','CM','RW','LW']};let fit=favored[formation].includes(lot.slot)?1:.5;const specialty=manager.coach?.specialty,sector=botSector(lot.slot);if((specialty==='attack'&&sector==='attack')||(specialty==='defense'&&sector==='defense')||(specialty==='development'&&botLineNeed(manager,lot)>=1))fit+=.25;return fit}
/** Free, deterministic AI ceiling. Hidden auctions never read lot.rating. */
export function botMaximumBid(manager:Manager,lot:AuctionLot,seed:string,revealRatings=true,context:BotDecisionContext={}){if(lotFilled(manager,lot))return 0;const limit=Math.max(0,auctionLimit(manager,lot));if(limit<5)return 0;const difficulty=botDifficulty(manager,context),random=seededRandom(hashSeed(`bot-v2-${seed}-${manager.id}-${lot.id}`)),pressure=difficulty==='expert'?1.3:difficulty==='average'?1.06:.8,visibleQuality=revealRatings?Math.max(0,lot.rating-80):0,qualityWeight=difficulty==='expert'?3.6:difficulty==='average'?2.55:1.35,remaining=Math.max(1,context.remainingLotsInGroup??4),missing=Math.max(1,context.managersMissingGroup??1),scarcity=Math.min(1.7,missing/remaining),progress=Math.max(0,Math.min(1,(context.lotIndex??0)/Math.max(1,(context.totalLots??1)-1))),need=botLineNeed(manager,lot),tactics=botTacticalFit(manager,lot),reserveRatio=Math.max(0,Math.min(1,limit/Math.max(1,manager.budget))),stageFactor=.94+progress*(difficulty==='expert'?.13:difficulty==='average'?.08:.03),utility=(Math.max(5,lot.price)*pressure+visibleQuality*qualityWeight)*(1+scarcity*.12+need*.12+tactics*.055)*stageFactor*(.9+reserveRatio*.1)*(.94+random()*.12),rounded=Math.round(utility/5)*5;return Math.max(5,Math.min(limit,rounded))}
export function chooseBotFormation(manager:Manager):Formation{const r=(slot:Slot)=>manager.squad[slot]?.rating||0;const wing=(r('RW')+r('LW'))/2,mid=(r('DM')+r('CM')+r('AM'))/3;if(mid-wing>2)return'4-1-4-1';if(wing-mid>1)return'4-3-3';return'4-2-3-1'}
export function auctionPassIsSafe(pool:AuctionLot[],index:number,managers:Manager[]){const lot=pool[index];if(!lot)return false;const key=auctionGroupKey(lot);return pool.slice(index).filter(p=>auctionGroupKey(p)===key).length>managers.filter(m=>!lotFilled(m,lot)).length}
export function calculateStartingBudget(pool:readonly AuctionLot[],quality:QualityMode){void pool;void quality;return 1000}

export function starsAndScrubsTierWeights(selectedTiers:RatingTier[]){const selected=[...new Set(selectedTiers)].filter(tier=>RATING_TIERS.includes(tier)).sort((a,b)=>RATING_TIERS.indexOf(a)-RATING_TIERS.indexOf(b));return Object.fromEntries(RATING_TIERS.map(tier=>{const index=selected.indexOf(tier);if(index<0)return[tier,0];if(selected.length<=2||index===0||index===selected.length-1)return[tier,1];return[tier,index===1||index===selected.length-2?.52:.28]})) as Record<RatingTier,number>}
/** Weighted sampling for the visible "Yıldızlar ve sürprizler" mode; never escapes selected tiers. */
export function selectStarsAndScrubs<T extends {rating:number}>(candidates:T[],selectedTiers:RatingTier[],needed:number,random:()=>number){const weights=starsAndScrubsTierWeights(selectedTiers),pool=candidates.filter(candidate=>weights[ratingLevel(candidate.rating)]>0),picked:T[]=[];while(pool.length&&picked.length<needed){const total=pool.reduce((sum,candidate)=>sum+weights[ratingLevel(candidate.rating)],0),target=random()*total;let cursor=0,index=pool.length-1;for(let i=0;i<pool.length;i++){cursor+=weights[ratingLevel(pool[i].rating)];if(target<cursor){index=i;break}}picked.push(pool.splice(index,1)[0])}return picked}

export function estimateAuctionSession(input:AuctionEstimateInput){const managers=Math.max(1,Math.floor(input.managerCount)),groups=11+(input.benchEnabled?4:0)+1,lots=groups*(managers+1),turn=Math.max(5,input.turnSeconds??25),transition=Math.max(0,input.transitionSeconds??3),quickTurn=Math.max(5,input.quickTurnSeconds??12),seconds=lots*(turn+transition),quickSeconds=lots*(quickTurn+transition);return{groups,lots,seconds,minutes:Math.ceil(seconds/60),quickSeconds,quickMinutes:Math.ceil(quickSeconds/60)}}

export function leaderboardRulesetFingerprint(rules:LeaderboardRules){const tiers=[...new Set(rules.selectedTiers)].sort((a,b)=>RATING_TIERS.indexOf(a)-RATING_TIERS.indexOf(b));const canonical=`rules-v2|${rules.era}|${tiers.join(',')}|bench:${rules.benchEnabled?1:0}|mode:${rules.mode||'online'}|auction:${rules.auctionMode||'live'}|scenario:${rules.scenarioId||'classic'}|custom:${rules.customPool?1:0}|auto:${rules.automationUsed?1:0}|ai:${Math.max(0,rules.aiManagerCount||0)}|human:${Math.max(0,rules.humanManagerCount||0)}`;return hashSeed(canonical).toString(16).padStart(8,'0')}
export function standardLeaderboardEligibility(rules:LeaderboardRules){const reasons:string[]=[];if((rules.mode||'online')!=='online'||(rules.auctionMode||'live')!=='live')reasons.push('Yalnız çevrim içi canlı standart oyunlar sıralamaya girer.');if(rules.era!=='current')reasons.push('Standart liste güncel dönem içindir.');if(!RATING_TIERS.every(tier=>rules.selectedTiers.includes(tier)))reasons.push('Standart liste altı seviyenin tamamını kullanır.');if(rules.benchEnabled)reasons.push('Yedekli oyunlar tüm modlar listesinde gösterilir.');if((rules.scenarioId||'classic')!=='classic')reasons.push('Özel senaryo kullanıldı.');if(rules.customPool)reasons.push('Özel havuz kullanıldı.');if(rules.automationUsed)reasons.push('Otomatik tamamlama kullanıldı.');if((rules.aiManagerCount||0)>0)reasons.push('AI menajer kullanıldı.');if((rules.humanManagerCount||0)<2)reasons.push('En az iki insan menajer gerekir.');return{eligible:reasons.length===0,reasons,fingerprint:leaderboardRulesetFingerprint(rules)}}

export function fillMissingSlot(managers:Manager[],slot:Slot,candidates:PoolSourceEntry[],role:string,seed:string,excludedNames:Iterable<string>=[],selectedTiers:RatingTier[]=RATING_TIERS){
 const random=seededRandom(hashSeed(`${seed}-${slot}`)),used=new Set([...excludedNames,...managers.flatMap(m=>Object.values(m.squad).map(p=>p?.name||''))]);
 const targetTier=fallbackTierForSelection(selectedTiers),tierPool=candidates.filter(candidate=>ratingLevel(candidate.rating)===targetTier),sourcePool=tierPool.length?tierPool:candidates;
 const lowPool=shuffleSeeded([...sourcePool].sort((a,b)=>a.rating-b.rating||a.value-b.value).slice(0,Math.max(24,managers.length*4)),random);
 const assignments:ForcedAssignment[]=[];let cursor=0;
 const next=managers.map(manager=>{if(manager.squad[slot])return manager;let source=lowPool.find((candidate,index)=>index>=cursor&&!used.has(candidate.name));if(!source)source=lowPool.find(candidate=>!used.has(candidate.name))||lowPool[cursor%Math.max(1,lowPool.length)];cursor++;
  const rating=source?.rating??(targetTier==='Çok iyi'?87:targetTier==='İyi'?83:targetTier==='Ortalama'?79:targetTier==='Elit'?91:targetTier==='Süperstar'?94:74),fee=Math.min(5,Math.max(0,manager.budget));
  const player:Footballer={id:`fallback-${source?.id||hashSeed(`${seed}-${manager.id}`)}-${slot}-${manager.id}`,name:source?.name||`Rastgele ${role}`,slot,role:`${role} · Otomatik ${targetTier}`,rating,price:5,nation:(source?.country||'Bilinmiyor').slice(0,3).toUpperCase(),club:source?.club||'Serbest oyuncu',image:source?.image,clubLogo:source?.clubLogo};
  used.add(player.name);assignments.push({managerId:manager.id,managerName:manager.name,player,fee});return{...manager,budget:manager.budget-fee,spent:manager.spent+fee,squad:{...manager.squad,[slot]:player}}});
 return{managers:next,assignments};
}

export function fillMissingBenchSlot(managers:Manager[],benchSlot:BenchSlot,candidates:Array<PoolSourceEntry&{slot?:Slot}>,role:string,seed:string,excludedNames:Iterable<string>=[],selectedTiers:RatingTier[]=RATING_TIERS){
 const random=seededRandom(hashSeed(`${seed}-${benchSlot}`)),used=new Set([...excludedNames,...managers.flatMap(m=>[...Object.values(m.squad),...Object.values(m.bench||{})].map(p=>p?.name||''))]);
 const targetTier=fallbackTierForSelection(selectedTiers),tierPool=candidates.filter(candidate=>ratingLevel(candidate.rating)===targetTier),sourcePool=tierPool.length?tierPool:candidates;
 const lowPool=shuffleSeeded([...sourcePool].sort((a,b)=>a.rating-b.rating||a.value-b.value).slice(0,Math.max(24,managers.length*4)),random);
 const assignments:ForcedAssignment[]=[];let cursor=0;
 const next=managers.map(manager=>{if(manager.bench?.[benchSlot])return manager;let source=lowPool.find((candidate,index)=>index>=cursor&&!used.has(candidate.name));if(!source)source=lowPool.find(candidate=>!used.has(candidate.name))||lowPool[cursor%Math.max(1,lowPool.length)];cursor++;
  const rating=source?.rating??(targetTier==='Çok iyi'?87:targetTier==='İyi'?83:targetTier==='Ortalama'?79:targetTier==='Elit'?91:targetTier==='Süperstar'?94:74),fee=Math.min(5,Math.max(0,manager.budget)),slot=source?.slot||BENCH_SLOTS.find(item=>item.key===benchSlot)?.sourceSlots[0]||'GK';
  const player:Footballer={id:`fallback-${source?.id||hashSeed(`${seed}-${manager.id}`)}-${benchSlot}-${manager.id}`,name:source?.name||`Rastgele ${role}`,slot,benchSlot,role:`${role} · Otomatik ${targetTier}`,rating,price:5,nation:(source?.country||'Bilinmiyor').slice(0,3).toUpperCase(),club:source?.club||'Serbest oyuncu',image:source?.image,clubLogo:source?.clubLogo};
  used.add(player.name);assignments.push({managerId:manager.id,managerName:manager.name,player,fee});return{...manager,budget:manager.budget-fee,spent:manager.spent+fee,bench:{...(manager.bench||{}),[benchSlot]:player}}});
 return{managers:next,assignments};
}

export function fillMissingCoaches(managers:Manager[],coaches:Coach[],seed:string){const random=seededRandom(hashSeed(`${seed}-coach`)),used=new Set(managers.flatMap(manager=>manager.coach?[manager.coach.name]:[])),lowerTier=coaches.filter(coach=>!used.has(coach.name)).sort((a,b)=>a.rating-b.rating).slice(0,Math.max(managers.length,Math.ceil(coaches.length/3))),available=shuffleSeeded(lowerTier.length?lowerTier:coaches,random),assignments:Array<{managerId:number;managerName:string;coach:Coach;fee:number}>=[];let cursor=0;const next=managers.map(manager=>{if(manager.coach)return manager;const source=available[cursor++%Math.max(1,available.length)];const fee=Math.min(5,Math.max(0,manager.budget));const coach:Coach=source?{...source,id:`fallback-${source.id}-${manager.id}`,name:`${source.name} (Geçici)`,rating:Math.min(72,source.rating),tactics:Math.min(70,source.tactics),motivation:Math.min(72,source.motivation),adaptability:Math.min(70,source.adaptability),development:Math.min(68,source.development),price:5}:{kind:'coach',id:`fallback-coach-${manager.id}`,name:'Geçici Teknik Direktör',slot:'COACH',role:'Teknik Direktör',rating:68,price:5,nation:'—',tactics:66,motivation:70,adaptability:68,development:65,preferredFormation:'4-2-3-1',specialty:'balance'};assignments.push({managerId:manager.id,managerName:manager.name,coach,fee});return{...manager,coach,budget:manager.budget-fee,spent:manager.spent+fee}});return{managers:next,assignments}}

export function optimizeStartingEleven(manager:Manager):Manager{if(!manager.bench)return manager;const squad={...manager.squad},bench={...manager.bench};for(const group of BENCH_SLOTS){const reserve=bench[group.key];if(!reserve)continue;const target=group.sourceSlots.filter(slot=>squad[slot]).sort((a,b)=>(squad[a]?.rating||0)-(squad[b]?.rating||0))[0],starter=target?squad[target]:undefined;if(!target||!starter||reserve.rating<=starter.rating)continue;const promoted:Footballer={...reserve,slot:target,role:starter.role};delete promoted.benchSlot;squad[target]=promoted;bench[group.key]={...starter,benchSlot:group.key,role:group.label}}return{...manager,squad,bench}}

export function auctionGroupKey(lot:AuctionLot){return isCoach(lot)?'COACH':lot.benchSlot||lot.slot}
export function isBonusPlayerLot(pool:AuctionLot[],index:number,managerCount:number){const lot=pool[index];if(!lot||isCoach(lot))return false;const key=auctionGroupKey(lot),ordinal=pool.slice(0,index+1).filter(item=>auctionGroupKey(item)===key).length;return ordinal>managerCount}
export function auctionProgressLabel(pool:AuctionLot[],index:number){const lot=pool[index];if(!lot)return'';const key=auctionGroupKey(lot),ordinal=pool.slice(0,index+1).filter(item=>auctionGroupKey(item)===key).length;if(isCoach(lot))return`Teknik direktör için ${ordinal}. aday: ${lot.name}`;const label=lot.benchSlot?BENCH_SLOTS.find(item=>item.key===lot.benchSlot)?.label:lot.role;return`${label||lot.role} pozisyonu için ${ordinal}. oyuncu: ${lot.name}`}

export function coachImpact(m:Manager,defense:number,midfield:number,attack:number){
 const c=m.coach;if(!c)return{coachBoost:0,coachFit:0};
 const sector=c.specialty==='attack'?attack:c.specialty==='defense'?defense:c.specialty==='development'?Math.min(defense,midfield,attack):((defense+midfield+attack)/3);
 const formationFit=c.preferredFormation===(m.formation||'4-2-3-1')?100:Math.min(100,72+c.adaptability*.28);
 const fit=c.tactics*.3+c.motivation*.18+c.adaptability*.18+c.development*.1+formationFit*.14+sector*.1;
 const boost=Math.max(0,Math.min(6,(fit-72)*.18));
 return{coachBoost:Math.round(boost*10)/10,coachFit:Math.round(fit*10)/10};
}

export function scoreManager(m:Manager):ScoreBreakdown{
 const optimized=optimizeStartingEleven(m),squad=Object.values(optimized.squad) as Footballer[];const r=(s:Slot)=>optimized.squad[s]?.rating||0;
 const avg=squad.length?squad.reduce((a,p)=>a+p.rating,0)/squad.length:0;
 const defense=(r('GK')+r('RB')+r('CB1')+r('CB2')+r('LB'))/5,midfield=(r('DM')+r('CM')+r('AM'))/3,attack=(r('RW')+r('LW')+r('ST'))/3;
 const weakest=squad.length?Math.min(...squad.map(p=>p.rating)):0,strongest=squad.length?Math.max(...squad.map(p=>p.rating)):0;
 const balance=Math.max(0,100-(strongest-weakest)*2.25),completion=squad.length/11*100,budgetEfficiency=Math.min(100,m.budget/2.5);
 const bench=Object.values(optimized.bench||{}) as Footballer[],benchAverage=bench.length?bench.reduce((sum,p)=>sum+p.rating,0)/bench.length:0,benchCoverage=bench.length/4,depthBoost=Math.min(1.6,Math.max(0,(benchAverage-70)*.045)*benchCoverage);
 const formation=optimized.formation||'4-2-3-1',formationFit=formation==='4-3-3'?Math.max(0,(attack-midfield)*.035):formation==='4-1-4-1'?Math.max(0,(midfield-attack)*.035):Math.max(0,(Math.min(midfield,attack)-82)*.018);
 const starterImpact=avg*.46+defense*.13+midfield*.13+attack*.13+weakest*.06+balance*.035+completion*.045+Math.min(.8,formationFit),raw=starterImpact+budgetEfficiency*.0015+depthBoost;
 const {coachBoost,coachFit}=coachImpact(optimized,defense,midfield,attack);
 const one=(n:number)=>Math.round(n*10)/10;
 return {...optimized,score:Math.round((raw+coachBoost)*100)/100,avg:one(avg),defense:one(defense),midfield:one(midfield),attack:one(attack),weakest:one(weakest),balance:one(balance),completion:one(completion),budgetEfficiency:one(budgetEfficiency),starterImpact:one(starterImpact),coachBoost,coachFit,benchDepth:one(depthBoost)};
}
export function rankManagers(ms:Manager[]){return ms.map(scoreManager).sort((a,b)=>b.score-a.score||b.avg-a.avg||b.budget-a.budget)}
export function resultInsights(ranked:ScoreBreakdown[]):ResultInsights{
 const first=ranked[0],second=ranked[1];if(!first)return{winner:'Sonuç üretilemedi.',runnerUp:'',match:{scoreLine:'—',summary:'Karşılaştırma için en az iki takım gerekir.'}};
 const sector=(team:ScoreBreakdown,mode:'best'|'weak')=>{const sectors=[['savunma',team.defense],['orta saha',team.midfield],['hücum',team.attack]] as const;return [...sectors].sort((a,b)=>mode==='best'?b[1]-a[1]:a[1]-b[1])[0]};
 const firstBest=sector(first,'best'),coachText=first.coach&&first.coachBoost>=.2?`${first.coach.name} yönetimindeki ${first.coachBoost.toFixed(1)} puanlık teknik direktör katkısı`:'kurduğu dengeli ilk 11';
 const winner=`${first.name}, ${first.score.toFixed(2)} takım puanıyla birinci oldu. İlk 11 etkisi ${first.starterImpact.toFixed(1)}, yedek etkisi +${first.benchDepth.toFixed(1)} ve teknik direktör etkisi +${first.coachBoost.toFixed(1)} olarak hesaplandı. ${firstBest[0][0].toUpperCase()+firstBest[0].slice(1)} hattındaki ${firstBest[1].toFixed(1)} ortalama ve ${coachText} onu listenin tepesine taşıdı.`;
 if(!second)return{winner,runnerUp:'İkinci takım bulunmuyor.',match:{scoreLine:'—',summary:'Karşılaştırma için en az iki takım gerekir.'}};
 const secondBest=sector(second,'best'),secondWeak=sector(second,'weak'),gap=Math.max(0,first.score-second.score);
 const runnerUp=`${second.name}, ${second.score.toFixed(2)} puanla ikinci sırayı aldı; ilk 11 etkisi ${second.starterImpact.toFixed(1)}, yedek etkisi +${second.benchDepth.toFixed(1)} ve teknik direktör etkisi +${second.coachBoost.toFixed(1)} oldu. En güçlü bölgesi ${secondBest[1].toFixed(1)} ortalamalı ${secondBest[0]} hattıydı; ${secondWeak[0]} seviyesi ve liderle oluşan ${gap.toFixed(2)} puanlık fark birinciliği kaçırmasına neden oldu.`;
 const random=seededRandom(hashSeed(`${first.name}-${second.name}-${first.score}-${second.score}`)),firstEdge=(first.attack-second.defense)*.08+(first.midfield-second.midfield)*.04+gap*.18;
 const firstGoals=Math.max(0,Math.min(5,Math.round(1.25+firstEdge*.1+random()*1.7))),secondGoals=Math.max(0,Math.min(5,Math.round(1.15-firstEdge*.05+random()*1.6)));
 const scoreLine=`${first.name} ${firstGoals}–${secondGoals} ${second.name}`,summary=`Tahmini maçta ${first.name}, ${first.attack.toFixed(1)} hücum gücüyle ${second.name} savunmasına karşı öne çıkıyor. ${second.name} güçlü ${secondBest[0]} hattıyla denge kurabilir; bu skor kadro puanları ve hat eşleşmelerinden üretilmiş bir oyun tahminidir.`;
 return{winner,runnerUp,match:{scoreLine,summary}};
}
export type SimulatedMatch={homeId:number;awayId:number;homeGoals:number;awayGoals:number};
export type TournamentRow={managerId:number;name:string;played:number;won:number;drawn:number;lost:number;goalsFor:number;goalsAgainst:number;goalDifference:number;points:number};
export function simulateMatch(home:ScoreBreakdown,away:ScoreBreakdown,seed:string):SimulatedMatch{const random=seededRandom(hashSeed(`match-v1-${seed}-${Math.min(home.id,away.id)}-${Math.max(home.id,away.id)}`)),expected=(attack:number,defense:number,mid:number,opMid:number,coach:number)=>Math.max(.35,Math.min(3.2,1.25+(attack-defense)*.055+(mid-opMid)*.025+coach*.035));const goals=(x:number)=>Math.max(0,Math.min(6,Math.floor(x*.52+random()*1.35+random()*.85)));const low=home.id<=away.id?home:away,high=home.id<=away.id?away:home,lowGoals=goals(expected(low.attack,high.defense,low.midfield,high.midfield,low.coachFit)),highGoals=goals(expected(high.attack,low.defense,high.midfield,low.midfield,high.coachFit));return home.id===low.id?{homeId:home.id,awayId:away.id,homeGoals:lowGoals,awayGoals:highGoals}:{homeId:home.id,awayId:away.id,homeGoals:highGoals,awayGoals:lowGoals}}
export function simulateTournament(managers:Manager[],seed:string){const ranked=managers.map(scoreManager),matches:SimulatedMatch[]=[];for(let i=0;i<ranked.length;i++)for(let j=i+1;j<ranked.length;j++)matches.push(simulateMatch(ranked[i],ranked[j],seed));const table=ranked.map(team=>{const games=matches.filter(match=>match.homeId===team.id||match.awayId===team.id);let won=0,drawn=0,lost=0,goalsFor=0,goalsAgainst=0;for(const game of games){const home=game.homeId===team.id,gf=home?game.homeGoals:game.awayGoals,ga=home?game.awayGoals:game.homeGoals;goalsFor+=gf;goalsAgainst+=ga;if(gf>ga)won++;else if(gf===ga)drawn++;else lost++}return{managerId:team.id,name:team.name,played:games.length,won,drawn,lost,goalsFor,goalsAgainst,goalDifference:goalsFor-goalsAgainst,points:won*3+drawn} satisfies TournamentRow}).sort((a,b)=>b.points-a.points||b.goalDifference-a.goalDifference||b.goalsFor-a.goalsFor||a.managerId-b.managerId);return{table,matches}}
export function safeCsvCell(value:unknown){const s=String(value??'');const neutral=/^[=+@\-]/.test(s)?`'${s}`:s;return `"${neutral.replaceAll('"','""')}"`}
export function validManagerNames(names:string[]){const clean=names.map(n=>n.trim());return clean.every(n=>n.length>0&&n.length<=24)&&new Set(clean.map(n=>n.toLocaleLowerCase('tr'))).size===clean.length}

