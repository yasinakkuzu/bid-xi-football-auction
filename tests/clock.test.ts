import test from 'node:test';
import assert from 'node:assert/strict';
import { clockOffset, remainingSeconds } from '../app/online/clock.ts';

test('clock offset is derived from the server timestamp and ignored when missing', () => {
  assert.equal(clockOffset(undefined, 1_000), 0);
  assert.equal(clockOffset(null, 1_000), 0);
  assert.equal(clockOffset(Number.NaN, 1_000), 0);
  assert.equal(clockOffset(9_000, 1_000), 8_000);
  assert.equal(clockOffset(1_000, 9_000), -8_000);
  assert.equal(clockOffset(5_000, 1_400, 1_000), 3_800, 'uses RTT midpoint when requestStart is provided');
});

test('countdown renders on the server timeline and never goes negative', () => {
  assert.equal(remainingSeconds(null, 1_000), 0);
  assert.equal(remainingSeconds(5_000, 4_999), 1);
  assert.equal(remainingSeconds(5_000, 6_000), 0);
  assert.equal(remainingSeconds(5_000, 1_000, 3_000), 1);
  // Without the offset a device whose clock is 29s behind would show 29s too
  // much time left; applying the offset puts it back on the server timeline.
  assert.equal(remainingSeconds(30_000, 1_000), 29);
  assert.equal(remainingSeconds(30_000, 1_000, 29_000), 0);
});
