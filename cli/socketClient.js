const net = require('node:net');

class BridgeTransportError extends Error {
  constructor(code, message, transport, cause) {
    super(message);
    this.name = 'BridgeTransportError';
    this.code = code;
    this.transport = transport;
    this.cause = cause;
  }
}

function runSource(source, { host, port, timeoutMs = 10000 }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let response = '';
    let settled = false;
    let socketEnded = false;
    let socketTimedOut = false;
    const startedAt = Date.now();

    const transport = () => ({
      elapsedMs: Date.now() - startedAt,
      bytesReceived: Buffer.byteLength(response, 'utf8'),
      socketEnded,
      socketTimedOut,
    });

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };

    socket.setEncoding('utf8');
    socket.setTimeout(timeoutMs, () => {
      socketTimedOut = true;
      socket.destroy();
      finish(reject, new BridgeTransportError('bridge_timeout', `bridge request timed out after ${timeoutMs}ms`, transport()));
    });
    socket.on('connect', () => {
      const sourceB64 = Buffer.from(source, 'utf8').toString('base64');
      socket.end(`${JSON.stringify({ op: 'run', source_b64: sourceB64 })}\n`);
    });
    socket.on('data', (chunk) => {
      response += chunk;
    });
    socket.on('end', () => {
      socketEnded = true;
      if (response.length === 0) {
        finish(reject, new BridgeTransportError('empty_bridge_response', 'bridge closed the response without sending data', transport()));
        return;
      }
      try {
        finish(resolve, JSON.parse(response));
      } catch (error) {
        finish(reject, new BridgeTransportError('invalid_bridge_response', `invalid response from bridge: ${error.message}`, transport(), error));
      }
    });
    socket.on('close', () => {
      if (!settled) finish(reject, new BridgeTransportError('bridge_disconnected', 'bridge connection closed before a complete response', transport()));
    });
    socket.on('error', (error) => {
      if (settled) return;
      finish(reject, new BridgeTransportError('bridge_disconnected', `could not connect to ${host}:${port}: ${error.message}`, transport(), error));
    });
  });
}

module.exports = { runSource, BridgeTransportError };
