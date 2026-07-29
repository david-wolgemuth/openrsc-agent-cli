import { readPosition, samePosition, waitForStablePosition } from "../position.mjs";
import { captureEvents } from "../events.mjs";

var MAP_RADIUS = 2;
var ENTITY_RADIUS = 5;
var DEFAULT_QUIET_MS = 2000;
var DEFAULT_SETTLE_DEADLINE_MS = 30000;
var DEFAULT_NAVIGATION_DEADLINE_MS = 90000;
var DEFAULT_MAX_PATH_LEGS = 8;

function stage(name) {
  if (typeof bridge !== 'undefined' && bridge && bridge.stage) bridge.stage(name);
}

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
  var names = controller.getQuestNames ? controller.getQuestNames() : [];
  for (var i = 0; i < count; i += 1) {
    var name = names[i] === null || names[i] === undefined ? null : String(names[i]);
    if (!name || name === 'null') continue;
    result.push({ id: i, name: name, stage: Number(controller.getQuestStage(i)) });
  }
  return result;
}

function menuSnapshot() {
  var options = [];
  var count = Number(controller.getOptionMenuCount());
  for (var i = 0; i < count; i += 1) options.push({ index: i, text: String(controller.getOptionsMenuText(i)) });
  return { open: Boolean(controller.isInOptionMenu()), options: options };
}

function nearby(x, y, position) {
  return Math.abs(Number(x) - position.x) <= ENTITY_RADIUS && Math.abs(Number(y) - position.y) <= ENTITY_RADIUS;
}

