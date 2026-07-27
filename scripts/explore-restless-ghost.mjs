/*
 * Bounded, observation-first exploration for the currently active Restless Ghost investigation.
 * This file contains no preloaded quest solution; callers can change the short experimental legs.
 */

function nearbyNpcs() {
  var result = [];
  var ids = controller.getNpcsAsIntArray();
  for (var i = 0; i < ids.length; i += 1) {
    result.push(String(ids[i]) + ":" + controller.getNpcName(ids[i]));
  }
  return result;
}

function nearbyObjects() {
  var result = [];
  var ids = controller.getObjectsIds();
  var count = controller.getObjectsCount();
  for (var i = 0; i < count; i += 1) {
    result.push(String(ids[i]) + ":" + controller.getObjectName(ids[i]));
  }
  return result;
}

function eventsSince(cursor) {
  var events = messages.since(cursor);
  var result = [];
  for (var i = 0; i < events.size(); i += 1) {
    var event = events.get(i);
    result.push({
      sequence: Number(event.getSequence()),
      type: String(event.getType()),
      sender: event.getSender() === null ? null : String(event.getSender()),
      text: event.getText() === null ? null : String(event.getText()),
    });
  }
  return result;
}

function snapshot(label, cursor) {
  return {
    label: label,
    coordinates: [controller.currentX(), controller.currentY()],
    walking: controller.isCurrentlyWalking(),
    loggedIn: controller.isLoggedIn(),
    questStage: controller.getQuestStage(4),
    npcs: nearbyNpcs(),
    objects: nearbyObjects(),
    events: eventsSince(cursor),
  };
}

function walkLeg(label, x, y, radius, timeoutMs, cursor) {
  var started = new Date().getTime();
  controller.walkToAsync(x, y, radius);
  var checkpoints = [];
  while (controller.isCurrentlyWalking() && new Date().getTime() - started < timeoutMs) {
    controller.sleep(500);
    if (checkpoints.length === 0 || checkpoints.length % 4 === 0) {
      checkpoints.push(snapshot(label + "-poll", cursor));
    }
  }
  var finished = !controller.isCurrentlyWalking();
  var result = snapshot(label + (finished ? "-end" : "-timeout"), cursor);
  result.requested = [x, y];
  result.radius = radius;
  result.success = finished && controller.getDistanceFromLocalPlayer(x, y) <= radius;
  result.checkpoints = checkpoints;
  return result;
}

var cursor = Number(messages.cursor());
var result = {
  started: snapshot("start", cursor),
  legs: [],
};

/* These are short experiments from the last verified swamp checkpoint. */
result.legs.push(walkLeg("swamp-south-east", 165, 700, 4, 12000, cursor));
if (result.legs[result.legs.length - 1].success) {
  result.legs.push(walkLeg("swamp-east", 185, 700, 4, 12000, cursor));
}
result.finished = snapshot("finished", cursor);
JSON.stringify(result);
