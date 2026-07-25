/**
 * Curated JSDoc for the Java objects injected into an IdleRSC JavaScript
 * runtime. This file is documentation only: `controller` and `botController`
 * are created by the bridge and already exist when a script is evaluated.
 *
 * The typedefs intentionally describe the useful scripting surface rather
 * than every public method on the Java classes. Add entries incrementally as
 * real scripts need them, and verify each signature against the pinned
 * IdleRSC source before documenting it.
 */

/**
 * The native IdleRSC controller.
 *
 * @typedef {Object} Controller
 * @property {() => boolean} isLoaded Whether the game client is loaded.
 * @property {() => boolean} isLoggedIn Whether the player is in the game.
 * @property {() => boolean} isRunning Whether the native script is running.
 * @property {() => number} currentX Current local-player X coordinate.
 * @property {() => number} currentY Current local-player Y coordinate.
 * @property {(itemId?: number) => number} getInventoryItemCount Total occupied slots, or count of an item.
 * @property {(itemId: number) => boolean} isItemInInventory Whether inventory contains an item.
 * @property {(slotIndex: number) => number} getInventorySlotItemId Item ID in an inventory slot.
 * @property {(itemId: number) => number} getInventoryItemSlotIndex Inventory slot, or -1 when absent.
 * @property {() => number} getFightMode Current fight mode.
 * @property {() => boolean} isCurrentlyWalking Whether the player is currently walking.
 * @property {(x: number, y: number) => number} getDistanceFromLocalPlayer Distance to a coordinate.
 * @property {(x: number, y: number) => boolean} isCloseToCoord Whether the player is near a coordinate.
 * @property {(x: number, y: number) => void} walkTo Walk to a coordinate and wait for completion.
 * @property {(x: number, y: number, radius?: number, forced?: boolean, leaveCombat?: boolean) => void} walkTo Walk with optional radius and behavior options.
 * @property {(x: number, y: number, radius: number) => void} walkToAsync Start a non-blocking walk request.
 * @property {(x: number, y: number) => boolean} walkTowards Walk one step toward a coordinate.
 * @property {() => boolean} walkTowardsBank Walk toward the nearest bank.
 * @property {(objectId: number) => ?number[]} getNearestObjectById Coordinate pair, or null.
 * @property {(itemId: number) => ?number[]} getNearestItemById Coordinate pair, or null.
 * @property {(itemId: number, maxDistance?: number) => ?number[]} getNearestItemById Coordinate pair, optionally within a distance.
 * @property {(npcId: number, inCombatAllowed: boolean) => ?Object} getNearestNpcById Nearest NPC, or null.
 * @property {(x: number, y: number) => boolean} isTileEmpty Whether a tile is empty.
 * @property {(x: number, y: number) => boolean} isDoorOpen Whether a door is open.
 * @property {(x: number, y: number) => void} openDoor Open a door at a coordinate.
 * @property {(x: number, y: number) => void} closeDoor Close a door at a coordinate.
 * @property {(message: string, color?: string) => void} log Write a message to the IdleRSC script log.
 * @property {(status: string) => void} setStatus Set the in-client bot status text.
 * @property {(milliseconds: number) => void} sleep Pause the current script for milliseconds.
 */

/**
 * The existing IdleRSC convenience controller and its grouped APIs.
 *
 * @typedef {Object} BotController
 * @property {() => boolean} inRunningMode Whether IdleRSC reports the script as running.
 * @property {(ticks: number) => boolean} sleepTicks Sleep in game ticks.
 * @property {(status: string) => void} setStatus Set the in-client bot status text.
 * @property {(message: string) => void} log Write an informational bot log.
 * @property {(message: string) => void} debug Write a debug bot log.
 * @property {(message: string) => void} warn Write a warning bot log.
 * @property {PlayerApi} playerApi Player state, inventory, and movement helpers.
 * @property {EnvironmentApi} environmentApi Nearby objects and ground-item helpers.
 * @property {BankApi} bankApi Banking helpers.
 * @property {PathWalkerApi} pathWalkerApi Calculated path-walking helpers.
 */

/**
 * @typedef {Object} PlayerApi
 * @property {() => MapPoint} getCurrentLocation
 * @property {() => number} getFatigue
 * @property {() => boolean} isFatigueZero
 * @property {() => boolean} isSleeping
 * @property {(point: MapPoint) => void} walkTo
 * @property {() => boolean} isInventoryFull
 * @property {(itemIds: ItemId[]) => boolean} hasItemsInInventory
 * @property {(index: ItemSlotIndex) => void} dropInventoryItem
 */

/**
 * @typedef {Object} EnvironmentApi
 * @property {(objectIds: ObjectIds) => JavaOptional} getNearestInteractable
 * @property {(itemId: ItemId) => JavaOptional} getNearestItem
 * @property {(groundItem: GroundItem) => boolean} isGroundItemPresent
 */

/**
 * @typedef {Object} BankApi
 * @property {() => boolean} areBankersVisible
 * @property {() => void} open
 * @property {() => boolean} isInterfaceOpen
 * @property {(itemIds: number[]) => void} deposit
 * @property {() => void} close
 * @property {() => MapPoint} getNearestBankPoint
 */

/**
 * @typedef {Object} PathWalkerApi
 * @property {(point: MapPoint) => void} walkTo
 */

/**
 * @typedef {Object} MapPoint
 * @property {() => number} getX
 * @property {() => number} getY
 */

/**
 * @typedef {Object} JavaOptional
 * @property {() => boolean} isPresent
 * @property {() => Object} get
 */

/**
 * @typedef {Object} ItemId
 * @property {() => number} getId
 */

/**
 * @typedef {Object} ItemSlotIndex
 * @property {() => number} getIndex
 */

/**
 * @typedef {Object} ObjectIds
 * @property {() => Set} getIds
 */

/**
 * @typedef {Object} GroundItem
 * @property {() => ItemId} getId
 * @property {() => MapPoint} getPoint
 */

/**
 * Runtime globals supplied by BridgeScript/ScriptWorker:
 *
 * @name controller
 * @global
 * @type {Controller}
 */

/**
 * @name botController
 * @global
 * @type {BotController}
 */
