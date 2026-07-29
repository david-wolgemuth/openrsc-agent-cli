import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import net from 'node:net';
import test from 'node:test';

const execFile = promisify(execFileCallback);

async function withServer(handler, callback) {
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    handler(socket);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await callback(server.address().port);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function invokeObserve(port, timeoutMs = 10000) {
  try {
    return await execFile(process.execPath, ['irsc', 'observe'], {
      cwd: process.cwd(),
      env: { ...process.env, ARC_HOST: '127.0.0.1', ARC_PORT: String(port), IRSC_TIMEOUT_MS: String(timeoutMs) },
    });
  } catch (error) {
    return { stdout: error.stdout, stderr: error.stderr, code: error.code };
  }
}

for (const scenario of [
  ['empty response', (socket) => socket.once('data', () => socket.end()), 'EMPTY_BRIDGE_RESPONSE'],
  ['malformed response', (socket) => socket.once('data', () => socket.end('{not-json}\n')), 'INVALID_BRIDGE_RESPONSE'],
  ['connection reset', (socket) => socket.once('data', () => socket.resetAndDestroy()), 'BRIDGE_DISCONNECTED'],
  ['timeout', () => {}, 'BRIDGE_TIMEOUT'],
]) {
  const [name, handler, expectedCode] = scenario;
  test(`CLI prints one stdout JSON transport failure for ${name}`, async () => {
    await withServer(handler, async (port) => {
      const result = await invokeObserve(port, 25);
      assert.equal(result.code, 1);
      assert.equal(result.stderr, '');
      const lines = result.stdout.trim().split('\n');
      assert.equal(lines.length, 1);
      const decoded = JSON.parse(lines[0]);
      assert.deepEqual(decoded.error.code, expectedCode);
      assert.equal(decoded.ok, false);
      assert.equal(decoded.safeToAct, false);
    });
  });
}
