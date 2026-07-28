import { readPosition, waitForStablePosition } from "../position.mjs";
import { captureEvents } from "../events.mjs";

var MAP_RADIUS = 2;
var DEFAULT_QUIET_MS = 2000;
var DEFAULT_SETTLE_DEADLINE_MS = 30000;

function distanceTo(target) {
  return Number(controller.getDistanceFromLocalPlayer(target.x, target.y));
}

function safeCall(errors, name, fallback, fn) {
  try { return fn(); } catch (error) {
    errors.push({ field: name, message: String(error.message || error) });
    return fallback;
  }
}

function inventorySnapshot() {
  var result = { slots: Number(controller.getInventoryItemCount()), items: [] };
  for (var i = 0; i < result.slots; i += 1) {
    var id = Number(controller.getInventorySlotItemId(i));
    result.items.push({ slot: i, id: id, count: Number(controller.getInventoryItemCount(id)) });
  }
  return result;
}

function questSnapshot() {
  var result = [];
  if (!controller.getQuestsCount || !controller.getQuestStage) return result;
  var count = Number(controller.getQuestsCount());
  for (var i = 0; i < count; i += 1) {
    result.push({
      id: i,
      name: controller.getQuestNames ? String(controller.getQuestNames()[i]) : null,
      stage: Number(controller.getQuestStage(i)),
    });
  }
  return result;
}

function menuSnapshot() {
  var options = [];
  var count = Number(controller.getOptionMenuCount());
  for (var i = 0; i < count; i += 1) options.push({ index: i, text: String(controller.getOptionsMenuText(i)) });
  return { open: Boolean(controller.isInOptionMenu()), options: options };
}

function entitiesSnapshot() {
  var npcs = [];
  var npcObjects = controller.getNpcsAsArray ? controller.getNpcsAsArray() : [];
  for (var i = 0; i < npcObjects.length; i += 1) {
    var npc = npcObjects[i];
    var coords = controller.getNpcCoordsByServerIndex(Number(npc.serverIndex));
    npcs.push({ id: Number(npc.npcId), serverIndex: Number(npc.serverIndex), name: String(controller.getNpcName(Number(npc.npcId))), x: Number(coords[0]), y: Number(coords[1]) });
  }
  function indexed(ids, xs, ys, count, nameForId, kind) {
    var output = [];
    for (var j = 0; j < Number(count); j += 1) {
      var id = Number(ids[j]);
      output.push({ kind: kind, id: id, name: String(nameForId(id)), x: Number(xs[j]), y: Number(ys[j]) });
    }
    return output;
  }
  var objects = indexed(controller.getObjectsIds(), controller.getObjectsX(), controller.getObjectsZ(), controller.getObjectsCount(), function (id) { return controller.getObjectName(id); }, 'object');
  var walls = indexed(controller.getWallObjectIds(), controller.getWallObjectsX(), controller.getWallObjectsZ(), controller.getWallObjectsCount(), function (id) { return controller.getWallObjectName(id); }, 'wall');
  var groundItems = [];
  var itemIds = controller.getGroundItems();
  var itemXs = controller.getGroundItemsX();
  var itemYs = controller.getGroundItemsY();
  for (var k = 0; k < Number(controller.getGroundItemsCount()); k += 1) {
    groundItems.push({ kind: 'groundItem', id: Number(itemIds[k]), x: Number(itemXs[k]), y: Number(itemYs[k]), amount: Number(controller.getGroundItemAmount(Number(itemIds[k]), Number(itemXs[k]), Number(itemYs[k]))) });
  }
  return { npcs: npcs, objects: objects, walls: walls, groundItems: groundItems };
}

function compactMap(position, entities, radius) {
  var points = {};
  var probes = walkability.around(radius, false);
  for (var i = 0; i < probes.size(); i += 1) {
    var point = probes.get(i);
    points[Number(point.getX()) + ',' + Number(point.getY())] = Boolean(point.isReachable());
  }
  var overlays = {};
  function add(list, symbol) {
    for (var j = 0; j < list.length; j += 1) {
      var key = list[j].x + ',' + list[j].y;
      overlays[key] = overlays[key] ? '*' : symbol;
    }
  }
  add(entities.npcs, 'N'); add(entities.objects, 'O'); add(entities.walls, 'D'); add(entities.groundItems, 'I');
  var grid = [];
  for (var y = position.y + radius; y >= position.y - radius; y -= 1) {
    var line = '';
    for (var x = position.x - radius; x <= position.x + radius; x += 1) {
      var key = x + ',' + y;
      line += x === position.x && y === position.y ? '@' : (overlays[key] || (points[key] === undefined ? '?' : (points[key] ? '.' : '#')));
    }
    grid.push(line);
  }
  return {
    origin: { x: position.x, y: position.y }, radius: radius, north: 'up', grid: grid,
    legend: { '@': 'player', '.': 'reachable empty tile', '#': 'blocked or unreachable tile', '?': 'not evaluated', N: 'NPC', O: 'scenery object', D: 'door or wall object', I: 'ground item', '*': 'multiple entities' },
    entities: entities,
  };
}

