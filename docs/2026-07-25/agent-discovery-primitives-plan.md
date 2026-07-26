# Agent discovery primitives and future workflow plan

This plan follows the manual Cook's Assistant experiment. It deliberately
does not encode that quest's route or copy its upstream automation. The goal
is to help an agent discover and verify small actions in an unfamiliar world.

## Implemented initial slice

`scripts/lib/observations.mjs` provides explicit snapshots for coordinates,
login/load state, walking state, selected inventory IDs, selected quest IDs,
and dialogue-menu options. The caller supplies the IDs; the library does not
carry a hidden quest database.

`scripts/lib/workflow.mjs` provides bounded, observable primitives:

- `checkpoint(name, options)` logs a machine-readable state snapshot;
- `waitForMovementComplete(timeoutMs)` waits for native movement to settle;
- `walkAndVerify(x, y, radius, timeoutMs)` reports before/after state and the
  actual final distance;
- `pickupAndVerify(itemId, amount, timeoutMs)` searches for a visible item,
  requests a nonblocking pickup, and verifies the inventory transition;
- `selectOptionContainingAndVerify(text)` selects a visible dialogue option;
- `runStep(name, action, verify)` records a bounded step result.

These are intentionally low-level. They cannot determine what a quest means,
where an undiscovered target is, or which action should be attempted next.

## Mindset for using higher-level tools

Higher-level helpers should make reasoning more reliable, not replace it.
Before calling one, the agent should be able to answer:

1. What did I actually observe?
2. What am I hypothesizing from that observation?
3. What small action will test the hypothesis?
4. What state change would confirm or disprove it?
5. What is the safe stopping condition if the result is ambiguous?

For example, seeing an object near the player is an observation. Calling it a
mill, assuming it accepts grain, and assuming the resulting flour will appear
on a particular floor are separate hypotheses. A good workflow tests those
one at a time and records the result.

The intended division of responsibility is:

```text
agent reasoning     -> choose the next experiment
primitive library   -> perform it with bounded waits and verification
memory              -> preserve observations, outcomes, and uncertainty
```

`walkAndVerify` should answer “did I reach the requested area?” It should not
answer “where should I walk next?” `pickupAndVerify` should answer “did this
visible item enter inventory?” It should not decide that the item is relevant
to a quest. `searchUntil` may stop when a target criterion is observed, but it
must not conceal the search policy or silently import a known solution.

When an action fails, the next step is normally a fresh observation—not a
blind retry with a larger timeout. Repeated failure is useful information:
the target may be unreachable, the interaction may require a different command
option, the player may be on the wrong map layer, or the hypothesis may simply
be wrong.

Higher-level workflows should therefore be:

- explicit about their assumptions;
- idempotent where practical, so they can resume from a checkpoint;
- bounded by time, retries, inventory, combat, and login state;
- verbose about before/after state;
- willing to stop and return evidence instead of inventing success.

The long-term goal is not a universal quest solver that already knows every
answer. It is a disciplined loop in which the agent can safely turn small
observations into verified capabilities over time.

## Next layer: observations

Expand observation without smuggling in quest solutions:

1. Add nearby NPC/object/wall records with IDs, names, coordinates, and
   reachability where the public controller exposes those values.
2. Add dialogue state and recent option text to checkpoints.
3. Add a stable inventory listing rather than requiring callers to guess all
   relevant IDs.
4. Record action duration, timeout, final coordinates, and whether the native
   client is still walking after the bridge response.

Every observation should be distinguishable from an inference. For example,
“object ID 52 was visible at (166,2487)” is an observation; “this is the mill
 hopper” is agent interpretation and belongs in a note or plan.

## Exploration behaviors

Build generic search behaviors rather than quest scripts:

- `searchVisible(criteria)` checks current nearby entities;
- `exploreFrontier(boundary, policy)` chooses an unexplored neighboring area;
- `searchUntil(criteria, explorer, deadline)` repeats observe/move/verify;
- `returnToCheckpoint()` uses recorded safe locations when an action fails.

The explorer should use short route legs, wait for movement and region loading,
and checkpoint after every leg. It should stop on success, deadline, repeated
failure, logout, combat, or a full inventory—not continue blindly.

“Explore until you find XYZ” should therefore receive a target description and
an exploration boundary, not a hidden coordinate list. The target may be an
NPC name, object name, item ID, dialogue phrase, or inventory transition.

## Workflow execution

The CLI currently sends one blocking request to the Java bridge. That is enough
for short workflows but makes long actions hard to observe. The next protocol
should support:

```text
start job -> job ID
status job -> current step and last checkpoint
logs job -> structured observations/results
cancel job -> cooperative stop
```

Until then, standalone `.mjs` files can run for a bounded number of minutes
with `--timeout`, provided they checkpoint and use finite waits.

## Memory and ethics boundary

Persist observations and outcomes in repo-owned run logs, for example under
`.irsc/runs/`, then summarize them into `docs/` when useful. Do not preload
vendor quest routes, hidden NPC coordinates, or complete quest state machines.
Memory should preserve what the agent personally observed and verified:

- successful and failed movement legs;
- interaction signatures and resulting state changes;
- dialogue options actually seen;
- inventory and quest-stage transitions;
- screenshots linked to ambiguous dialogue.

Upstream Java remains reference material for public API behavior only. It
should not become an implicit solution database for the exploration agent.
