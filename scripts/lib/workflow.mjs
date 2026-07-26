/*
 * Generic bounded workflow helpers. A workflow step must still decide what
 * action is appropriate; this module only handles observability, deadlines,
 * and verification.
 */

import { observe } from "./observations.mjs";
import { waitFor } from "./waits.mjs";

function json(value) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function checkpoint(name, options) {
  var state = observe(options || {});
  state.checkpoint = name;
  controller.log("checkpoint " + name + " " + json(state));
  return state;
}

function waitForMovementComplete(timeoutMs) {
  return waitFor(function () {
    return !controller.isCurrentlyWalking();
  }, timeoutMs || 30000, 200);
}

function walkAndVerify(x, y, radius, timeoutMs) {
  var distance = radius === undefined ? 2 : radius;
  var before = observe({});
  controller.walkTo(x, y, distance, true, true);
  var stopped = waitForMovementComplete(timeoutMs || 30000);
  var remaining = controller.getDistanceFromLocalPlayer(x, y);
  var after = observe({});
  return {
    success: stopped && remaining <= distance,
    requested: [x, y],
    radius: distance,
    remaining: remaining,
    before: before,
    after: after,
  };
}

function pickupAndVerify(itemId, amount, timeoutMs) {
  var needed = amount || 1;
  var before = controller.getInventoryItemCount(itemId);
  var item = controller.getNearestItemById(itemId);
  if (item === null) {
    return { success: false, reason: "item-not-visible", itemId: itemId };
  }
  controller.pickupItem(item[0], item[1], itemId, false, true);
  var success = waitFor(function () {
    return controller.getInventoryItemCount(itemId) >= before + needed;
  }, timeoutMs || 15000, 200);
  return {
    success: success,
    itemId: itemId,
    requested: [item[0], item[1]],
    before: before,
    after: controller.getInventoryItemCount(itemId),
  };
}

function selectOptionContainingAndVerify(text, timeoutMs) {
  var wanted = String(text).toLowerCase();
  var count = controller.getOptionMenuCount();
  for (var i = 0; i < count; i += 1) {
    var option = controller.getOptionsMenuText(i);
    if (option !== null && String(option).toLowerCase().indexOf(wanted) !== -1) {
      controller.optionAnswer(i);
      return { success: true, index: i, text: option };
    }
  }
  return { success: false, reason: "option-not-visible", text: text };
}

function runStep(name, action, verify) {
  var started = new Date().toISOString();
  controller.log("step-start " + name);
  var result;
  try {
    result = action();
    if (verify && result && result.success) result.verified = Boolean(verify(result));
    if (result && result.success === undefined) result.success = true;
  } catch (error) {
    result = { success: false, reason: String(error) };
  }
  result = result || { success: false, reason: "no-result" };
  result.step = name;
  result.started = started;
  result.finished = new Date().toISOString();
  controller.log("step-result " + name + " " + json(result));
  return result;
}

export {
  checkpoint,
  waitForMovementComplete,
  walkAndVerify,
  pickupAndVerify,
  selectOptionContainingAndVerify,
  runStep,
};
