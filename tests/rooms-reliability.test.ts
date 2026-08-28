import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

const rooms=readFileSync('lib/rooms.ts','utf8');
const actions=readFileSync('app/api/rooms/[code]/actions/route.ts','utf8');
const leaderboard=readFileSync('app/api/leaderboard/route.ts','utf8');

test('hidden rooms redact active ratings and future lot identities',()=>{
  assert.match(rooms,/export function publicStateView/);
  assert.match(rooms,/delete safe\.rating/);
  assert.match(rooms,/name:'Gizli lot'/);
  assert.match(rooms,/view\.game\.undo=undefined/);
  assert.doesNotMatch(rooms,/if\(view\.settings\.revealRatings\)return view/);
  assert.match(rooms,/state:publicStateView\(ctx\.state\)/);
  assert.match(rooms,/safe=publicStateView\(result\)/);
});

test('pause preserves the remaining countdown and public metadata drives hidden UI',()=>{
  assert.match(rooms,/pausedRemainingMs=g\.deadline\?Math\.max\(0,g\.deadline-Date\.now\(\)\)/);
  assert.match(rooms,/g\.deadline=Date\.now\(\)\+Math\.max\(1000,g\.pausedRemainingMs/);
  const online=readFileSync('app/online/page.tsx','utf8');
  assert.match(online,/game\.publicMeta\?\.currentIsBonus/);
  assert.match(online,/game\.publicMeta\?\.currentPassIsSafe/);
});

test('room actions support idempotency and stale lot protection',()=>{
  assert.match(actions,/idempotency-key/);
  assert.match(actions,/body\.requestId/);
  assert.match(rooms,/room_actions/);
  assert.match(rooms,/STALE_LOT/);
  assert.match(rooms,/actor_hash=\? AND request_id=\?/);
  const online=readFileSync('app/online/page.tsx','utf8');
  assert.match(online,/lotScopedActions=\['bid','pass','sell','close','skip','reopen','manualSell','manualSkip'\]/);
});

test('automatic transitions capture an undo snapshot before mutation',()=>{
  assert.match(rooms,/function captureUndo/);
  assert.match(rooms,/function settleExpired[\s\S]*?captureUndo\(state\)/);
  assert.match(rooms,/function settleBot[\s\S]*?captureUndo\(state\)/);
  assert.match(rooms,/function autoCompleteAuction\(state:RoomState\)\{captureUndo\(state\)/);
  assert.match(rooms,/state\.status='auction';state\.completedAt=undefined;state\.autoCompleted=false/);
});

test('leaderboard supports standard/all rules, consent, aliases and deletion',()=>{
  assert.match(rooms,/leaderboardOptIn/);
  assert.match(rooms,/standardEligibility/);
  assert.match(rooms,/standard_eligible=1/);
  assert.match(rooms,/type==='leaderboardPreference'/);
  assert.match(leaderboard,/filter.*==='all'/s);
  assert.match(leaderboard,/export async function DELETE/);
  assert.match(rooms,/leaderboard_deletions/);
  assert.match(rooms,/delete_token_hash/);
  const online=readFileSync('app/online/page.tsx','utf8');
  assert.match(online,/game\.publicMeta\?\.canUndo/);
});

test('leaderboard reliability migration upgrades an existing database',()=>{
  const database=new DatabaseSync(':memory:');
  database.exec(readFileSync('drizzle/0003_leaderboard.sql','utf8'));
  database.exec(readFileSync('drizzle/0004_reliability_leaderboard.sql','utf8'));
  const columns=database.prepare('PRAGMA table_info(leaderboard_entries)').all().map(row=>String(row.name));
  for(const column of ['member_id','delete_token_hash','ruleset_json','standard_eligible','auto_completed','human_count','scenario_id','pool_mode','include_bench'])assert.ok(columns.includes(column),column);
  database.prepare("INSERT INTO room_actions VALUES('ROOM01','actor','request-1','{}',1)").run();
  assert.equal(database.prepare('SELECT COUNT(*) count FROM room_actions').get().count,1);
  database.prepare("INSERT INTO leaderboard_deletions VALUES('ROOM01:1:0',1)").run();
  assert.equal(database.prepare('SELECT COUNT(*) count FROM leaderboard_deletions').get().count,1);
  database.close();
});

test('replay freshness, custom substitutes and duration metadata are wired',()=>{
  assert.match(rooms,/rememberCurrentLots\(state\)/);
  assert.match(rooms,/recentLotIds\?\:string\[\]/);
  assert.match(rooms,/const scoped=settings\.poolMode==='custom'/);
  assert.match(rooms,/scenarioId==='stars-and-scrubs'/);
  assert.match(rooms,/export function estimateAuctionDuration/);
  assert.match(rooms,/estimatedDuration:estimateAuctionDuration/);
});
