# Restless Ghost exploration and batched workflows

## Current verified state

- Account: `traci`
- Active quest: `The restless ghost`, quest ID `4`
- Current stage: `1`
- Cook's Assistant (quest ID `1`) is complete.
- The Priest is NPC ID `9`; the Ghost is NPC ID `15` in the observed church/graveyard scene.
- Priest dialogue captured through `questMessageInterrupt`:

  - `Have you got rid of the ghost yet?`
  - `I can't find father Urhney at the moment`
  - Father Urhney is in the swamp; go around the back of the castle, through the western wood,
    then south and into the eastern depths.

- Verified swamp-like scenes:
  - `(141,690)`: bullrushes and rats.
  - `(177,687)`: bullrushes, trees, fires, and an Adventurer; Father Urhney was not visible.

- A later exploration settled at `(179,677)` near four Adventurers and a Goblin. One Adventurer
  offered `What are you camped out here for?` and `Do you know any good adventures I can go on?`.
  The adventure conversation was captured, but did not change quest stage `1`. A second Adventurer
  answered `We're looking for Zanaris` when asked why they were camped there. The Goblin reported
  `The Goblin does not appear interested in talking` through a `GAME` event.

## Movement findings

Native blocking `walkTo` calls normally complete quickly for reachable short legs, but an
unreachable target can occupy the synchronous bridge worker for roughly a minute. A client-side
request timeout does not cancel that Java worker. Repeating short blocking calls from the LLM is
therefore wasteful and can make the bridge appear unavailable.

The preferred exploration workflow is one bounded script containing several short asynchronous
legs. During each leg it should poll movement, inspect nearby entities, consume new unified
message events, and stop on a target, logout, combat, timeout, or repeated failure. It should
return compact checkpoint records rather than requiring one bridge request per action.

An async leg must settle before the next leg begins. If its deadline expires while
`isCurrentlyWalking()` is still true, the batch must stop and return the unfinished leg; issuing
another movement request at that point makes the resulting route ambiguous.

This is discovery support, not a preloaded quest route. Coordinates and actions belong in the
workflow only after they have been observed and verified during the current investigation.

## Unified message evidence

The bridge captures `QUEST`, `CHAT`, `GAME`, `PRIVATE_RECEIVE`, and `TRADE` callback events in a
bounded in-memory cursor stream and a durable JSONL file under `logs/`. `./irsc logs` reads that
file locally without consuming the single live bridge connection.

Useful commands:

```text
./irsc logs --tail 50
./irsc logs --tail 50 --type QUEST
./irsc logs --file logs/idlersc-bridge-messages-<timestamp>.jsonl
```

## Next experiment

Run the reusable exploration script from the current swamp checkpoint. It should try only a few
short asynchronous legs, report every endpoint and visible NPC/object, and stop before a long
unverified route is attempted.
