/*
 * Read-only snapshot of the character and the nearby game scene.
 *
 * This is intentionally a script, rather than Java bridge code, so the
 * report can grow as the JavaScript API grows without rebuilding IdleRSC.
 */

function countedNames(ids, nameForId) {
  var counts = {};
  for (var i = 0; i < ids.length; i += 1) {
    var id = ids[i];
    var name = nameForId(id);
    var key = id + ":" + name;
    counts[key] = (counts[key] || 0) + 1;
  }

  var result = [];
  for (var key in counts) {
    if (Object.prototype.hasOwnProperty.call(counts, key)) {
      result.push(key + (counts[key] > 1 ? " x" + counts[key] : ""));
    }
  }
  return result;
}

function limitedIds(values, count) {
  var result = [];
  for (var i = 0; i < count; i += 1) result.push(values[i]);
  return result;
}

var npcIds = controller.getNpcsAsIntArray();
var objectIds = limitedIds(controller.getObjectsIds(), controller.getObjectsCount());
var wallIds = limitedIds(controller.getWallObjectIds(), controller.getWallObjectsCount());

var lines = [
  "player=" + controller.getPlayerName(),
  "loggedIn=" + controller.isLoggedIn(),
  "loaded=" + controller.isLoaded(),
  "running=" + controller.isRunning(),
  "coordinates=" + controller.currentX() + "," + controller.currentY(),
  "location=" + botController.playerApi.getCurrentLocation(),
  "fatigue=" + botController.playerApi.getFatigue(),
  "sleeping=" + botController.playerApi.isSleeping(),
  "walking=" + controller.isCurrentlyWalking(),
  "inventorySlots=" + controller.getInventoryItemCount(),
  "nearestBank=" + botController.bankApi.getNearestBankPoint(),
  "nearbyNpcs=" + countedNames(npcIds, function (id) { return controller.getNpcName(id); }).join(", "),
  "nearbyObjects=" + countedNames(objectIds, function (id) { return controller.getObjectName(id); }).join(", "),
  "nearbyWalls=" + countedNames(wallIds, function (id) { return controller.getWallObjectName(id); }).join(", ")
];

lines.join("\n");