function classifyMove(start, final, target, radius, settled, loggedIn, startDistance, finalDistance) {
  if (!loggedIn) return { ok: false, status: 'failed', outcome: 'logged_out', safeToAct: false };
  if (!settled) return { ok: false, status: 'indeterminate', outcome: 'settle_timeout', safeToAct: false };
  var initial = startDistance === undefined ? distanceTo(target) : startDistance;
  var remaining = finalDistance === undefined ? distanceTo(target) : finalDistance;
  if (remaining <= radius) {
    if (initial <= radius) return { ok: true, status: 'succeeded', outcome: 'already_at_target', safeToAct: true };
    return { ok: true, status: 'succeeded', outcome: 'reached', safeToAct: true };
  }
  return { ok: false, status: 'failed', outcome: 'not_reached', safeToAct: true };
}

function moveAndObserve(options) {
  var target = { x: Number(options.x), y: Number(options.y), radius: Number(options.radius) };
  var startedAt = Date.now();
  var observationErrors = [];
  var before;
  var cursor = null;
  try {
    before = readPosition();
    cursor = Number(messages.cursor());
    var beforeInventory = safeCall(observationErrors, 'before.inventory', { slots: null, items: [] }, inventorySnapshot);
    var beforeQuests = safeCall(observationErrors, 'before.quests', [], questSnapshot);
    var initialDistance = distanceTo(target);
    var controllerReturned = false;
    var atControllerReturn = before;
    var walkStarted = Date.now();
    if (initialDistance > target.radius) {
      controller.walkTo(target.x, target.y, target.radius, true, true);
      controllerReturned = true;
      atControllerReturn = readPosition();
    }
    var walkMs = Date.now() - walkStarted;
    var settlement = initialDistance <= target.radius
      ? { settled: true, position: before, elapsedMs: 0 }
      : waitForStablePosition({ quietMs: DEFAULT_QUIET_MS, deadlineMs: DEFAULT_SETTLE_DEADLINE_MS });
    var afterPosition = settlement.position;
    var loggedIn = safeCall(observationErrors, 'after.loggedIn', false, function () { return Boolean(controller.isLoggedIn()); });
    var finalDistance = distanceTo(target);
    var classification = classifyMove(before, afterPosition, target, target.radius, settlement.settled, loggedIn, initialDistance, finalDistance);
    var entities = safeCall(observationErrors, 'scene.entities', { npcs: [], objects: [], walls: [], groundItems: [] }, entitiesSnapshot);
    var scene = { map: {}, npcs: entities.npcs, objects: entities.objects, walls: entities.walls, groundItems: entities.groundItems, menu: safeCall(observationErrors, 'scene.menu', { open: false, options: [] }, menuSnapshot) };
    scene.map = safeCall(observationErrors, 'scene.map', {}, function () { return compactMap(afterPosition, entities, MAP_RADIUS); });
    var finalInventory = safeCall(observationErrors, 'after.inventory', { slots: null, items: [] }, inventorySnapshot);
    var finalQuests = safeCall(observationErrors, 'after.quests', [], questSnapshot);
    var eventResult = safeCall(observationErrors, 'events', { since: cursor, nextCursor: cursor, events: [] }, function () { return captureEvents(cursor); });
    return {
      ok: classification.ok, status: classification.status, outcome: classification.outcome, safeToAct: classification.safeToAct,
      action: { type: 'move', target: target },
      before: { position: before, distance: initialDistance, inventory: beforeInventory, quests: beforeQuests },
      completion: { controllerReturned: controllerReturned, atControllerReturn: { position: atControllerReturn, distance: distanceTo(target) }, settled: settlement.settled, settleElapsedMs: settlement.elapsedMs },
      after: { position: afterPosition, distance: finalDistance, reached: settlement.settled && finalDistance <= target.radius, walkingSample: safeCall(observationErrors, 'after.walking', null, function () { return Boolean(controller.isCurrentlyWalking()); }), loggedIn: loggedIn, loaded: safeCall(observationErrors, 'after.loaded', null, function () { return Boolean(controller.isLoaded()); }), running: safeCall(observationErrors, 'after.running', null, function () { return Boolean(controller.isRunning()); }), inventory: finalInventory, inventoryChanged: JSON.stringify(beforeInventory) !== JSON.stringify(finalInventory), quests: finalQuests, questChanges: JSON.stringify(beforeQuests) !== JSON.stringify(finalQuests) },
      timing: { walkMs: walkMs, settleMs: settlement.elapsedMs, observationMs: Date.now() - walkStarted - walkMs - settlement.elapsedMs, totalMs: Date.now() - startedAt },
      events: eventResult.events, nextCursor: eventResult.nextCursor, scene: scene, observationErrors: observationErrors,
    };
  } catch (error) {
    return { ok: false, status: 'failed', outcome: 'controller_error', safeToAct: false, action: { type: 'move', target: target }, before: before ? { position: before } : {}, completion: {}, after: {}, timing: { totalMs: Date.now() - startedAt }, events: [], observationErrors: [{ field: 'controller', message: String(error.message || error) }] };
  }
}

export { moveAndObserve, waitForStablePosition, classifyMove };
