# Implementation log: modules, waits, movement, and quest exploration

This log records the work and findings from the later IdleRSC bridge session.
The vendor submodule remained unchanged throughout.

## Module and runtime-library evolution

The original architecture notes describe a CLI-side module pipeline:

```text
modern/local JavaScript modules
  -> CLI bundler
  -> one flattened payload
  -> Java 8 Nashorn
```

The intended authoring model is explicit relative ESM imports, not implicit
globals or a magic bare module name. For example:

```js
import { waitForItem } from "./lib/waits.mjs";
```

File scripts resolve imports relative to their own file. Inline `-c` scripts
resolve relative imports from the repository's `scripts/` directory.

The first implementation automatically prepended `scripts/lib/waits.js` to
every payload. That was rejected because it created hidden globals and did
not match the documented ESM design. It was replaced with `cli/bundler.js`:

- esbuild bundles local imports;
- only files inside `scripts/` may be imported;
- `node:` and bare/external imports are rejected locally;
- ESM is flattened into an IIFE for Nashorn;
- ordinary non-module scripts are transformed without an IIFE so their final
  expression result remains available to the bridge response.

The JavaScript library itself is deliberately ES5-compatible. esbuild’s
current release does not lower `const`/ES2015 syntax to ES5; setting an ES5
target rejects such syntax rather than transforming it. Babel was briefly
installed to provide that lowering, but it was removed after deciding that
simple ES5 module bodies are the better Java 8/Nashorn baseline. ESM
`import`/`export` remains available because esbuild removes those boundaries
before evaluation.

Current runtime library:

```text
scripts/lib/waits.mjs
```

It exports `waitFor`, `waitForLocation`, `waitForItem`,
`waitForOptionMenu`, `selectOptionContaining`, `walkToAndReport`, and
`walkRoute`.

The CLI also supports `--timeout <milliseconds>` and `IRSC_TIMEOUT_MS`.

## Wait and movement findings

IdleRSC’s native `controller.walkTo(...)` is blocking. It returns after the
character reaches the requested tile/radius, enters combat, or reaches the
native walk timeout (observed as roughly 60 seconds). The bridge’s original
10-second socket timeout was therefore too short for many legitimate walks.

`walkToAsync` plus polling was tested but made failure reporting ambiguous:
the route could stop at an intermediate point while the caller believed the
action had completed. The preferred route contract is now:

1. call blocking `controller.walkTo` for one waypoint;
2. read the final coordinates;
3. compute remaining distance;
4. return success/failure for that leg;
5. continue only when the leg succeeded.

`walkToAndReport` implements this contract. `walkRoute` returns the reports
for completed legs and stops at the first failure. A future bridge protocol
should expose this same model as asynchronous jobs with job IDs, status, and
cancel, rather than relying on a client-side socket timeout.

## Screenshots and structured scene inspection

IdleRSC supports `controller.takeScreenshot(prefix)`. An empty prefix writes
the timestamped default filename; a non-empty prefix is added to the filename
under `Screenshots/<player>/`. Screenshots were useful for reading NPC speech
that is not exposed as structured API data.

The `./irsc inspect` command reports read-only state including:

- player name, login/load/script state;
- coordinates and `MapPoint` location;
- fatigue, sleeping, walking, and inventory slot count;
- nearest bank point;
- nearby NPC names/IDs;
- nearby object and wall names/IDs.

The live scene confirmed that `(131,1598)` was Lumbridge Castle’s Duke’s
Room. Nearby entities included the Duke of Lumbridge, ladders, beds, and
tables. The vendor `Location` data identifies the ground-floor kitchen near
`(135,660)` and the Duke’s Room near `(132,1603)`.

## Dialogue findings

There is no separate `acceptQuest()` API. Quest progress is normally a
server-side result of selecting NPC dialogue options. The useful methods are:

```js
controller.talkToNpcId(npcId, wait)
controller.isInOptionMenu()
controller.getOptionMenuCount()
controller.getOptionsMenuText(index)
controller.optionAnswer(index)
```

Option text is available, but NPC spoken text is not exposed as a clean
structured value. Screenshots or chat history are currently the fallback.
`selectOptionContaining` is intended to match option text instead of relying
on fragile numeric indexes.

The Duke presented:

```text
Have you any quests for me?
Where can I find money?
```

The Duke interaction demonstrated that options can be selected, although the
first test did not advance Rune Mysteries. The account’s Rune Mysteries stage
remained `0` and no Air Talisman appeared.

The Cook was later located by NPC ID `7` after navigating downstairs. The
Cook’s dialogue appeared visually, including a progress message about finding
ingredients. At that point Cook’s Assistant quest stage was `1`, with an egg
and later milk in inventory. This means the account was already in the active
ingredient-gathering phase by the time the quest exploration reached the Cook.

## Cook’s Assistant exploration

Cook’s Assistant is a sensible first quest for controlled testing because it
is local to Lumbridge and requires familiar ingredients:

- egg: item ID `19`;
- bucket: item ID `21`;
- milk: item ID `22`;
- pot: item ID `135`;
- pot of flour: item ID `136`.

The character was moved from the Duke’s Room down through the castle ladders,
then toward the chicken/cow area. The bucket was successfully picked up and
used on a cow; inventory inspection confirmed `egg=1`, `milk=1`, and the
bucket consumed. A subsequent long route toward the mill failed to reach its
target and left the character around `(124,629)`. This failure motivated the
final-coordinate route-reporting helper.

The quest was not completed in this session. The next safe continuation is to
use short, verified route legs toward the mill, collect grain, process it into
flour, and verify each inventory change before proceeding. The route should
not be copied wholesale from the vendor quest implementation unless that is
explicitly desired; the point of this session was to exercise the bridge and
understand the game state.

## Repository guidance and commits

`AGENTS.md` now tells future agents not to use the vendor’s AIOQuester quest
automation as an implementation shortcut. The upstream quest source remains
available for deliberate upstream research, but it should not be copied into
bridge-owned scripts accidentally.

Relevant commits from this session:

- `76a8883` — add configurable CLI timeout and initial wait helpers;
- `5167e30` — use ES5-compatible ESM libraries and remove Babel;
- `e7318f5` — preserve results for non-module scripts;
- `70294c1` — report verified route progress and final coordinates.
