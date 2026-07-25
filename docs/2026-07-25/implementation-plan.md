# IdleRSC Bridge — Implementation Plan

## Purpose

Build a separate `idlersc-bridge` project that adds a custom Java-backed
IdleRSC script while leaving the upstream IdleRSC repository unchanged.

The bridge repository owns the bridge code, CLI, bot-side JavaScript, tests,
and orchestration. IdleRSC is a pinned upstream build dependency under
`vendors/Open-RSC/IdleRSC/`.

The first goal is not the complete remote scripting system. The first goal is
to prove that an external bridge source directory can be linked into an
otherwise unmodified IdleRSC checkout, compiled, loaded, and run reliably.

## Required reading

Before changing code, the implementing agent should read all relevant files in
this directory, especially:

- `docs/kickoff.md` — phase order, checkpoints, hard stops, and testing rules.
- `docs/outline.md` — intended repository layout and component responsibilities.
- `docs/Claude-Idlersc architecture overview.md` — existing architecture and
  assumptions that must be checked against the actual IdleRSC source.
- `docs/axi-principles.md` — project principles and constraints.
- `docs/brainstorming.md` — prior alternatives and design context.

These documents are input, not unquestionable truth. If they conflict with
the pinned IdleRSC checkout, inspect the actual source and stop for direction
when the conflict affects a foundational design decision.

## Target repository layout

```text
idlersc-bridge/
├── vendors/
│   └── Open-RSC/
│       └── IdleRSC/         # pinned IdleRSC submodule
├── bridge/                   # Java bridge source and tests
├── cli/                      # Node CLI, added in a later phase
├── bot/                      # JavaScript bot library and scripts
├── docs/
├── Makefile
└── README.md
```

The directory name `bridge/` is intentional. It describes the role of the
code and does not unnecessarily expose the current implementation language.

The Java package name and exact source layout must be chosen only after
inspecting the pinned IdleRSC revision. Do not assume that the README's old
`src/scripting/...` layout still applies.

## Source and dependency policy

### IdleRSC

- Add IdleRSC as a Git submodule under `vendors/Open-RSC/IdleRSC/`.
- Pin it to a specific known-good commit.
- Record the source URL and commit in the bridge README or a small metadata
  file.
- Do not commit modifications to the IdleRSC submodule.
- Do not fork or permanently patch IdleRSC for this project.
- Use the actual source/build layout of the pinned revision, not assumptions
  from an older README.

The current public repository appears to use Gradle modules such as `app`,
`client`, and `patcher`, while its README documents an older script layout.
This must be resolved during Phase 0 by inspecting the checked-out revision.

### Bridge source

- Keep bridge source of truth in the top-level `bridge/` directory.
- Integrate it into IdleRSC with a local symlink created by Make.
- The symlink is a build-time working-tree integration, not a second copy of
  the source.
- The link must be relative where practical so the repository remains
  portable across machines.
- The Makefile must refuse to overwrite a real directory or file at the link
  destination.

A symlink inside the submodule will make its working tree appear dirty unless
the link is locally excluded. The setup target may add the generated link to
`vendor/idlersc/.git/info/exclude`, which is local-only and does not modify
tracked IdleRSC files. It must not edit the submodule's tracked `.gitignore`.

### Licensing and safety

Inspect and preserve IdleRSC's GPL licensing requirements. Do not copy source
from the upstream repository into the bridge repository. The bridge must bind
its server to `127.0.0.1` only, and the implementation must treat received
JavaScript as trusted local code. Do not expose the execution socket to the
network.

## Makefile contract

The top-level Makefile is the user-facing entry point. It orchestrates the
upstream Gradle build; it does not need to invoke another Makefile unless the
pinned IdleRSC revision provides one.

Expected targets:

```text
make check       # inspect environment, submodule, source path, and link state
make setup       # validate paths and create the local source symlink
make build       # setup, then run the pinned IdleRSC Gradle build
make run         # build, then run the resulting IdleRSC.jar
make clean-link  # remove only the generated symlink
```

Expected configurable variables should include, at minimum:

```make
IDLE_DIR    ?= vendors/Open-RSC/IdleRSC
BRIDGE_SRC  ?= bridge
BRIDGE_LINK ?= ...
```

`BRIDGE_LINK` must not be filled in until the actual compiled Java source set
has been confirmed.

Makefile requirements:

- Be safe to run repeatedly.
- Fail clearly if the submodule is missing or uninitialized.
- Fail clearly if the Java version is incompatible.
- Refuse to replace a non-symlink at the integration path.
- Verify that the final JAR exists after a successful build.
- Avoid deleting anything except the specific generated symlink in
  `clean-link`.
- Keep generated build output out of the bridge repository's tracked files.

The expected build flow is:

```text
make setup
  → validate vendors/Open-RSC/IdleRSC
  → create local bridge symlink

make build
  → setup
  → run vendors/Open-RSC/IdleRSC/gradlew build
  → verify IdleRSC.jar

make run
  → build
  → java -jar vendors/Open-RSC/IdleRSC/IdleRSC.jar
```

The prebuilt IdleRSC JAR, if downloaded from GitLab releases or CI artifacts,
is useful for an initial stock-client smoke test. It is not assumed to load
uncompiled `.java` files from a neighboring directory. Custom Java scripts
must be compiled and packaged through the verified source build path unless
the actual IdleRSC source proves a supported runtime plugin mechanism.

