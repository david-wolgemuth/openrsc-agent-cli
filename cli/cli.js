const fs = require('node:fs');
const path = require('node:path');
const { runSource } = require('./socketClient');
const { SCRIPT_ROOT, bundleScript, validateEntryPath } = require('./bundler');

const DEFAULT_HOST = process.env.ARC_HOST || '127.0.0.1';
const DEFAULT_PORT = Number(process.env.ARC_PORT || 8765);
const DEFAULT_TIMEOUT_MS = Number(process.env.IRSC_TIMEOUT_MS || 10000);
const MOVE_TRANSPORT_TIMEOUT_MS = 120000;
const MOVE_COMMAND_PATH = path.join(SCRIPT_ROOT, 'commands', 'move.mjs');

function usage() {
  return [
    'Usage:',
    '  ./irsc observe [--full] [--fields <list>]',
    '  ./irsc entities [--type npc]',
    '  ./irsc map [--radius <n>]',
    '  ./irsc path <x> <y>',
    '  ./irsc move <x> <y> [--radius <n>]',
    '  ./irsc talk npc:<id> [--until menu] [--deadline <ms>]',
    '  ./irsc choose [--contains <text>] [--index <n>]',
    '  ./irsc events [--since <cursor>]',
    '  ./irsc run -c "javascript source"',
    '  ./irsc run <script.js>',
    '  ./irsc logs [--tail <n>] [--type <type>] [--file <path>]',
    '',
    'Global run options: --host <host> --port <port> --timeout <ms>',
  ].join('\n');
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: { code: 'INVALID_ARGUMENT', message } }));
  process.exitCode = 2;
}

