const fs = require('node:fs');
const path = require('node:path');
const { runSource } = require('./socketClient');

const DEFAULT_HOST = process.env.ARC_HOST || '127.0.0.1';
const DEFAULT_PORT = Number(process.env.ARC_PORT || 8765);

function usage() {
  return [
    'Usage:',
    '  ./arc run -c "javascript source"',
    '  ./arc run <script.js>',
    '',
    'Options:',
    '  --host <host>  Bridge host (default: 127.0.0.1)',
    '  --port <port>  Bridge port (default: 8765)',
  ].join('\n');
}

function fail(message) {
  console.error(`arc: ${message}`);
  console.error(usage());
  process.exitCode = 2;
}

function parseRunArgs(args) {
  let source;
  let sourcePath;
  let host = DEFAULT_HOST;
  let port = DEFAULT_PORT;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '-c' || arg === '--code') {
      if (source !== undefined || sourcePath !== undefined) return { error: 'provide either -c or a script file, not both' };
      source = args[++index];
      if (source === undefined) return { error: `${arg} requires JavaScript source` };
    } else if (arg === '--host') {
      host = args[++index];
      if (!host) return { error: '--host requires a value' };
    } else if (arg === '--port') {
      port = Number(args[++index]);
      if (!Number.isInteger(port) || port < 1 || port > 65535) return { error: '--port requires a valid port' };
    } else if (arg.startsWith('-')) {
      return { error: `unknown option: ${arg}` };
    } else if (source !== undefined || sourcePath !== undefined) {
      return { error: 'run accepts exactly one inline source or script file' };
    } else {
      sourcePath = path.resolve(arg);
    }
  }

  if (source === undefined && sourcePath === undefined) return { error: 'run requires -c or a script file' };
  if (sourcePath !== undefined) {
    try {
      source = fs.readFileSync(sourcePath, 'utf8');
    } catch (error) {
      return { error: `could not read ${sourcePath}: ${error.message}` };
    }
  }
  return { source, host, port };
}

async function run(args) {
  const parsed = parseRunArgs(args);
  if (parsed.error) return fail(parsed.error);

  try {
    const response = await runSource(parsed.source, { host: parsed.host, port: parsed.port });
    console.log(JSON.stringify(response));
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    console.error(`arc: ${error.message}`);
    process.exitCode = 1;
  }
}

async function main(args) {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(usage());
    return;
  }
  const [command, ...commandArgs] = args;
  if (command === 'run') return run(commandArgs);
  return fail(`unknown command: ${command}`);
}

module.exports = { main };
