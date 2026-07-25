# Agent guidance

## Gameplay and quest automation boundary

This repository is for building and testing the IdleRSC bridge. Do not use
the vendor's pre-written quest automation as an implementation shortcut or as
the source of gameplay decisions:

```text
vendors/Open-RSC/IdleRSC/app/src/main/java/
  scripting/idlescript/SeattaScript/AIOQuester/
```

In particular, do not run, port, or copy the quest scripts there into
`scripts/`. This includes the AIOQuester quest registry and its
`QuestHandler`-based implementations.

Prefer discovering gameplay through the live client, screenshots, and the
general controller/API surface. Read-only inspection of the vendor quest
source is allowed when the task is explicitly to document or debug upstream
IdleRSC behavior, but it should not be used to automate the character's quest
progress.

Keep the vendor submodule unchanged. Bridge-owned code belongs in this
repository and should leave upstream IdleRSC source intact.