function entitiesSnapshot(position) {
  var npcs = [];
  var npcObjects = controller.getNpcsAsArray ? controller.getNpcsAsArray() : [];
  for (var i = 0; i < npcObjects.length; i += 1) {
    var npc = npcObjects[i];
    var coords = controller.getNpcCoordsByServerIndex(Number(npc.serverIndex));
    if (nearby(coords[0], coords[1], position)) {
      npcs.push({ id: Number(npc.npcId), serverIndex: Number(npc.serverIndex), name: String(controller.getNpcName(Number(npc.npcId))), x: Number(coords[0]), y: Number(coords[1]) });
    }
  }

  function indexed(ids, xs, ys, count, nameForId, kind) {
    var output = [];
    for (var j = 0; j < Number(count); j += 1) {
      var x = Number(xs[j]);
      var y = Number(ys[j]);
      if (nearby(x, y, position)) output.push({ kind: kind, id: Number(ids[j]), name: String(nameForId(Number(ids[j]))), x: x, y: y });
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
    var itemX = Number(itemXs[k]);
    var itemY = Number(itemYs[k]);
    if (nearby(itemX, itemY, position)) groundItems.push({ kind: 'groundItem', id: Number(itemIds[k]), x: itemX, y: itemY, amount: Number(controller.getGroundItemAmount(Number(itemIds[k]), itemX, itemY)) });
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
  };
}

function inventoryChanges(before, after) {
  var result = [];
  var count = Math.max(before.items.length, after.items.length);
  for (var i = 0; i < count; i += 1) {
    var left = before.items[i] || null;
    var right = after.items[i] || null;
    if (JSON.stringify(left) !== JSON.stringify(right)) result.push({ slot: i, before: left, after: right });
  }
  return result;
}

function questChanges(before, after) {
  var result = [];
  var all = {};
  var i;
  for (i = 0; i < before.length; i += 1) all[before[i].id] = { before: before[i] };
  for (i = 0; i < after.length; i += 1) all[after[i].id] = all[after[i].id] || {};
  for (var id in all) {
    var entry = all[id];
    var afterEntry = null;
    for (i = 0; i < after.length; i += 1) if (String(after[i].id) === String(id)) afterEntry = after[i];
    if (JSON.stringify(entry.before || null) !== JSON.stringify(afterEntry)) result.push({ id: Number(id), before: entry.before || null, after: afterEntry });
  }
  return result;
}

function classifyMove(input) {
  if (input.navigationFailure) return { ok: false, status: 'failed', outcome: input.navigationFailure, safeToAct: false };
  if (!input.loggedIn) return { ok: false, status: 'failed', outcome: 'logged_out', safeToAct: false };
  if (!input.running) return { ok: false, status: 'failed', outcome: 'client_stopped', safeToAct: false };
  if (!input.settled) return { ok: false, status: 'indeterminate', outcome: 'settle_timeout', safeToAct: false };
  if (!input.integrityPassed) return { ok: false, status: 'indeterminate', outcome: 'state_changed_during_observation', safeToAct: false };
  if (input.inCombat) return { ok: false, status: 'failed', outcome: 'combat_interrupted', safeToAct: false };
  if (input.finalDistance <= input.radius) {
    return { ok: true, status: 'succeeded', outcome: input.initialDistance <= input.radius ? 'already_at_target' : 'reached', safeToAct: true };
  }
  return { ok: false, status: 'failed', outcome: 'not_reached', safeToAct: false };
}

function walkPathLeg(target) {
  var MapPoint = Java.type('models.entities.MapPoint');
  botController.pathWalkerApi.walkTo(new MapPoint(target.x, target.y));
}

function navigateInPathLegs(target, options) {
  var config = options || {};
  var read = config.readPosition || readPosition;
  var distance = config.distanceTo || distanceTo;
  var walkLeg = config.walkLeg || walkPathLeg;
  var now = config.now || function () { return Date.now(); };
  var pendingIdleMove = config.pendingIdleMove || function () { return Boolean(controller.getNeedToMove()); };
  var inCombat = config.inCombat || function () { return Boolean(controller.isInCombat()); };
  var maxLegs = config.maxLegs === undefined ? DEFAULT_MAX_PATH_LEGS : config.maxLegs;
  var deadlineMs = config.deadlineMs === undefined ? DEFAULT_NAVIGATION_DEADLINE_MS : config.deadlineMs;
  var startedAt = now();
  var legs = [];
  var position = read();
  var currentDistance = distance(target);

  while (currentDistance > target.radius) {
    if (pendingIdleMove()) return { position: position, distance: currentDistance, legs: legs, elapsedMs: now() - startedAt, failure: 'anti_idle_pending' };
    if (inCombat()) return { position: position, distance: currentDistance, legs: legs, elapsedMs: now() - startedAt, failure: 'combat_interrupted' };
    if (legs.length >= maxLegs) return { position: position, distance: currentDistance, legs: legs, elapsedMs: now() - startedAt, failure: 'path_leg_limit' };
    if (now() - startedAt >= deadlineMs) return { position: position, distance: currentDistance, legs: legs, elapsedMs: now() - startedAt, failure: 'path_deadline' };

    var before = position;
    var beforeDistance = currentDistance;
    stage('path_leg_' + (legs.length + 1) + '_started');
    walkLeg(target);
    position = read();
    currentDistance = distance(target);
    var leg = { index: legs.length + 1, from: before, to: position, distanceBefore: beforeDistance, distanceAfter: currentDistance };
    legs.push(leg);
    stage('path_leg_' + leg.index + '_finished');

    if (samePosition(before, position)) return { position: position, distance: currentDistance, legs: legs, elapsedMs: now() - startedAt, failure: 'path_no_progress' };
    if (currentDistance > beforeDistance + target.radius) return { position: position, distance: currentDistance, legs: legs, elapsedMs: now() - startedAt, failure: 'path_off_route' };
  }

  return { position: position, distance: currentDistance, legs: legs, elapsedMs: now() - startedAt, failure: null };
}

function captureScene(position, errors) {
  var entities = safeCall(errors, 'scene.entities', { npcs: [], objects: [], walls: [], groundItems: [] }, function () { return entitiesSnapshot(position); });
  return {
    map: safeCall(errors, 'scene.map', {}, function () { return compactMap(position, entities, MAP_RADIUS); }),
    npcs: entities.npcs,
    objects: entities.objects,
    walls: entities.walls,
    groundItems: entities.groundItems,
    menu: safeCall(errors, 'scene.menu', { open: false, options: [] }, menuSnapshot),
  };
}

function captureEventsOptional(cursor, errors) {
  if (cursor === null) return { events: [], nextCursor: null };
  return safeCall(errors, 'events', { events: [], nextCursor: cursor }, function () { return captureEvents(cursor); });
}

function moveAndObserve(options) {
  var target = { x: Number(options.x), y: Number(options.y), radius: Number(options.radius) };
  var startedAt = Date.now();
  var observationErrors = [];
  var before;
  var cursor = safeCall(observationErrors, 'before.eventCursor', null, function () { return Number(messages.cursor()); });
  try {
    stage('before_capture_started');
    before = readPosition();
    var beforeInventory = safeCall(observationErrors, 'before.inventory', { slots: null, items: [] }, inventorySnapshot);
    var beforeQuests = safeCall(observationErrors, 'before.quests', [], questSnapshot);
    var initialDistance = distanceTo(target);
    stage('before_capture_finished');
    var controllerReturned = false;
    var atControllerReturn = before;
    var atControllerReturnDistance = initialDistance;
    var atControllerReturnWalkingSample = safeCall(observationErrors, 'controllerReturn.walking', null, function () { return Boolean(controller.isCurrentlyWalking()); });
    stage('navigation_started');
    var navigation = navigateInPathLegs(target);
    stage('navigation_finished');
    controllerReturned = navigation.legs.length > 0;
    atControllerReturn = navigation.position;
    atControllerReturnDistance = navigation.distance;
    atControllerReturnWalkingSample = Boolean(controller.isCurrentlyWalking());
    var walkMs = navigation.elapsedMs;
    stage('settlement_started');
    var settlement = waitForStablePosition({ quietMs: DEFAULT_QUIET_MS, deadlineMs: DEFAULT_SETTLE_DEADLINE_MS });
    stage('settlement_finished');
    var afterPosition = settlement.position;
    var observation = null;
    var integrityPosition = afterPosition;
    var integrityPassed = false;
    var observationMsStarted = Date.now();
    stage('observation_started');
    for (var attempt = 0; attempt < 2; attempt += 1) {
      observation = {
        scene: captureScene(afterPosition, observationErrors),
        inventory: safeCall(observationErrors, 'after.inventory', { slots: null, items: [] }, inventorySnapshot),
        quests: safeCall(observationErrors, 'after.quests', [], questSnapshot),
        eventResult: captureEventsOptional(cursor, observationErrors),
      };
      integrityPosition = readPosition();
      if (samePosition(integrityPosition, afterPosition)) {
        integrityPassed = true;
        break;
      }
      if (attempt === 0) {
        settlement = waitForStablePosition({ quietMs: DEFAULT_QUIET_MS, deadlineMs: DEFAULT_SETTLE_DEADLINE_MS });
        afterPosition = settlement.position;
      }
    }
    var finalDistance = distanceTo(target);
    var loggedIn = Boolean(controller.isLoggedIn());
    var loaded = Boolean(controller.isLoaded());
    var running = Boolean(controller.isRunning());
    var inCombat = Boolean(controller.isInCombat());
    var classification = classifyMove({ initialDistance: initialDistance, finalDistance: finalDistance, radius: target.radius, settled: settlement.settled, loggedIn: loggedIn, running: running, inCombat: inCombat, integrityPassed: integrityPassed, navigationFailure: navigation.failure });
    stage('observation_finished');
    stage('result_classified');
    var finalInventory = observation.inventory;
    var finalQuests = observation.quests;
    var finalPosition = integrityPosition;
    return {
      ok: classification.ok, status: classification.status, outcome: classification.outcome, safeToAct: classification.safeToAct,
      action: { type: 'move', target: target },
      before: { position: before },
      completion: { controllerReturned: controllerReturned, atControllerReturn: { position: atControllerReturn, distance: atControllerReturnDistance, walkingSample: atControllerReturnWalkingSample }, navigation: { legs: navigation.legs, failure: navigation.failure }, settled: settlement.settled, settleElapsedMs: settlement.elapsedMs },
      after: { position: finalPosition, distance: finalDistance, reached: settlement.settled && finalDistance <= target.radius, walkingSample: safeCall(observationErrors, 'after.walking', null, function () { return Boolean(controller.isCurrentlyWalking()); }), loggedIn: loggedIn, loaded: loaded, running: running, inCombat: inCombat, inventoryChanges: inventoryChanges(beforeInventory, finalInventory), questChanges: questChanges(beforeQuests, finalQuests) },
      timing: { walkMs: walkMs, settleMs: settlement.elapsedMs, observationMs: Date.now() - observationMsStarted, totalMs: Date.now() - startedAt },
      events: observation.eventResult.events, nextCursor: observation.eventResult.nextCursor, scene: observation.scene, observationErrors: observationErrors,
    };
  } catch (error) {
    return { ok: false, status: 'failed', outcome: 'controller_error', safeToAct: false, action: { type: 'move', target: target }, before: before ? { position: before } : {}, completion: {}, after: {}, timing: { totalMs: Date.now() - startedAt }, events: [], observationErrors: observationErrors.concat([{ field: 'controller', message: String(error.message || error) }]) };
  }
}

export { moveAndObserve, waitForStablePosition, classifyMove, navigateInPathLegs };
