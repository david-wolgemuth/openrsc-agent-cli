/*
 * Small, explicit observations for agent-driven scripts.
 *
 * These helpers do not contain quest knowledge. Callers choose which item,
 * quest, NPC, or object IDs are relevant to the current investigation.
 */

function inventorySnapshot(itemIds) {
  var result = {};
  var ids = itemIds || [];
  for (var i = 0; i < ids.length; i += 1) {
    result[String(ids[i])] = controller.getInventoryItemCount(ids[i]);
  }
  return result;
}

function questSnapshot(questIds) {
  var result = {};
  var ids = questIds || [];
  for (var i = 0; i < ids.length; i += 1) {
    result[String(ids[i])] = controller.getQuestStage(ids[i]);
  }
  return result;
}

function observe(options) {
  var config = options || {};
  return {
    time: new Date().toISOString(),
    loggedIn: controller.isLoggedIn(),
    loaded: controller.isLoaded(),
    running: controller.isRunning(),
    coordinates: [controller.currentX(), controller.currentY()],
    walking: controller.isCurrentlyWalking(),
    inventory: inventorySnapshot(config.itemIds),
    quests: questSnapshot(config.questIds),
    optionMenu: controller.isInOptionMenu(),
  };
}

function optionsMenu() {
  var result = [];
  var count = controller.getOptionMenuCount();
  for (var i = 0; i < count; i += 1) {
    result.push({ index: i, text: controller.getOptionsMenuText(i) });
  }
  return result;
}

export { inventorySnapshot, questSnapshot, observe, optionsMenu };