## Phased implementation

Follow the phase order in `docs/kickoff.md`. Do not skip to later phases.

### Phase 0 — Environment and source verification

No bridge code.

1. Initialize the IdleRSC submodule at the selected commit.
2. Inspect `settings.gradle`, module build files, source sets, script-loading
   code, and packaging tasks.
3. Confirm which source directory Gradle compiles for the application.
4. Confirm the package and superclass required for a native IdleScript.
5. Confirm how script names are discovered and selected at runtime.
6. Confirm how the build creates the runnable JAR.
7. Check the actual JDK requirement from build configuration and runtime.
8. Confirm which JavaScript engine, if any, is available on that JDK.
9. Run the stock/prebuilt client if available and confirm it boots and logs in
   without bridge code.
10. Verify WSL filesystem placement and symlink behavior. Keep working files
    inside the Linux filesystem rather than `/mnt/c` unless explicitly tested.

Checkpoint: report the pinned commit, JDK, source path, script-loading path,
JavaScript engine, output JAR path, and stock-client result. If any of these
contradict the design, stop before writing bridge code.

### Phase 1 — Makefile and minimal bridge script

Implement only the repository integration and a minimal script that compiles.

1. Add the Makefile targets and safety checks.
2. Create the local symlink from the verified IdleRSC source location to
   `bridge/`.
3. Add the smallest possible `BridgeScript` implementation required by the
   actual IdleRSC API.
4. Build using `make build`.
5. Run the client with the normal script-selection mechanism.
6. Prove that the bridge script is actually loaded and its entry point is
   called.
7. Keep the submodule's tracked files unchanged; document any local ignored
   symlink.

Checkpoint: show `make check`, `make build`, and a real run where the bridge
script logs a startup message. Do not add socket, worker, JavaScript-eval, or
CLI code until this works.

### Phase 2 — Java server skeleton

Implement `ScriptServer`, `Protocol`, and only the minimal connection flow.

- Bind exclusively to `127.0.0.1`.
- Accept one connection at a time initially.
- Read one newline-delimited JSON frame.
- Echo the frame or return a minimal validated response.
- Close the connection cleanly.
- Add a raw socket test using `nc` or a small external client.

Confirm the IdleRSC script's thread behavior and whether starting the server
from the script entry point is safe. Do not guess at Controller APIs or thread
semantics.

Checkpoint: a raw client can connect to the running IdleRSC process and get a
correct response. Stop if the script entry point or socket behavior differs
from the design.

### Phase 3 — Worker, job state, and error handling

Implement `ScriptWorker`, `Job`, and `ErrorMapper`.

1. Establish the actual supported JavaScript engine and context API.
2. Run hardcoded trivial expressions only.
3. Bind the actual Controller object only after confirming its API and thread
   constraints from source/Javadoc.
4. Return structured success and error results.
5. Test syntax errors without crashing the IdleRSC process.
6. Test cancellation during a controlled delay.
7. Test cancellation during a representative blocking game operation only if
   the engine/API provides a safe cancellation mechanism.

Checkpoint: success, syntax error, and cancellation each work against the
real running client. Stop if cancellation is unreliable or a script failure
can terminate the client.

### Phase 4 — CLI and bundling

Add the Node CLI only after the JVM server contract is stable.

Implement:

- `cli.js`
- `socketClient.js`
- `bundler.js`
- `commands/run.js`
- `commands/status.js`
- `commands/cancel.js`

Start with inline `1+1` execution. Define and document CLI exit codes before
adding consumers. Bundle only approved local bot code, reject disallowed
imports, and keep all socket communication on loopback.

Checkpoint: run, status, and cancel work against a genuinely busy server.
Pause for explicit confirmation of the exit-code contract as required by
`docs/kickoff.md`.

### Phase 5 — Small bot library

Add only the first real bot functions needed by a demonstrable script. Do not
speculatively implement the complete API.

Each function must be checked against the real Controller/API behavior. Add a
real in-game smoke test, such as a short movement operation, only after the
read-only and trivial execution tests pass.

### Phase 6 — Logging

Add per-job console capture and the logs command. Correlate engine logs by an
explicit job ID and time window. Confirm that normal `run` output includes
script logs without requiring a separate logs query.

### Phase 7 — Subroutines, source maps, and polish

Add named subroutines, source-map remapping, help output, linting, and final
Makefile documentation only after the execution contract is stable.

Test an error originating in a nested bundled file and verify that the user
sees the original file and line rather than the flattened bundle position.

## Verification and handoff

Every phase must leave behind a reproducible command and a short result in the
phase checkpoint. At minimum, document:

- IdleRSC submodule URL and commit.
- JDK version and supported runtime command.
- Verified bridge source/link path.
- Build command and resulting JAR path.
- Script-selection command or configuration.
- Socket address and protocol framing.
- Cancellation behavior and limitations.
- CLI exit-code table.
- Any known WSL, Windows, or symlink limitations.

If an assumption about IdleRSC conflicts with the checked-out source, do not
patch around it silently. Record the evidence, stop at the current checkpoint,
and ask for direction.
