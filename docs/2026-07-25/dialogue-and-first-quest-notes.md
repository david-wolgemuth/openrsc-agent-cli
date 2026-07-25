# Dialogue and first-quest notes

## What IdleRSC dialogue actually provides

There is no separate `acceptQuest()` call in the inspected IdleRSC API. Quest
acceptance is normally a server-side result of selecting the appropriate NPC
dialogue responses.

The useful controller methods are:

```js
controller.talkToNpcId(npcId, waitUntilInDialog)
controller.isInOptionMenu()
controller.getOptionMenuCount()
controller.getOptionsMenuText(index)
controller.optionAnswer(index)
```

The bridge can select options, but it currently does not expose the NPC's
spoken dialogue text as a structured value. Screenshots or the client's chat
history are the fallback for understanding the prose between option menus.

The helper should therefore match options by text rather than hard-coded
indexes. A future `scripts/lib/dialogue.js` should provide something like:

```js
dialogue.talkAndSelect(198, [
  "Have you any quests for me?",
  "Sure, I have some spare time"
]);
```

It should wait with a deadline, log the options it actually sees, select a
matching option, and optionally verify a postcondition such as a quest-stage
change or an item appearing in inventory. This mirrors the existing vendor
`QuestHandler` helper `talkToNpcAndSelectOptions`.

## First quest candidate: Cook's Assistant

Cook's Assistant is a good first end-to-end quest because it is local to
Lumbridge, has a small number of ingredients, and already has a maintained
implementation in the pinned vendor source:

- Quest ID: `1` (`QuestId.COOKS_ASSISTANT`)
- Start NPC: the Cook (`NpcId.COOK`)
- Start dialogue choices: `What's wrong?`, then `Yes, I'll help you`
- Required deliverable: one egg, one bucket of milk, and one pot of flour
- Useful item IDs are defined by `ItemId.EGG`, `ItemId.MILK`,
  `ItemId.POT_OF_FLOUR`, `ItemId.POT`, and `ItemId.BUCKET`.

The existing `CooksAssistant.java` script documents the full route: obtain a
pot and bucket near Lumbridge, collect an egg from the chicken area, milk a
cow, collect grain, use the mill, then return to the Cook and follow the
dialogue. It is useful as a behavioral reference, not as code to copy into
the bridge.

## Recommended implementation sequence

1. Add the dialogue methods to `scripts/lib/idle-rsc-api.js`.
2. Add the text-matching helper in JavaScript once script imports/bundling are
   available; keep it as an explicit library rather than adding one Java
   wrapper per dialogue method.
3. Build a small dialogue probe that talks to the Cook and reports every menu
   option without selecting it.
4. Add a Cook's Assistant script that performs one verified phase at a time:
   start dialogue, gather ingredients, return to the Cook, and verify quest
   stage `1` after hand-in.
5. Add screenshots only on dialogue mismatch or failed postconditions, so
   the normal automation path remains structured and machine-readable.

The current character has only inspected the Duke's dialogue; no quest was
accepted. The Rune Mysteries conversation is useful for testing multi-step
dialogue, but Cook's Assistant is the better first quest implementation.
