const net = require('node:net');

function runSource(source, { host, port, timeoutMs = 10000 }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let response = '';
    let settled = false;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };

    socket.setEncoding('utf8');
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      finish(reject, new Error(`bridge request timed out after ${timeoutMs}ms`));
    });
    socket.on('connect', () => {
      const sourceB64 = Buffer.from(source, 'utf8').toString('base64');
      socket.end(`${JSON.stringify({ op: 'run', source_b64: sourceB64 })}\n`);
    });
    socket.on('data', (chunk) => {
      response += chunk;
    });
    socket.on('end', () => {
      try {
        finish(resolve, JSON.parse(response));
      } catch (error) {
        finish(reject, new Error(`invalid response from bridge: ${error.message}`));
      }
    });
    socket.on('error', (error) => finish(reject, new Error(`could not connect to ${host}:${port}: ${error.message}`)));
  });
}

module.exports = { runSource };
