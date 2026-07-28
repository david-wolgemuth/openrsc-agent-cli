function readPosition() {
  var location = null;
  try {
    if (typeof botController !== 'undefined'
        && botController.playerApi
        && botController.playerApi.getCurrentLocation) {
      location = String(botController.playerApi.getCurrentLocation());
    }
  } catch (_) {
    location = null;
  }

  return {
    x: Number(controller.currentX()),
    y: Number(controller.currentY()),
    z: null,
    location: location,
  };
}

function samePosition(left, right) {
  if (!left || !right || left.x !== right.x || left.y !== right.y) return false;
  if (left.z !== null && right.z !== null) return left.z === right.z;
  return left.location === right.location;
}

function waitForStablePosition(options) {
  var config = options || {};
  var pollMs = config.pollMs === undefined ? 200 : config.pollMs;
  var quietMs = config.quietMs === undefined ? 2000 : config.quietMs;
  var deadlineMs = config.deadlineMs === undefined ? 30000 : config.deadlineMs;
  var read = config.readPosition || readPosition;
  var sleep = config.sleep || function (milliseconds) { controller.sleep(milliseconds); };
  var now = config.now || function () { return Date.now(); };
  var startedAt = now();
  var last = read();
  var unchangedSince = startedAt;

  while (now() - startedAt < deadlineMs) {
    sleep(pollMs);
    var current = read();
    if (!samePosition(current, last)) {
      last = current;
      unchangedSince = now();
      continue;
    }
    if (now() - unchangedSince >= quietMs) {
      return { settled: true, position: current, elapsedMs: now() - startedAt };
    }
  }

  return { settled: false, position: read(), elapsedMs: now() - startedAt };
}

export { readPosition, samePosition, waitForStablePosition };
