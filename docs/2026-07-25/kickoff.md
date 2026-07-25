# Agent build instructions — idlersc-bridge

Build in the phase order below. Do not skip ahead to a later phase's files.
At the end of each phase there's a **checkpoint** — stop and report back before
continuing, even if nothing looks broken.

General rules that apply throughout:
- Never guess at IdleRSC/Controller/IdleScript method signatures, return
  shapes, or thread-safety behavior. If it's not confirmed in the Javadoc or
  the actual source files provided, **hard-stop and ask** rather than
  inferring from method names.
- Never touch `Controller.java` or add new Java classes to IdleRSC beyond
  what's in the outline. If a phase seems to need that, hard-stop and ask —
  it means an earlier assumption was wrong.
- One phase = one commit (or one PR). Don't bundle phases together even if
  it'd be faster.
- If a test or manual check fails twice in a row with the same root cause
  unresolved, hard-stop — don't keep patching around it a third time.

---

## Phase 0 — Environment verification (no code)

- Confirm IdleRSC boots under the actual JDK in use (check `build.gradle`
  `sourceCompatibility`, not the README).
- Confirm which JS engine is actually available on that JDK — GraalJS or
  Nashorn. Do not assume; print/log the engine name at runtime.
- Confirm WSLg renders the IdleRSC window and a basic login succeeds.

**Checkpoint:** report JDK version, JS engine available, and whether the
client boots and logs in with no script attached. **Do not write any bridge
code until this is confirmed working.** If the client won't boot or the JS
engine isn't what was planned for, hard-stop — this changes the whole design.

---

## Phase 1 — Java server skeleton, compiles only, no eval yet

Build: `BridgeScript.java`, `ScriptServer.java`, `Protocol.java` only.
`ScriptServer` should accept a connection, read one frame, echo it back
verbatim, close. No `ScriptWorker`, no Context, no Controller binding yet.

- Write a minimal manual test: raw `nc`/Python socket script connects to
  `127.0.0.1:<port>`, sends a JSON line, confirms the echo.
- Confirm `BridgeScript` actually gets invoked by IdleRSC's script loader the
  way the docs implied (i.e. `start()` really is called, on its own thread).

**Checkpoint:** show the echo test working against the real running client.
**Hard-stop if:** `start()` isn't called as expected, or the socket can't
bind/connect from outside the JVM — this is foundational, don't build on top
of an unconfirmed assumption here.

---

## Phase 2 — Worker thread + Controller binding, trivial scripts only

Build: `ScriptWorker.java`, `Job.java`, `ErrorMapper.java`. Wire
`ScriptServer` to spin up a worker per accepted job.

- Test with hardcoded trivial payloads only (`"1+1"`, `"controller.getX()"`
  or equivalent read-only call) — not bundled scripts yet, not `botlib.js`.
- Confirm a deliberately broken payload (syntax error) returns a structured
  error via `ErrorMapper`, not a crash or hang.
- Confirm cancel actually interrupts a script mid-sleep/mid-walk (test with
  a script that blocks for several seconds).

**Checkpoint:** show three manual runs — success, syntax error, cancel
mid-execution — each returning the expected structured result.
**Hard-stop if:** cancel doesn't reliably interrupt a blocking native call,
or a script error ever crashes the whole IdleRSC process rather than just
failing the job. Do not proceed to Phase 3 with either of these unresolved —
they get much harder to debug once real scripts are in the mix.

---

## Phase 3 — CLI skeleton + bundler, no botlib yet

Build: `cli.js`, `socketClient.js`, `bundler.js`, `commands/run.js`,
`commands/status.js`, `commands/cancel.js`.

- `run` should bundle a plain inline snippet (`-c "1+1"`, no imports) and
  round-trip it through the Phase 2 server.
- `status`/`cancel` should work against a genuinely busy server (script
  sleeping for 10s) — confirm the busy state and cancel both report
  correctly end-to-end, not just when idle.
- Confirm the CLI's own exit codes: 0 success, distinct nonzero for busy,
  timeout, script error, connection failure. Write these down explicitly
  before choosing numbers.

**Checkpoint:** show `run`, `status` (idle and busy), `cancel` (mid-job and
no-op) all working against the real server, plus the exit code table.
**Ask the user to confirm the exit code scheme before continuing** — this is
a contract the rest of the CLI (and future agent callers) will depend on,
worth locking in deliberately rather than silently deciding it.

---

## Phase 4 — botlib.js + real bot scripts

Build: `bot/botlib.js` with the *first 2–3 functions only* (e.g. `walkTo`,
one inventory query) — not the full planned API. Wire `bundler.js`'s
`resolveDir` logic and the disallowed-import check (reject `node:*` /
anything outside `bot/`).

- Write one real end-to-end script by hand that imports from `botlib.js` and
  actually does something observable in-game (e.g. walk two tiles).
- Confirm the disallowed-import check actually rejects a deliberately bad
  test payload (`require('fs')` or similar) before it reaches the socket.

**Checkpoint:** show the real in-game script running successfully, and show
the rejected-import test failing loudly and locally (not on the JVM side).
**Hard-stop if:** the disallowed-import check can be bypassed with any
reasonably-obvious variant (e.g. dynamic `require`, indirect eval) — this is
a correctness bar to hit before adding more of `botlib.js`, not something to
patch later.

Beyond this point, growing `botlib.js` is incremental: **add one function at
a time, only when a real script needs it**, not speculatively. Each addition
gets a one-line JSDoc entry in `bot/docs/api.jsdoc.js` in the same commit —
don't let the doc fall behind the code.

---

## Phase 5 — Logging

Build: per-job console capture (worker side) returned in the `run` result,
plus `commands/logs.js` and the engine-log correlation-by-job-id mechanism.

- Confirm `console.log` calls inside a script actually show up in the CLI's
  `run` output without a separate `logs` call.
- Confirm `logs <job-id> --full` pulls a plausible slice of engine log
  overlapping that job's timeframe.

**Checkpoint:** show a script with several `console.log` calls, and its
output appearing directly in the `run` response.

---

## Phase 6 — Subroutines, sourcemaps, polish

Build: `subroutines.js`, `subroutines/*.js`, sourcemap wiring
(`sourcemapRemap.js`), `--help` output assembly, `.eslintrc.cjs`.

- Confirm `mycli --help` (no args) lists both primitive verbs and named
  subroutines together.
- Confirm a deliberately broken *bundled, multi-file* script (error inside
  `botlib.js`, not the top-level script) reports back the original file +
  line via the sourcemap, not the flattened line number.

**Checkpoint:** show `--help` output and one sourcemap-remapped error.

---

## Cross-cutting: when to hard-stop and ask, at any phase

- Any time IdleRSC's actual runtime behavior contradicts something assumed
  in the design doc (threading, blocking semantics, engine choice).
- Any time a fix would require touching `Controller.java` or adding new
  IdleRSC-side Java classes beyond the outline.
- Any time cancel/interrupt doesn't reliably stop a running script within a
  couple seconds — this is a safety-relevant property, not a nice-to-have.
- Any time the same test fails twice after two different fix attempts.
- Before locking in any contract other code will depend on long-term (exit
  codes, frame protocol shape, `botlib.js` public function signatures once
  more than one subroutine uses them).
