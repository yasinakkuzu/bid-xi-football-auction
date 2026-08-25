export type Era = 'current' | 'legends';
export type QualityMode = 'best' | 'all';
export type RatingTier = 'Süperstar'|'Elit'|'Çok iyi'|'İyi'|'Ortalama'|'Standart';
export type Slot = 'GK'|'RB'|'CB1'|'CB2'|'LB'|'DM'|'CM'|'AM'|'RW'|'LW'|'ST';
export type Footballer = { id:string; name:string; slot:Slot; role:string; rating:number; price:number; nation:string; club?:string; image?:string; clubLogo?:string };
export type Manager = { id:number; name:string; budget:number; squad:Partial<Record<Slot,Footballer>>; spent:number };
export type PoolSourceEntry = { id:number; name:string; country:string; club:string; rating:number; price:number; value:number; image?:string; clubLogo?:string };
export type ScoreBreakdown = Manager & {score:number;avg:number;defense:number;midfield:number;attack:number;weakest:number;balance:number;completion:number;budgetEfficiency:number};

export const SLOT_KEYS:Slot[]=['GK','RB','CB1','CB2','LB','DM','CM','AM','RW','LW','ST'];
export const RATING_TIERS:RatingTier[]=['Süperstar','Elit','Çok iyi','İyi','Ortalama','Standart'];
export function ratingLevel(r:number):RatingTier{return r>=93?'Süperstar':r>=90?'Elit':r>=86?'Çok iyi':r>=82?'İyi':r>=77?'Ortalama':'Standart'}

export function hashSeed(text:string){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
export function seededRandom(seed:number){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export function shuffleSeeded<T>(input:T[],random:()=>number){const out=[...input];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}

export function affordableLimit(m:Manager){return m.budget-Math.max(0,10-Object.keys(m.squad).length)*5}
export function openingPrice(lot:Footballer,managers:Manager[]){const limits=managers.filter(m=>!m.squad[lot.slot]).map(affordableLimit);return Math.max(5,Math.min(lot.price,Math.max(5,...limits)))}
export function passIsSafe(pool:Footballer[],index:number,managers:Manager[]){const lot=pool[index];if(!lot)return false;return pool.slice(index).filter(p=>p.slot===lot.slot).length>managers.filter(m=>!m.squad[lot.slot]).length}
export function calculateStartingBudget(pool:Footballer[],quality:QualityMode){if(quality==='best')return 1000;const expected=SLOT_KEYS.reduce((sum,slot)=>{const c=pool.filter(x=>x.slot===slot);return sum+c.reduce((n,x)=>n+x.price,0)/Math.max(1,c.length)},0);return Math.min(900,Math.max(300,Math.ceil(expected*1.18/10)*10))}

export function scoreManager(m:Manager):ScoreBreakdown{
 const squad=Object.values(m.squad) as Footballer[];const r=(s:Slot)=>m.squad[s]?.rating||0;
 const avg=squad.length?squad.reduce((a,p)=>a+p.rating,0)/squad.length:0;
 const defense=(r('GK')+r('RB')+r('CB1')+r('CB2')+r('LB'))/5,midfield=(r('DM')+r('CM')+r('AM'))/3,attack=(r('RW')+r('LW')+r('ST'))/3;
 const weakest=squad.length?Math.min(...squad.map(p=>p.rating)):0,strongest=squad.length?Math.max(...squad.map(p=>p.rating)):0;
 const balance=Math.max(0,100-(strongest-weakest)*2.25),completion=squad.length/11*100,budgetEfficiency=Math.min(100,m.budget/2.5);
 const raw=avg*.46+defense*.13+midfield*.13+attack*.13+weakest*.06+balance*.035+completion*.045+budgetEfficiency*.015+m.budget*.00037;
 const one=(n:number)=>Math.round(n*10)/10;
 return {...m,score:Math.round(raw*100)/100,avg:one(avg),defense:one(defense),midfield:one(midfield),attack:one(attack),weakest:one(weakest),balance:one(balance),completion:one(completion),budgetEfficiency:one(budgetEfficiency)};
}
export function rankManagers(ms:Manager[]){return ms.map(scoreManager).sort((a,b)=>b.score-a.score||b.avg-a.avg||b.budget-a.budget)}
export function safeCsvCell(value:unknown){const s=String(value??'');const neutral=/^[=+@\-]/.test(s)?`'${s}`:s;return `"${neutral.replaceAll('"','""')}"`}
export function validManagerNames(names:string[]){const clean=names.map(n=>n.trim());return clean.every(n=>n.length>0&&n.length<=24)&&new Set(clean.map(n=>n.toLocaleLowerCase('tr'))).size===clean.length}

