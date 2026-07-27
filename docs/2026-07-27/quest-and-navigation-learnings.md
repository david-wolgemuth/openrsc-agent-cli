# Questing and navigation learnings

## The important discovery was not another route

The Restless Ghost quest is now at stage 2. The useful progression was:

1. Re-establish the Priest and Ghost in the church/graveyard.
2. Speak to the Ghost and exhaust the observed dialogue branches.
3. Follow the Priest's directions toward the swamp rather than repeatedly asking him
   for the same instructions.
4. Find Father Urhney at the reachable swamp-side area around `(120,708)`.
5. Tell Urhney that Father Aereck sent us and that a ghost is haunting the graveyard.
6. Receive and equip the Ghostspeak amulet.

The next quest action is to return to the Ghost with the amulet. The dialogue and quest stage,
rather than a visual assumption, are the authoritative progress signals.

## What the world taught us

The apparent “castle route” was actually a collision-and-water problem. Native pathing often
rerouted toward a legal but unintended area, which made a failed route look like exploration.
The screenshot at `(108,692)` made the reason obvious: the character was standing on a riverbank,
facing water and a cliff. The ordinary inspect output showed rocks, bullrushes, doors, and a
banker, but did not describe the water or terrain boundary.

The successful route was found by moving in small, verified increments along the reachable side
of the river: east across the bank-side corridor, then south through the swamp. This was more
reliable than targeting a distant coordinate or assuming that Euclidean closeness implied a
walkable route.

The live client contains more useful collision knowledge than the minimap. Its path system can
answer whether a destination is reachable from the current map segment, but that answer is only
“reachable” or “not reachable”; it does not explain whether the cause is water, a cliff, a wall,
or stale map data. Screenshots remain valuable as occasional explanations of an otherwise opaque
collision result, especially at rivers, gates, and building boundaries.

## Bridge and workflow lessons

The single bridge connection is also the single script worker. A CLI timeout does not cancel the
Java worker. Consequently, two different facts must never be confused:

- a request timed out at the CLI boundary;
- the Java `walkTo` call actually returned.

Once a blocking `walkTo` returns, another command can be issued immediately. A chained script can
therefore do short walk, checkpoint, short walk, checkpoint. There is no need to insert arbitrary
sleep calls between blocking legs. A sleep is justified only when deliberately waiting for an
external game event or a known asynchronous action—not as a generic repair for a timeout.

The best current pattern is:

1. Query the local reachability neighborhood.
2. Choose one or a few adjacent tiles that are both reachable and directionally useful.
3. Call blocking `walkTo` for that short leg.
4. Immediately record coordinates, walking state, NPCs, objects, quest stage, and new messages.
5. Stop the batch when a leg returns without movement or when the worker is still walking.

The new `./irsc map --radius N` command exposes live reachability around the player. It is useful
for a small local snapshot, but its implementation calls the client's pathfinder and should not
be used as a large repeated scan or as an unbounded long-range route planner. In particular,
`around()` can become expensive when repeatedly invoked while the client is also pathing. Local
probes are evidence; they are not a replacement for a bounded route controller.

## Dialogue and observation principles

Incoming NPC, game, chat, private, and trade messages now flow into one bounded in-memory stream
and durable JSONL log. This fixed the earlier dependence on screenshots for dialogue. Screenshots
should be reserved for ambiguity—visibility, terrain, UI state, or a mismatch between API entities
and what the player can see.

NPC IDs also need interpretation. An NPC listed by the scene API may be outside the visible camera,
behind a wall, or transient while the region refreshes. When present, raw NPC coordinates can be
converted to map tiles; the converted position plus reachability and a targeted screenshot is a
much stronger visibility test than an ID-only `inspect` line.

## Engineering boundary

All bridge changes remain bridge-owned. The vendor IdleRSC source and its quest automation remain
unchanged. The live quest decisions above came from observed dialogue, coordinates, entity data,
collision probes, and screenshots—not from importing or running the vendor's prewritten quest
handlers.