function parseInteger(value, name, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer from ${min} through ${max}`);
  }
  return parsed;
}

function decodeResponse(response) {
  if (response && response.ok && typeof response.result === 'string') {
    try {
      return { ...response, result: JSON.parse(response.result) };
    } catch (_) {
      // Raw `run` is allowed to return a string. Semantic commands always return JSON.
    }
  }
  return response;
}

async function request(source, timeoutMs = DEFAULT_TIMEOUT_MS, { direct = false } = {}) {
  const response = await runSource(source, { host: DEFAULT_HOST, port: DEFAULT_PORT, timeoutMs });
  const decoded = decodeResponse(response);
  if (direct && decoded.ok && decoded.result && typeof decoded.result === 'object') {
    console.log(JSON.stringify(decoded.result));
    if (!decoded.result.ok) process.exitCode = 1;
    return decoded.result;
  }
  console.log(JSON.stringify(decoded));
  if (!decoded.ok) process.exitCode = 1;
  return decoded;
}

function latestMessageLog() {
  const directory = path.resolve('logs');
  if (!fs.existsSync(directory)) return undefined;
  return fs.readdirSync(directory)
    .filter((name) => name.startsWith('idlersc-bridge-messages-') && name.endsWith('.jsonl'))
    .map((name) => path.join(directory, name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0];
}

function logs(args) {
  let file; let tail = 50; let type;
  try {
    for (let index = 0; index < args.length; index += 1) {
      if (args[index] === '--file') file = args[++index] || (() => { throw new Error('--file requires a path'); })();
      else if (args[index] === '--tail') tail = parseInteger(args[++index], 'tail', { min: 1 });
      else if (args[index] === '--type') type = args[++index] || (() => { throw new Error('--type requires a message type'); })();
      else throw new Error(`unknown logs option: ${args[index]}`);
    }
    const logPath = file ? path.resolve(file) : latestMessageLog();
    if (!logPath) throw new Error('no unified message log found');
    const events = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse)
      .filter((event) => !type || String(event.type).toUpperCase() === type.toUpperCase());
    console.log(JSON.stringify({ ok: true, result: { file: logPath, events: events.slice(-tail) } }));
  } catch (error) { fail(error.message); }
}

function parseRunArgs(args) {
  let source; let sourcePath; let host = DEFAULT_HOST; let port = DEFAULT_PORT; let timeoutMs = DEFAULT_TIMEOUT_MS;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '-c' || arg === '--code') { if (source !== undefined || sourcePath) return { error: 'provide either -c or a script file, not both' }; source = args[++index]; if (source === undefined) return { error: `${arg} requires JavaScript source` }; }
    else if (arg === '--host') { host = args[++index]; if (!host) return { error: '--host requires a value' }; }
    else if (arg === '--port') { try { port = parseInteger(args[++index], 'port', { min: 1, max: 65535 }); } catch (error) { return { error: error.message }; } }
    else if (arg === '--timeout') { try { timeoutMs = parseInteger(args[++index], 'timeout', { min: 1 }); } catch (error) { return { error: error.message }; } }
    else if (arg.startsWith('-')) return { error: `unknown option: ${arg}` };
    else if (source !== undefined || sourcePath) return { error: 'run accepts exactly one inline source or script file' };
    else sourcePath = path.resolve(arg);
  }
  if (source === undefined && !sourcePath) return { error: 'run requires -c or a script file' };
  let entryPath; let resolveDir = SCRIPT_ROOT;
  if (sourcePath) { try { entryPath = validateEntryPath(sourcePath); source = fs.readFileSync(entryPath, 'utf8'); resolveDir = path.dirname(entryPath); } catch (error) { return { error: `could not read ${sourcePath}: ${error.message}` }; } }
  return { source, entryPath, resolveDir, host, port, timeoutMs };
}

async function run(args) {
  const parsed = parseRunArgs(args); if (parsed.error) return fail(parsed.error);
  try { const source = await bundleScript(parsed); const response = await runSource(source, parsed); console.log(JSON.stringify(decodeResponse(response))); if (!response.ok) process.exitCode = 1; }
  catch (error) { console.error(JSON.stringify({ ok: false, error: { code: 'BRIDGE_ERROR', message: error.message } })); process.exitCode = 1; }
}

function parseFields(args) {
  let full = false; let fields = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--full') full = true;
    else if (args[i] === '--fields') fields = (args[++i] || '').split(',').filter(Boolean);
    else throw new Error(`unknown observe option: ${args[i]}`);
  }
  return { full, fields };
}

function observationSource({ full, fields }) {
  const requested = JSON.stringify(fields);
  return `
var wanted=${requested},full=${full};
function include(n){return full||wanted.length===0||wanted.indexOf(n)!==-1;}
function names(ids,getName){var counts={},out=[];for(var i=0;i<ids.length;i++){var id=Number(ids[i]),name=String(getName(id));var key=id+":"+name;counts[key]=(counts[key]||0)+1;}for(var key in counts){out.push({id:Number(key.split(":")[0]),name:key.substring(key.indexOf(":")+1),count:counts[key]});}return out;}
var result={snapshot:{capturedAt:Date.now()},player:{name:String(controller.getPlayerName()),position:[Number(controller.currentX()),Number(controller.currentY())],loggedIn:Boolean(controller.isLoggedIn()),loaded:Boolean(controller.isLoaded()),walking:Boolean(controller.isCurrentlyWalking())}};
if(include('inventory'))result.inventory={slots:Number(controller.getInventoryItemCount())};
if(include('npcs'))result.npcs=names(controller.getNpcsAsIntArray(),function(id){return controller.getNpcName(id);});
if(full||include('objects')){var a=controller.getObjectsIds(),n=controller.getObjectsCount(),ids=[];for(var j=0;j<n;j++)ids.push(a[j]);result.objects=names(ids,function(id){return controller.getObjectName(id);});}
if(full||include('walls')){var w=controller.getWallObjectIds(),wn=controller.getWallObjectsCount(),wids=[];for(var k=0;k<wn;k++)wids.push(w[k]);result.walls=names(wids,function(id){return controller.getWallObjectName(id);});}
if(include('menu')){var options=[],c=controller.getOptionMenuCount();for(var m=0;m<c;m++)options.push({index:m,text:String(controller.getOptionsMenuText(m))});result.menu={open:Boolean(controller.isInOptionMenu()),options:options};}
JSON.stringify(result);`;
}

async function observe(args) { try { return await request(observationSource(parseFields(args))); } catch (error) { fail(error.message); } }

async function entities(args) {
  if (args.length !== 0 && !(args.length === 2 && args[0] === '--type' && args[1] === 'npc')) return fail('entities currently supports only --type npc');
  return observe(['--fields', 'npcs']);
}

async function mapProbe(args) {
  try {
    let radius = 3;
    if (args.length) { if (args.length !== 2 || args[0] !== '--radius') throw new Error('usage: map [--radius <0-3>]'); radius = parseInteger(args[1], 'radius', { min: 0, max: 3 }); }
    return await request(`var p=walkability.around(${radius},false),x=controller.currentX(),y=controller.currentY(),tiles=[],grid=[];for(var r=${radius};r>=-${radius};r--){var line='';for(var c=-${radius};c<=${radius};c++){var q=p.get((r+${radius})*(2*${radius}+1)+(c+${radius}));var here=c===0&&r===0;line+=here?'@':(q.isReachable()?'.':'#');tiles.push({x:Number(q.getX()),y:Number(q.getY()),reachable:Boolean(q.isReachable())});}grid.push(line);}JSON.stringify({origin:[Number(x),Number(y)],radius:${radius},north:'up',legend:'@ player, . reachable, # blocked',grid:grid,tiles:tiles});`);
  } catch (error) { fail(error.message); }
}

async function pathProbe(args) {
  try {
    if (args.length !== 2) throw new Error('usage: path <x> <y>');
    const x = parseInteger(args[0], 'x'); const y = parseInteger(args[1], 'y');
    return await request(`var x=${x},y=${y},from=[Number(controller.currentX()),Number(controller.currentY())],reachable=Boolean(walkability.isReachable(x,y,false));JSON.stringify({status:reachable?'reachable':'no_path',from:from,to:[x,y],distance:Number(controller.getDistanceFromLocalPlayer(x,y)),blockerType:reachable?null:'unknown'});`);
  } catch (error) { fail(error.message); }
}

async function move(args) {
  try {
    if (args.length < 2) throw new Error('usage: move <x> <y> [--radius <n>]');
    const x = parseInteger(args[0], 'x'); const y = parseInteger(args[1], 'y'); let radius = 2;
    if (args.length > 2) {
      if (args.length !== 4 || args[2] !== '--radius') throw new Error(`unknown move option: ${args[2] || ''}`);
      radius = parseInteger(args[3], 'radius', { min: 0, max: 20 });
    }
    const template = fs.readFileSync(MOVE_COMMAND_PATH, 'utf8');
    const source = template.replace('__MOVE_X__', String(x)).replace('__MOVE_Y__', String(y)).replace('__MOVE_RADIUS__', String(radius));
    const bundled = await bundleScript({ source, resolveDir: path.dirname(MOVE_COMMAND_PATH), returnDefault: true });
    return await request(bundled, MOVE_TRANSPORT_TIMEOUT_MS, { direct: true });
  } catch (error) {
    if (/usage:|unknown move option|must be an integer/.test(error.message)) fail(error.message);
    else {
      console.error(JSON.stringify({ ok: false, status: 'failed', outcome: 'controller_error', safeToAct: false, error: { code: 'BRIDGE_ERROR', message: error.message } }));
      process.exitCode = 1;
    }
  }
}

function npcId(value) { const match = /^npc:(\d+)$/.exec(value || ''); if (!match) throw new Error('talk requires npc:<id>'); return Number(match[1]); }

async function talk(args) {
  try {
    const id = npcId(args[0]); let until = 'menu'; let deadline = DEFAULT_TIMEOUT_MS;
    for (let i = 1; i < args.length; i += 2) { if (args[i] === '--until') until = args[i + 1]; else if (args[i] === '--deadline') deadline = parseInteger(args[i + 1], 'deadline', { min: 1 }); else throw new Error(`unknown talk option: ${args[i]}`); }
    if (until !== 'menu') throw new Error('talk currently supports only --until menu');
    return await request(`var id=${id},started=Date.now(),npc=controller.getNearestNpcById(id,false),startedTalk=npc!==null&&Boolean(controller.talkToNpc(Number(npc.serverIndex)));while(startedTalk&&!controller.isInOptionMenu()&&Date.now()-started<${deadline})controller.sleep(100);var options=[],count=controller.getOptionMenuCount();for(var i=0;i<count;i++)options.push({index:i,text:String(controller.getOptionsMenuText(i))});JSON.stringify({dialogue:{npcId:id,status:controller.isInOptionMenu()?'waiting_for_choice':(startedTalk?'completed':'not_started'),elapsedMs:Date.now()-started,menu:{open:Boolean(controller.isInOptionMenu()),options:options}}});`, Math.max(DEFAULT_TIMEOUT_MS, deadline + 1000));
  } catch (error) { fail(error.message); }
}

async function choose(args) {
  try {
    let contains; let index;
    for (let i = 0; i < args.length; i += 2) { if (args[i] === '--contains') contains = args[i + 1]; else if (args[i] === '--index') index = parseInteger(args[i + 1], 'index', { min: 0 }); else throw new Error(`unknown choose option: ${args[i]}`); }
    if ((contains === undefined) === (index === undefined)) throw new Error('choose requires exactly one of --contains or --index');
    return await request(`var wanted=${JSON.stringify(contains || '')}.toLowerCase(),selected=${index === undefined ? '-1' : index},options=[],count=controller.getOptionMenuCount();for(var i=0;i<count;i++){var text=String(controller.getOptionsMenuText(i));options.push({index:i,text:text});if(selected===-1&&text.toLowerCase().indexOf(wanted)!==-1)selected=i;}var open=Boolean(controller.isInOptionMenu());if(open&&selected>=0&&selected<count)controller.optionAnswer(selected);JSON.stringify({choice:{status:open&&selected>=0&&selected<count?'selected':(open?'not_found':'no_menu'),selectedIndex:selected,options:options}});`);
  } catch (error) { fail(error.message); }
}

async function events(args) {
  try { let cursor = 0; if (args.length) { if (args.length !== 2 || args[0] !== '--since') throw new Error('usage: events [--since <cursor>]'); cursor = parseInteger(args[1], 'cursor', { min: 0 }); }
    return await request(`var cursor=${cursor},list=messages.since(cursor),events=[];for(var i=0;i<list.size();i++){var e=list.get(i);events.push({sequence:Number(e.getSequence()),timestamp:Number(e.getTimestamp()),type:String(e.getType()),sender:e.getSender()===null?null:String(e.getSender()),text:e.getText()===null?null:String(e.getText())});}JSON.stringify({cursor:cursor,nextCursor:Number(messages.cursor()),count:events.length,events:events});`);
  } catch (error) { fail(error.message); }
}

async function main(args) {
  if (!args.length) return observe([]);
  if (args[0] === '--help' || args[0] === '-h') return console.log(usage());
  const [command, ...rest] = args;
  if (command === 'run') return run(rest);
  if (command === 'inspect') return observe(['--full', ...rest]);
  if (command === 'observe') return observe(rest);
  if (command === 'entities') return entities(rest);
  if (command === 'map') return mapProbe(rest);
  if (command === 'path') return pathProbe(rest);
  if (command === 'move') return move(rest);
  if (command === 'talk') return talk(rest);
  if (command === 'choose') return choose(rest);
  if (command === 'events') return events(rest);
  if (command === 'logs') return logs(rest);
  return fail(`unknown command: ${command}`);
}

module.exports = { main, decodeResponse, parseRunArgs };
