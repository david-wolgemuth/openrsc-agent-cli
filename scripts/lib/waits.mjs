/*
 * Polling helpers for long-running IdleRSC actions.
 *
 * Module bodies intentionally use ES5-compatible JavaScript because the
 * bundled payload runs on Nashorn in Java 8. ESM import/export is removed by
 * the CLI bundler before the payload reaches IdleRSC.
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

function walkToAndReport(x, y, radius) {
  var distance = radius === undefined ? 2 : radius;
  controller.walkTo(x, y, distance, true, true);
  var finalX = controller.currentX();
  var finalY = controller.currentY();
  var remaining = controller.getDistanceFromLocalPlayer(x, y);
  return {
    success: remaining <= distance,
    requested: [x, y],
    final: [finalX, finalY],
    distance: remaining,
  };
}

function walkRoute(points, radius) {
  var distance = radius === undefined ? 2 : radius;
  var legs = [];
  for (var i = 0; i < points.length; i += 1) {
    var point = points[i];
    var leg = walkToAndReport(point[0], point[1], distance);
    legs.push(leg);
    if (!leg.success) return { success: false, legs: legs };
  }
  return { success: true, legs: legs };
}

export {
  waitFor,
  waitForLocation,
  waitForItem,
  waitForOptionMenu,
  selectOptionContaining,
  walkToAndReport,
  walkRoute,
};
