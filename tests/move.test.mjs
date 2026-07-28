import assert from 'node:assert/strict';
import test from 'node:test';
import { waitForStablePosition, classifyMove } from '../scripts/lib/actions/move.mjs';

function simulatedWait(sequence, config) {
  var index = 0;
  var clock = 0;
  return waitForStablePosition({
    pollMs: config.pollMs || 100,
    quietMs: config.quietMs,
    deadlineMs: config.deadlineMs,
    now: () => clock,
    sleep: (ms) => { clock += ms; },
    readPosition: () => sequence[Math.min(index++, sequence.length - 1)],
  });
}

const p = (x, y) => ({ x, y, z: 0, location: null });

test('unchanged coordinates settle after the quiet period', () => {
  const result = simulatedWait([p(1, 1), p(1, 1), p(1, 1), p(1, 1)], { quietMs: 300, deadlineMs: 1000 });
  assert.equal(result.settled, true);
  assert.equal(result.elapsedMs, 300);
});

test('coordinate changes reset the quiet timer', () => {
  const result = simulatedWait([p(0, 0), p(1, 0), p(2, 0), p(2, 0), p(2, 0), p(2, 0)], { quietMs: 300, deadlineMs: 1000 });
  assert.equal(result.settled, true);
  assert.equal(result.position.x, 2);
  assert.equal(result.elapsedMs, 500);
});

test('a brief pause does not settle before movement resumes', () => {
  const result = simulatedWait([p(0, 0), p(1, 0), p(1, 0), p(2, 0), p(2, 0), p(2, 0), p(2, 0)], { quietMs: 250, deadlineMs: 1000 });
  assert.equal(result.settled, true);
  assert.equal(result.position.x, 2);
  assert.equal(result.elapsedMs, 600);
});

test('continuous movement reaches the settlement deadline', () => {
  const result = simulatedWait([p(0, 0), p(1, 0), p(2, 0), p(3, 0), p(4, 0), p(5, 0)], { quietMs: 300, deadlineMs: 500 });
  assert.equal(result.settled, false);
});

test('move classification requires settlement and final distance', () => {
  globalThis.controller = { getDistanceFromLocalPlayer: (x, y) => Math.abs(x - 10) + Math.abs(y - 10) };
  assert.equal(classifyMove(p(10, 10), p(10, 10), { x: 10, y: 10 }, 0, true, true, 0, 0).outcome, 'already_at_target');
  assert.equal(classifyMove(p(1, 1), p(10, 10), { x: 10, y: 10 }, 0, true, true, 18, 0).outcome, 'reached');
  assert.equal(classifyMove(p(1, 1), p(8, 8), { x: 10, y: 10 }, 0, true, true, 18, 4).outcome, 'not_reached');
  assert.equal(classifyMove(p(1, 1), p(10, 10), { x: 10, y: 10 }, 0, false, true, 18, 0).outcome, 'settle_timeout');
  assert.equal(classifyMove(p(1, 1), p(10, 10), { x: 10, y: 10 }, 0, true, false, 18, 0).outcome, 'logged_out');
});
