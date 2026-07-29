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

test('already inside the radius still waits for positional settlement', () => {
  const result = simulatedWait([p(10, 10), p(11, 10), p(12, 10), p(12, 10), p(12, 10), p(12, 10)], { quietMs: 300, deadlineMs: 1000 });
  assert.equal(result.settled, true);
  assert.equal(result.position.x, 12);
  assert.equal(result.elapsedMs, 500);
});

test('continuous movement reaches the settlement deadline', () => {
  const result = simulatedWait([p(0, 0), p(1, 0), p(2, 0), p(3, 0), p(4, 0), p(5, 0)], { quietMs: 300, deadlineMs: 500 });
  assert.equal(result.settled, false);
});

test('move classification requires settlement and final distance', () => {
  const base = { radius: 0, settled: true, loggedIn: true, running: true, inCombat: false, integrityPassed: true };
  assert.equal(classifyMove({ ...base, initialDistance: 0, finalDistance: 0 }).outcome, 'already_at_target');
  assert.equal(classifyMove({ ...base, initialDistance: 18, finalDistance: 0 }).outcome, 'reached');
  assert.equal(classifyMove({ ...base, initialDistance: 18, finalDistance: 4 }).outcome, 'not_reached');
  assert.equal(classifyMove({ ...base, settled: false, initialDistance: 18, finalDistance: 0 }).outcome, 'settle_timeout');
  assert.equal(classifyMove({ ...base, loggedIn: false, initialDistance: 18, finalDistance: 0 }).outcome, 'logged_out');
});

test('classification reports combat and stopped-client outcomes', () => {
  const base = { radius: 0, settled: true, loggedIn: true, running: true, inCombat: false, integrityPassed: true, initialDistance: 18, finalDistance: 4 };
  assert.equal(classifyMove({ ...base, inCombat: true }).outcome, 'combat_interrupted');
  assert.equal(classifyMove({ ...base, running: false }).outcome, 'client_stopped');
});

test('classification rejects position changes during observation', () => {
  assert.equal(classifyMove({ radius: 0, settled: true, loggedIn: true, running: true, inCombat: false, integrityPassed: false, initialDistance: 18, finalDistance: 0 }).outcome, 'state_changed_during_observation');
});

test('controller-return distance is independent from later final distance', () => {
  const base = { radius: 0, settled: true, loggedIn: true, running: true, inCombat: false, integrityPassed: true, initialDistance: 18 };
  assert.equal(classifyMove({ ...base, finalDistance: 0 }).outcome, 'reached');
  assert.equal(classifyMove({ ...base, finalDistance: 4 }).outcome, 'not_reached');
});
