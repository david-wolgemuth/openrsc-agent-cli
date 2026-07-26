/*
 * Polling helpers for long-running IdleRSC actions.
 *
 * This file is intended to be bundled before user scripts are evaluated. It
 * deliberately uses ES5-compatible JavaScript because the bridge runtime is
 * Nashorn on Java 8.
 */

function waitFor(predicate, timeoutMs, pollMs) {
  var deadline = Date.now() + (timeoutMs || 30000);
  var interval = pollMs || 100;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    controller.sleep(interval);
  }
  return Boolean(predicate());
}

function waitForLocation(x, y, radius, timeoutMs) {
  var distance = radius === undefined ? 0 : radius;
  return waitFor(function () {
    return controller.getDistanceFromLocalPlayer(x, y) <= distance;
  }, timeoutMs, 200);
}

function waitForItem(itemId, amount, timeoutMs) {
  var needed = amount || 1;
  return waitFor(function () {
    return controller.getInventoryItemCount(itemId) >= needed;
  }, timeoutMs, 200);
}

function waitForOptionMenu(timeoutMs) {
  return waitFor(function () {
    return controller.isInOptionMenu();
  }, timeoutMs, 100);
}

function selectOptionContaining(text, timeoutMs) {
  if (!waitForOptionMenu(timeoutMs)) return false;
  var wanted = String(text).toLowerCase();
  var count = controller.getOptionMenuCount();
  for (var i = 0; i < count; i += 1) {
    var option = controller.getOptionsMenuText(i);
    if (option !== null && String(option).toLowerCase().indexOf(wanted) !== -1) {
      controller.optionAnswer(i);
      return true;
    }
  }
  return false;
}

function walkRoute(points, radius, timeoutMs) {
  var distance = radius === undefined ? 2 : radius;
  for (var i = 0; i < points.length; i += 1) {
    var point = points[i];
    controller.walkToAsync(point[0], point[1], distance);
    if (!waitForLocation(point[0], point[1], distance, timeoutMs)) return false;
  }
  return true;
}

export {
  waitFor,
  waitForLocation,
  waitForItem,
  waitForOptionMenu,
  selectOptionContaining,
  walkRoute,
};
