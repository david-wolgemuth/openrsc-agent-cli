const fs = require('node:fs');
const path = require('node:path');
const { runSource } = require('./socketClient');
const { SCRIPT_ROOT, bundleScript, validateEntryPath } = require('./bundler');

const DEFAULT_HOST = process.env.ARC_HOST || '127.0.0.1';
const DEFAULT_PORT = Number(process.env.ARC_PORT || 8765);
const DEFAULT_TIMEOUT_MS = Number(process.env.IRSC_TIMEOUT_MS || 10000);

function usage() {
  return [
    'Usage:',
    '  ./irsc run -c "javascript source"',
    '  ./irsc run <script.js>',
    '  ./irsc inspect',
    '  ./irsc map [--radius <n>]',
    '  ./irsc logs [--tail <n>] [--type <type>] [--file <path>]',
    '',
    'Options:',
    '  --host <host>  Bridge host (default: 127.0.0.1)',
    '  --port <port>  Bridge port (default: 8765)',
    '  --timeout <ms> Request timeout (default: 10000)',
  ].join('\n');
}

function parseLogsArgs(args) {
  let file;
  let tail = 50;
  let type;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--file') {
      file = args[++index];
      if (!file) return { error: '--file requires a path' };
    } else if (arg === '--tail') {
      tail = Number(args[++index]);
      if (!Number.isInteger(tail) || tail < 1) return { error: '--tail requires a positive number' };
    } else if (arg === '--type') {
      type = args[++index];
      if (!type) return { error: '--type requires a message type' };
    } else {
      return { error: `unknown logs option: ${arg}` };
    }
  }
  return { file, tail, type };
}

function latestMessageLog() {
  const logDirectory = path.resolve('logs');
  if (!fs.existsSync(logDirectory)) return undefined;
  const candidates = fs.readdirSync(logDirectory)
    .filter((name) => name.startsWith('idlersc-bridge-messages-') && name.endsWith('.jsonl'))
    .map((name) => path.join(logDirectory, name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  return candidates[0];
}

function logs(args) {
  const parsed = parseLogsArgs(args);
  if (parsed.error) return fail(parsed.error);
  const logPath = parsed.file ? path.resolve(parsed.file) : latestMessageLog();
  if (!logPath) return fail('no unified message log found');
  if (!fs.existsSync(logPath)) return fail(`message log does not exist: ${logPath}`);

  let events;
  try {
    events = fs.readFileSync(logPath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
  } catch (error) {
    return fail(`could not read message log: ${error.message}`);
  }
  if (parsed.type) {
    const wanted = parsed.type.toUpperCase();
    events = events.filter((event) => String(event.type).toUpperCase() === wanted);
  }
  console.log(JSON.stringify({ file: logPath, events: events.slice(-parsed.tail) }));
}

function fail(message) {
  console.error(`irsc: ${message}`);
  console.error(usage());
  process.exitCode = 2;
}

function parseRunArgs(args) {
  let source;
  let sourcePath;
  let host = DEFAULT_HOST;
  let port = DEFAULT_PORT;
  let timeoutMs = DEFAULT_TIMEOUT_MS;

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
    } else if (arg === '--timeout') {
      timeoutMs = Number(args[++index]);
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1) return { error: '--timeout requires a positive number of milliseconds' };
    } else if (arg.startsWith('-')) {
      return { error: `unknown option: ${arg}` };
    } else if (source !== undefined || sourcePath !== undefined) {
      return { error: 'run accepts exactly one inline source or script file' };
    } else {
      sourcePath = path.resolve(arg);
    }
  }

  if (source === undefined && sourcePath === undefined) return { error: 'run requires -c or a script file' };
  let entryPath;
  let resolveDir = SCRIPT_ROOT;
  if (sourcePath !== undefined) {
    try {
      entryPath = validateEntryPath(sourcePath);
      source = fs.readFileSync(entryPath, 'utf8');
      resolveDir = path.dirname(entryPath);
    } catch (error) {
      return { error: `could not read ${sourcePath}: ${error.message}` };
    }
  }
  return { source, entryPath, resolveDir, host, port, timeoutMs };
}

async function run(args) {
  const parsed = parseRunArgs(args);
  if (parsed.error) return fail(parsed.error);

  try {
    const bundledSource = await bundleScript(parsed);
    const response = await runSource(bundledSource, {
      host: parsed.host,
      port: parsed.port,
      timeoutMs: parsed.timeoutMs,
    });
    console.log(JSON.stringify(response));
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    console.error(`irsc: ${error.message}`);
    process.exitCode = 1;
  }
}

async function mapProbe(args) {
  let radius = 1;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== '--radius') return fail(`unknown map option: ${args[index]}`);
    radius = Number(args[++index]);
    if (!Number.isInteger(radius) || radius < 0 || radius > 3) {
      return fail('--radius must be an integer from 0 through 3');
    }
  }
  const source = `var p=walkability.around(${radius},false),r=[];for(var i=0;i<p.size();i++){var q=p.get(i);r.push({x:Number(q.getX()),y:Number(q.getY()),reachable:Boolean(q.isReachable())});}JSON.stringify({player:[controller.currentX(),controller.currentY()],radius:${radius},tiles:r});`;
  try {
    const response = await runSource(source, {
      host: DEFAULT_HOST,
      port: DEFAULT_PORT,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    console.log(JSON.stringify(response));
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    console.error(`irsc: ${error.message}`);
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
  if (command === 'inspect') return run(['scripts/inspect.js', ...commandArgs]);
  if (command === 'map') return mapProbe(commandArgs);
  if (command === 'logs') return logs(commandArgs);
  return fail(`unknown command: ${command}`);
}

module.exports = { main };
