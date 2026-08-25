import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const quality=JSON.parse(readFileSync('data/transfermarkt/data-quality.json','utf8'));
const pool=JSON.parse(readFileSync('app/data/auction-pool.generated.json','utf8'));
test('source database and generated pool pass integrity thresholds',()=>{const db=new DatabaseSync('data/transfermarkt/players.sqlite',{readOnly:true});assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(db.prepare('SELECT COUNT(*) count FROM players').get().count,quality.sourceRows);db.close();assert.ok(quality.sourceRows>=10000);assert.ok(quality.playableProfiles>=1000)});
test('every era, role and rating tier can support eight managers plus surprise lot',()=>{for(const era of ['current','legends'])for(const [slot,players] of Object.entries(pool[era])){assert.ok((players as unknown[]).length>=9,`${era}/${slot}`);for(const p of players as Array<{rating:number;price:number;name:string}>){assert.ok(p.name);assert.ok(p.rating>=0&&p.rating<=100);assert.ok(p.price>=5)}}});
test('responsive rules cover tablet and mobile layouts',()=>{const css=readFileSync('app/globals.css','utf8');assert.match(css,/@media\(max-width:1024px\)/);assert.match(css,/@media\(max-width:720px\)/);assert.match(css,/@media\(max-width:640px\)/)});

