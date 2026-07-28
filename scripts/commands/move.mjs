import { moveAndObserve } from "../lib/actions/move.mjs";

export default JSON.stringify(moveAndObserve({ x: __MOVE_X__, y: __MOVE_Y__, radius: __MOVE_RADIUS__ }));
