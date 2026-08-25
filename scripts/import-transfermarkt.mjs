import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const SOURCE = 'data/transfermarkt/players.csv';
const DB_PATH = 'data/transfermarkt/players.sqlite';
const POOL_PATH = 'app/data/auction-pool.generated.json';

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i=0;i<text.length;i++) {
    const c=text[i];
    if (quoted) {
      if (c==='"' && text[i+1]==='"') { field+='"'; i++; }
      else if (c==='"') quoted=false;
      else field+=c;
    } else if (c==='"') quoted=true;
    else if (c===',') { row.push(field); field=''; }
    else if (c==='\n') { row.push(field.replace(/\r$/,'')); rows.push(row); row=[]; field=''; }
    else field+=c;
  }
  if(field||row.length){row.push(field);rows.push(row)}
  return rows;
}

function toRating(value,caps,goals,legend=false) {
  const v=Math.max(0,Number(value)||0);
  const international=Math.min(3,(Number(caps)||0)/45)+(legend?Math.min(1.5,(Number(goals)||0)/35):0);
  return Math.max(68,Math.min(97,Math.round((66+Math.log10(v/180000+1)*9+international)*10)/10));
}
function toPrice(value){return Math.max(5,Math.min(200,Math.round((Number(value)||0)/1000000*.64)))}
function percentileRating(index,total){
  const p=index/Math.max(1,total-1);
  const bands=[{end:.08,hi:97,lo:93},{end:.20,hi:92.9,lo:90},{end:.40,hi:89.9,lo:86},{end:.62,hi:85.9,lo:82},{end:.85,hi:81.9,lo:77},{end:1,hi:76.9,lo:68}];
  let start=0;
  for(const b of bands){if(p<=b.end){const t=(p-start)/Math.max(.001,b.end-start);return Math.round((b.hi-(b.hi-b.lo)*t)*10)/10}start=b.end}
  return 68;
}
function normalizePrimeValue(value,lastSeason){
  const year=Number(lastSeason)||2026;
  const factor=year<2000?2.4:year<2010?1.75:year<2018?1.3:1;
  return Math.round((Number(value)||0)*factor);
}
function normalizedPosition(sub){return String(sub||'').trim().toLocaleLowerCase('tr').replaceAll('_',' ').replaceAll('-',' ').replace(/\s+/g,' ')}
function slotFor(sub){const value=normalizedPosition(sub),exact=new Map([
  ['goalkeeper','GK'],['right back','RB'],['centre back','CB'],['center back','CB'],['left back','LB'],['defensive midfield','DM'],['central midfield','CM'],['attacking midfield','AM'],
  ['centre forward','ST'],['center forward','ST'],['second striker','ST'],['right winger','RW'],['right wing','RW'],['right midfield','RW'],['right midfielder','RW'],['rw','RW'],
  ['left winger','LW'],['left wing','LW'],['left midfield','LW'],['left midfielder','LW'],['lw','LW'],['sağ kanat','RW'],['sağ açık','RW'],['sol kanat','LW'],['sol açık','LW']
 ]);return exact.get(value)}

