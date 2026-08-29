import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

type PoolPlayer={id:number;name:string;rating:number;price:number};
type Pool=Record<'current'|'legends',Record<string,PoolPlayer[]>>;
type Quality={sourceRows:number;playableProfiles:number;wingMappings:{right:number;left:number};overlapBySlot:Record<string,{count:number;ratio:number}>};
const quality=JSON.parse(readFileSync('data/transfermarkt/data-quality.json','utf8')) as Quality;
const pool=JSON.parse(readFileSync('app/data/auction-pool.generated.json','utf8')) as Pool;
const manifest=JSON.parse(readFileSync('data/transfermarkt/dataset-manifest.json','utf8')) as {datasetVersion:string;scoreVersion:string;sourceSha256:string;rights:{reviewStatus:string}};

test('source database and generated pool pass integrity thresholds',()=>{
  const database=new DatabaseSync('data/transfermarkt/players.sqlite',{readOnly:true});
  assert.equal(String(database.prepare('PRAGMA integrity_check').get()?.integrity_check),'ok');
  assert.equal(Number(database.prepare('SELECT COUNT(*) count FROM players').get()?.count),quality.sourceRows);
  assert.ok(Number(database.prepare("SELECT COUNT(*) count FROM players WHERE auction_slot='RW'").get()?.count)>1000);
  assert.ok(Number(database.prepare("SELECT COUNT(*) count FROM players WHERE auction_slot='LW'").get()?.count)>1000);
  database.close();
  assert.ok(quality.sourceRows>=10000);
  assert.ok(quality.playableProfiles>=1000);
  assert.ok(quality.wingMappings.right>1000);
  assert.ok(quality.wingMappings.left>1000);
});

test('every era, role and rating tier can support eight managers plus surprise lot',()=>{
  for(const era of ['current','legends'] as const)for(const [slot,players] of Object.entries(pool[era])){
    assert.ok(players.length>=9,`${era}/${slot}`);
    for(const player of players){assert.ok(player.name);assert.ok(player.rating>=0&&player.rating<=100);assert.ok(player.price>=5)}
  }
});

test('current and last-30-year identities overlap by no more than twelve percent per slot',()=>{
  for(const [slot,result] of Object.entries(quality.overlapBySlot))assert.ok(result.ratio<=.12,`${slot}: ${result.ratio}`);
});

test('dataset provenance binds source, score version and rights review state',()=>{
  assert.match(manifest.datasetVersion,/^transfermarkt-\d{4}-\d{2}-\d{2}$/);
  assert.equal(manifest.scoreVersion,'score-v3');
  assert.match(manifest.sourceSha256,/^[a-f0-9]{64}$/);
  assert.equal(manifest.rights.reviewStatus,'pending-legal-review');
});

test('generated current pool retains league metadata for custom pool search',()=>{
  const quality=JSON.parse(readFileSync('data/transfermarkt/data-quality.json','utf8')) as {leagueCoverage:number};
  assert.ok(quality.leagueCoverage>=.95,`league coverage ${quality.leagueCoverage} is below 95%`);
});

