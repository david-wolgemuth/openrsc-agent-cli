import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { runSource, BridgeTransportError } = require('../cli/socketClient');

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

test('socket client accepts a valid bridge response', async () => {
  await withServer((socket) => socket.once('data', () => socket.end('{"ok":true,"result":"done"}\n')), async (port) => {
    assert.deepEqual(await runSource('1', { host: '127.0.0.1', port }), { ok: true, result: 'done' });
  });
});

test('socket client reports an empty bridge response with diagnostics', async () => {
  await withServer((socket) => socket.once('data', () => socket.end()), async (port) => {
    await assert.rejects(runSource('1', { host: '127.0.0.1', port }), (error) => {
      assert.ok(error instanceof BridgeTransportError);
      assert.equal(error.code, 'empty_bridge_response');
      assert.equal(error.transport.bytesReceived, 0);
      assert.equal(error.transport.socketEnded, true);
      return true;
    });
  });
});

test('socket client reports malformed JSON with diagnostics', async () => {
  await withServer((socket) => socket.once('data', () => socket.end('{not-json}\n')), async (port) => {
    await assert.rejects(runSource('1', { host: '127.0.0.1', port }), { code: 'invalid_bridge_response' });
  });
});

test('socket client reports a timeout while the server remains busy', async () => {
  await withServer(() => {}, async (port) => {
    await assert.rejects(runSource('1', { host: '127.0.0.1', port, timeoutMs: 25 }), (error) => {
      assert.equal(error.code, 'bridge_timeout');
      assert.equal(error.transport.socketTimedOut, true);
      return true;
    });
  });
});