if(!existsSync(SOURCE)) throw new Error(`Eksik kaynak: ${SOURCE}`);
const rows=parseCsv(readFileSync(SOURCE,'utf8'));
const headers=rows.shift();
const ix=Object.fromEntries(headers.map((h,i)=>[h,i]));
if(existsSync(DB_PATH)) rmSync(DB_PATH);
mkdirSync('app/data',{recursive:true});
const db=new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=OFF;');
db.exec(`CREATE TABLE players (
  player_id INTEGER PRIMARY KEY, name TEXT NOT NULL, last_season INTEGER, current_club_id INTEGER,
  current_club_name TEXT, country TEXT, date_of_birth TEXT, position TEXT, sub_position TEXT, auction_slot TEXT,
  preferred_foot TEXT, height_cm INTEGER, international_caps INTEGER, international_goals INTEGER,
  current_value_eur INTEGER, peak_value_eur INTEGER, source_url TEXT
)`);
const insert=db.prepare(`INSERT INTO players VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
db.exec('BEGIN');
for(const r of rows){
  if(!r[ix.player_id]) continue;
  insert.run(Number(r[ix.player_id]),r[ix.name],Number(r[ix.last_season])||null,Number(r[ix.current_club_id])||null,r[ix.current_club_name]||null,r[ix.country_of_citizenship]||null,r[ix.date_of_birth]||null,r[ix.position]||null,r[ix.sub_position]||null,slotFor(r[ix.sub_position])||null,r[ix.foot]||null,Number(r[ix.height_in_cm])||null,Number(r[ix.international_caps])||0,Number(r[ix.international_goals])||0,Number(r[ix.market_value_in_eur])||0,Number(r[ix.highest_market_value_in_eur])||0,r[ix.url]||null);
}
db.exec('COMMIT');
db.exec('CREATE INDEX idx_players_current_pool ON players(last_season, auction_slot, current_value_eur); CREATE INDEX idx_players_legend_pool ON players(last_season, auction_slot, peak_value_eur); PRAGMA optimize;');

const baseSlots=['GK','RB','CB','LB','DM','CM','AM','RW','LW','ST'];
const pool={current:{},legends:{}};
for(const era of ['current','legends']) for(const slot of baseSlots) pool[era][slot]=[];
for(const r of rows){
  const slot=slotFor(r[ix.sub_position]); if(!slot) continue;
  const clubId=Number(r[ix.current_club_id])||0;
  const common={id:Number(r[ix.player_id]),name:r[ix.name],country:r[ix.country_of_citizenship]||'',club:r[ix.current_club_name]||'',image:r[ix.image_url]||'',clubLogo:clubId?`https://tmssl.akamaized.net/images/wappen/head/${clubId}.png`:''};
  const currentValue=Number(r[ix.market_value_in_eur])||0, peakValue=Number(r[ix.highest_market_value_in_eur])||0;
  if(Number(r[ix.last_season])>=2025 && currentValue>0) pool.current[slot].push({...common,rating:toRating(currentValue,r[ix.international_caps],r[ix.international_goals]),price:toPrice(currentValue),value:currentValue});
  if(Number(r[ix.last_season])>=1996 && peakValue>0){const normalized=normalizePrimeValue(peakValue,r[ix.last_season]);pool.legends[slot].push({...common,rating:toRating(normalized,r[ix.international_caps],r[ix.international_goals],true),price:toPrice(normalized),value:normalized});}
}
for(const era of ['current','legends']) for(const slot of baseSlots){
  const ranked=pool[era][slot].sort((a,b)=>b.rating-a.rating||b.value-a.value).slice(0,240);
  pool[era][slot]=ranked.map((p,i)=>({...p,rating:percentileRating(i,ranked.length)}));
}
for(const era of ['current','legends']){
  const center=pool[era].CB;
  pool[era].CB1=center.filter((_,i)=>i%2===0).map((p,i,a)=>({...p,rating:percentileRating(i,a.length)}));
  pool[era].CB2=center.filter((_,i)=>i%2===1).map((p,i,a)=>({...p,rating:percentileRating(i,a.length)}));
  delete pool[era].CB;
}
writeFileSync(POOL_PATH,JSON.stringify(pool));
const count=db.prepare('SELECT COUNT(*) AS count FROM players').get().count;
const playable=new Set([...Object.values(pool.current),...Object.values(pool.legends)].flat().map(p=>p.id)).size;
const wingMappings={right:rows.filter(r=>slotFor(r[ix.sub_position])==='RW').length,left:rows.filter(r=>slotFor(r[ix.sub_position])==='LW').length};
const quality={generatedAt:new Date().toISOString(),sourceRows:Number(count),playableProfiles:playable,missingSubPosition:rows.filter(r=>!r[ix.sub_position]).length,unsupportedSubPositions:[...new Set(rows.map(r=>r[ix.sub_position]).filter(s=>s&&!slotFor(s)))].sort(),wingMappings,tiers:{}};
for(const era of ['current','legends'])quality.tiers[era]=Object.fromEntries(baseSlots.flatMap(s=>{const key=s==='CB'?'CB1':s;const list=pool[era][key]||[];return [[key,Object.fromEntries(['Süperstar','Elit','Çok iyi','İyi','Ortalama','Standart'].map(t=>[t,list.filter(p=>(p.rating>=93?'Süperstar':p.rating>=90?'Elit':p.rating>=86?'Çok iyi':p.rating>=82?'İyi':p.rating>=77?'Ortalama':'Standart')===t).length]))]]}));
writeFileSync('data/transfermarkt/data-quality.json',JSON.stringify(quality,null,2));
console.log(JSON.stringify({players:Number(count),playable,current:Object.values(pool.current).reduce((n,a)=>n+a.length,0),legends:Object.values(pool.legends).reduce((n,a)=>n+a.length,0),database:DB_PATH,pool:POOL_PATH}));
db.close();