test('responsive rules cover tablet and mobile layouts',()=>{const css=readFileSync('app/globals.css','utf8');assert.match(css,/@media\(max-width:1024px\)/);assert.match(css,/@media\(max-width:720px\)/);assert.match(css,/@media\(max-width:640px\)/)});
test('formation places AM behind the striker and DM/CM side by side',()=>{const page=readFileSync('app/page.tsx','utf8'),online=readFileSync('app/online/page.tsx','utf8');assert.match(page,/DM:\{left:'36%',top:'55%'\}, CM:\{left:'64%',top:'55%'\}, AM:\{left:'50%',top:'30%'\}/);assert.match(online,/DM:\s*\{\s*left:\s*["']36%["'],\s*top:\s*["']57%["']\s*\},\s*CM:\s*\{\s*left:\s*["']64%["'],\s*top:\s*["']57%["']\s*\},\s*AM:\s*\{\s*left:\s*["']50%["'],\s*top:\s*["']32%["']\s*\}/)});
test('local and multiplayer modes share the root page',()=>{const page=readFileSync('app/page.tsx','utf8'),online=readFileSync('app/online/page.tsx','utf8');assert.match(page,/mode==='online'\?<OnlineGame/);assert.match(online,/location\.replace\(`\/\?\$\{params\.toString\(\)\}`\)/);assert.doesNotMatch(online,/location\.origin\}\/online\?room=/)});
test('multiplayer setup exposes all six pool tiers',()=>{const online=readFileSync('app/online/page.tsx','utf8');assert.match(online,/Havuza dahil edilecek seviyeler/);assert.match(online,/RATING_TIERS\.map\(\s*\(?tier/);assert.match(online,/settings\.selectedTiers\.length\}\/6 seviye seçili/)});
test('bench mode and mobile manager navigation are exposed in both game modes',()=>{const page=readFileSync('app/page.tsx','utf8'),online=readFileSync('app/online/page.tsx','utf8'),rooms=readFileSync('lib/rooms.ts','utf8'),css=readFileSync('app/globals.css','utf8');assert.match(page,/4 yedek olsun/);assert.match(page,/includeBench\?250:0/);assert.match(online,/Açık artırma gidişatı/);assert.match(online,/Kadrom/);assert.match(online,/includeBench:\s*true/);assert.match(rooms,/includeBench\?250:0/);assert.match(css,/\.manager-view-tabs\{position:fixed/)});
test('auction progress notes include player names and the defensive midfielder label is explicit',()=>{const page=readFileSync('app/page.tsx','utf8'),online=readFileSync('app/online/page.tsx','utf8'),engine=readFileSync('lib/game-engine.ts','utf8');assert.match(page,/Savunmacı Merkez Orta Saha/);assert.match(page,/auctionProgressLabel\(pool,index\)/);assert.match(online,/game\.publicMeta\?\.groupOrdinal\|\|1/);assert.match(online,/oyuncu: \{current\.name\}/);assert.match(engine,/pozisyonu için \$\{ordinal\}\. oyuncu: \$\{lot\.name\}/)});
test('multiplayer routes use authorization headers, rate limits and explicit lot skipping',()=>{const online=readFileSync('app/online/page.tsx','utf8'),roomRoute=readFileSync('app/api/rooms/[code]/route.ts','utf8'),actionRoute=readFileSync('app/api/rooms/[code]/actions/route.ts','utf8'),rooms=readFileSync('lib/rooms.ts','utf8');assert.doesNotMatch(online,/\?token=/);assert.match(online,/Authorization: `Bearer/);assert.match(roomRoute,/rateLimit/);assert.match(actionRoute,/BODY_TOO_LARGE/);assert.match(rooms,/type==='skip'/);assert.match(rooms,/settleExpired/)});
test('online bonus transitions import every runtime helper they call',()=>{const rooms=readFileSync('lib/rooms.ts','utf8'),importLine=rooms.split('\n').find(line=>line.includes("from './game-engine'"))||'';assert.match(importLine,/\bisBonusPlayerLot\b/);assert.match(rooms,/bonusReveal\?/)});
test('era and selected tiers remain authoritative in every pool builder',()=>{const local=readFileSync('app/page.tsx','utf8'),rooms=readFileSync('lib/rooms.ts','utf8');assert.match(local,/generated\[era\]\?\.\[s\.key\]/);assert.match(local,/candidates=selected/);assert.match(rooms,/sourceData\[settings\.era\]\[s\.key\]/);assert.match(rooms,/favorites=settings\.poolMode==='custom'\?selected\.filter/);assert.doesNotMatch(rooms,/scenario==='hidden-gems'\?\['İyi','Ortalama','Standart'\]/)});
test('completed position groups surface automatic assignments and all-pass lots advance',()=>{const online=readFileSync('app/online/page.tsx','utf8'),rooms=readFileSync('lib/rooms.ts','utf8');assert.match(rooms,/completeCurrentGroupIfLeaving/);assert.match(rooms,/g\.autoAssignments=/);assert.match(rooms,/else if\(g\.leader===null\).*advanceLot\(state\).*else\{g\.activeTurn=null;g\.deadline=null;awardCurrentLot/s);assert.match(online,/EKSİK POZİSYON TAMAMLANDI/)});
test('mobile accessibility and loading feedback are present',()=>{const page=readFileSync('app/page.tsx','utf8'),online=readFileSync('app/online/page.tsx','utf8'),css=readFileSync('app/globals.css','utf8');assert.match(page,/aria-busy=\{loading\}/);assert.match(page,/\/api\/pool\?era=/);assert.doesNotMatch(page,/import\('\.\/data\/auction-pool\.generated\.json'\)/);assert.match(page,/role="status"/);assert.match(online,/aria-live="polite"/);assert.match(online,/role="dialog"/);assert.match(css,/:focus-visible/);assert.match(css,/min-height:44px/)});
test('long bid leaders cannot shift controls and room sessions survive accidental closes',()=>{const online=readFileSync('app/online/page.tsx','utf8'),css=readFileSync('app/globals.css','utf8');assert.match(online,/className="bid-summary"/);assert.match(online,/roomSessionKey/);assert.match(online,/readSavedSession\(shared \|\| undefined\)/);assert.match(online,/saveSession\(nextSession\)/);assert.match(css,/\.bid-summary \.current-leader\{[^}]*text-overflow:ellipsis/);assert.match(css,/\.online-bid,\.presentation-mode \.online-bid\{display:grid;grid-template-columns/)});
test('host automation, coach bonus, top ten leaderboard and left-goal formation are wired',()=>{const local=readFileSync('app/page.tsx','utf8'),online=readFileSync('app/online/page.tsx','utf8'),rooms=readFileSync('lib/rooms.ts','utf8'),schema=readFileSync('db/schema.ts','utf8'),css=readFileSync('app/globals.css','utf8');assert.match(online,/action\('autoComplete'\)/);assert.match(online,/action\('restart'\)/);assert.match(rooms,/type==='autoComplete'/);assert.match(rooms,/type==='restart'/);assert.match(local,/mixedAuctionLots\(COACHES,excluded,count\+1,random\)/);assert.match(rooms,/mixedAuctionLots\(COACHES,excluded,count\+1,random\)/);assert.match(local,/En iyi 10 kadro/);assert.match(rooms,/ORDER BY score DESC,played_at DESC LIMIT \?/);assert.match(schema,/leaderboard_entries/);assert.match(online,/100-Number\.parseFloat\(point\.top\)/);assert.match(css,/mini-goal-left/)});
