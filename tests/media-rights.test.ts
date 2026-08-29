import test from 'node:test';
import assert from 'node:assert/strict';
import {applyMediaPolicy, sanitizePool} from '../lib/media-rights.ts';

test('commercial-safe media policy removes unverified remote photos and logos',()=>{
  const source={id:'1',image:'https://example.test/player.jpg',clubLogo:'https://example.test/logo.png'};
  assert.deepEqual(applyMediaPolicy(source,{showPlayerPhotos:false,showClubLogos:false}),{id:'1',image:undefined,clubLogo:undefined});
  assert.equal(sanitizePool([source],{showPlayerPhotos:true,showClubLogos:false})[0].image,source.image);
  assert.equal(sanitizePool([source],{showPlayerPhotos:true,showClubLogos:false})[0].clubLogo,undefined);
});
