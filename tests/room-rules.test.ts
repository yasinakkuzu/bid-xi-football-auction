import test from 'node:test';
import assert from 'node:assert/strict';
import {LOT_SCOPED_ACTIONS, reopenLiveLot, validateLotAction} from '../lib/room-rules.ts';
import type {AuctionLot, Manager} from '../lib/game-engine.ts';

const lot: AuctionLot = {id:'lot-1',name:'Oyuncu',slot:'ST',role:'Forvet',rating:90,price:10,nation:'TR',club:'Test'};
const manager=(id:number,budget=100):Manager=>({id,name:`M${id}`,budget,spent:0,squad:{},formation:'4-2-3-1'});

test('every lot-scoped action requires the exact current lot id',()=>{
  for(const action of LOT_SCOPED_ACTIONS){
    assert.throws(()=>validateLotAction(action,undefined,{pool:[lot],index:0}),/LOT_ID_REQUIRED/);
    assert.throws(()=>validateLotAction(action,'old-lot',{pool:[lot],index:0}),/STALE_LOT/);
    assert.doesNotThrow(()=>validateLotAction(action,'lot-1',{pool:[lot],index:0}));
  }
  assert.doesNotThrow(()=>validateLotAction('chat',undefined,{pool:[lot],index:0}));
});

test('reopening clears passes and selects an eligible challenger with a fresh deadline',()=>{
  const game={managers:[manager(0),manager(1)],pool:[lot],index:0,bid:20,leader:0,passed:[1],activeTurn:null,paused:true,pausedRemainingMs:500,deadline:null};
  assert.equal(reopenLiveLot(game,20,1_000),true);
  assert.deepEqual(game.passed,[]);
  assert.equal(game.activeTurn,1);
  assert.equal(game.deadline,21_000);
  assert.equal(game.paused,false);
  assert.equal(game.pausedRemainingMs,undefined);
});

test('reopening fails closed when there is no eligible challenger',()=>{
  const full=manager(1);full.squad.ST=lot;
  const game={managers:[manager(0),full],pool:[lot],index:0,bid:20,leader:0,passed:[1],activeTurn:null,paused:false,deadline:null};
  assert.equal(reopenLiveLot(game,20,1_000),false);
  assert.equal(game.activeTurn,null);
});
