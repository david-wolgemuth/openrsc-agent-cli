# IdleRSC bridge — implementation history and decisions

This document records the design discussion and the implementation work done
on 2026-07-25. It is intentionally chronological so a later agent can see
which assumptions were tested, which changed, and which remain unresolved.

## Starting design question

The project is intended to be a separate `idlersc-bridge` repository that
adds one custom IdleRSC script while leaving upstream IdleRSC untouched. The
bridge is eventually intended to expose a local command-line-controlled
execution service, with a Java entry-point script inside IdleRSC and a later
Node/JavaScript CLI.

The initial alternatives were:

- A Git submodule containing IdleRSC.
- A copied/synchronized Java source tree.
- A symlink from the upstream source tree into bridge-owned source.

The chosen model is a pinned IdleRSC submodule plus a generated local symlink.
The submodule pins the upstream build dependency; it does not pretend that
IdleRSC is an ordinary library dependency. The bridge remains the source of
truth for custom code, so there is no copy step that can drift.

## Repository naming and layout decisions

The project name settled on `idlersc-bridge`; names such as `bridge-java` were
rejected because the bridge's role matters more than its current language.
The vendor path was then made explicit and case-preserving:

```text
vendors/Open-RSC/IdleRSC/
```

The top-level bridge source directory is `bridge/`. The eventual Java source
will be linked into the actual IdleRSC application source root, not placed in
the repository root or copied into upstream source.

The submodule is pinned at:

```text
963e3094a4157c615d7297fcfa9eaff854646a0a
```

Its upstream URL is:

```text
https://github.com/Open-RSC/IdleRSC.git
```

## Source inspection corrected the old README assumptions

The README still documents the older instruction to put Java files in
`src/scripting/(idlescript or sbot)`. The checked-out source is authoritative
for this project and revealed the current structure:

- Gradle modules: `client`, `patcher`, and `app`.
- Native Java source root: `app/src/main/java`.
- Native script package: `scripting.idlescript`.
- Native script base class: `scripting.idlescript.IdleScript`.
- Entry point: `start(String[])`, called by the dedicated
  `IdleRSC - Running Script` thread.
- Script discovery: Reflections scans subclasses of `IdleScript`; scripts are
  selected by case-insensitive simple class name.
- CLI selection: `--script-name`.
- Build artifact: `app/build/libs/app.jar`, copied to root `IdleRSC.jar` by
  the upstream `copyJar` task.

This means the future bridge link destination is currently:

```text
vendors/Open-RSC/IdleRSC/app/src/main/java/idlersc_bridge
```

The Java package declaration will still be chosen from the actual API and
script-loader requirements. The directory name is an integration location,
not a claim about the eventual package.

## Environment and build iterations

The first environment check found Java 8 runtime support but no `javac`, so
Gradle failed with “No Java compiler found”. The root Makefile consequently
gained an `install-jdk` target. On Ubuntu/WSL it installs `openjdk-8-jdk` via
`apt-get` and `sudo` when necessary.

Several setup issues were found and corrected while exercising the Makefile:

1. `.ONESHELL` was added so shell variables such as the parsed Java version
   survive across recipe lines.
2. Java version parsing was fixed for the actual `openjdk version
   "1.8.0_492"` output.
3. The submodule's `.git` is a pointer to linked Git metadata, so the setup
   target now resolves the real `info/exclude` path with Git rather than
   assuming `vendors/Open-RSC/IdleRSC/.git/info/exclude` exists.
4. Failure to write that local-only exclude is now a warning rather than a
   setup failure; the symlink itself is still protected and created.
5. Gradle's cache was moved to the project-local ignored `.gradle/` directory
   through `GRADLE_USER_HOME`, avoiding host-cache permission problems.

The root Makefile now provides:

```text
make check       validate Java, submodule, source, and link state
make install-jdk install Java 8 JDK if javac is absent
make setup       validate and create the bridge symlink
make build       run the vendor's own make build and verify IdleRSC.jar
make run         load .env, build, and launch IdleRSC
make clean-link  remove only the generated symlink
```

The full upstream build was successfully run through `make build`. It
compiled the client, patched client, and application and produced a 12 MB
`vendors/Open-RSC/IdleRSC/IdleRSC.jar`.

## Credentials and server selection

The user added a root `.env` containing `IDLE_USERNAME` and `IDLE_PASSWORD`.
The root `.env` is ignored; `.env.example` documents the names without real
credentials. The Makefile validates that both values are present, sources the
file without printing it, and passes them to IdleRSC.

The first launch used `--auto-login` but omitted `--auto-start`, which left the
Account Selection window visible. The launch command was corrected to include:

```text
--auto-start --auto-login
```

The upstream server-selection flag was then confirmed from `CLIParser.java`:
`--init-cache uranium` selects Uranium and port `43601`; `coleslaw` selects
port `43599`. The Makefile now defaults to Uranium and permits
`IDLE_SERVER=coleslaw` in `.env`.

The resulting launch shape is:

```text
java -jar IdleRSC.jar \
  --auto-start --auto-login --init-cache "$IDLE_SERVER" \
  --username "$IDLE_USERNAME" --password "$IDLE_PASSWORD"
```

The password is therefore present in the Java process arguments. This is
convenient for the current prototype but is a security limitation; a later
iteration should prefer an ignored account-properties file or another input
method that does not expose the password through process listings.

Observed launch behavior reached the Uranium server configuration successfully
(`game.openrsc.com:43601`). One run then hit an upstream
`ThemesMenu.colorMenuItem` null pointer exception in the graphical startup
path. That exception is in IdleRSC and was not patched. The login/auto-start
behavior should be re-tested after the graphical startup issue is resolved or
when running in the user's normal WSLg session.

## Screenshot capability

IdleRSC does support screenshots, but not through a dedicated CLI flag in the
current source. Available built-in triggers are:

- `F9`.
- In-game chat command `::screenshot`.
- The side-panel Screenshot button.

Screenshots are written below `Screenshots/<username>/`. An external desktop
tool such as `xdotool` can send F9 if installed, but no such tool was present
in the agent environment. The root bridge CLI does not yet add a screenshot
command.

## Phase-1 hello-world iterations

After the Phase-0 source verification, the first runtime milestone was made
deliberately small: prove that bridge-owned Java is compiled, packaged,
discovered, instantiated, given a `Controller`, and entered through
`start(String[])`. No socket server or JavaScript evaluator was introduced.

The first implementation added:

```text
bridge/scripting/idlescript/BridgeScript.java
```

The source keeps the `scripting.idlescript` package so it can access the
package-private controller field in the vendor's `IdleScript` base class. The
generated integration link remains outside the upstream package directories:

```text
app/src/main/java/idlersc_bridge -> ../../../../../../../bridge
```

The first version used `System.out.println` and `controller.displayMessage`.
The class was compiled and appeared in `IdleRSC.jar`, but the println text did
not appear in IdleRSC's persisted logs. Reading the vendor logger showed why:

- IdleRSC redirects `System.err`, not `System.out`.
- `Main.logScript` is the persisted script-log path.
- `Controller.log(...)` calls `Main.logScript(...)` and displays the message
  in the client.

The smoke test was changed to call `controller.log("idlersc-bridge: hello world", "yel")` once.
The once-only guard matters because IdleRSC repeatedly
calls a native script's `start()` method; its return value is the delay before
the next call. Without the guard, the hello message would be emitted roughly
once per second.

## Runtime launch and vendor-bug investigation

The first fresh launches using direct command-line credentials reached cache
generation and Uranium configuration, but then reported:

```text
NullPointerException
  at bot.ui.ThemesMenu.colorMenuItem(ThemesMenu.java:119)
```

Source tracing established that this happens because the `--auto-start`
command-line parsing path does not populate `CLIParser.colors`; it then assigns
null to `Main.customColors`. The `Custom` placeholder theme is rendered during
`ThemesMenu` construction and dereferences that null array. The exception is
in the pinned IdleRSC code, before `Main` reaches its initial
`controller.login()` call. This explains why direct Makefile auto-login appeared
not to work, while manually completing login did.

The vendor documentation was also compared with the pinned source. The
checkout is `2.90.0-20-g963e3094`, while the README's CLI section is older and
contains stale or mismatched names, including `--hide-side-panel` and
`--unstick`. The current source defines `--sidebar` and has additional options
such as `--disable-3d` and `--no-screen-refresh`. The source, not the README,
is treated as authoritative.

## Makefile workaround and successful end-to-end run

Two separate Makefile problems were corrected:

1. `make run` sourced `.env` in the recipe, but the recipe tested the Make
   variable `$(IDLE_SCRIPT)`. Therefore `IDLE_SCRIPT=BridgeHelloWorld` in
   `.env` could be ignored unless it was also supplied on the command line.
   The recipe now resolves the shell-loaded value after sourcing `.env`.
2. Direct `--username`/`--password` arguments select the vendor path that
   leaves `Main.customColors` null. The recipe now creates a temporary,
   ignored account-properties file under `accounts/`, passes only
   `--auto-start --account <temporary-name>`, and removes the file when the
   client exits. This deliberately uses the vendor's account-file parsing path,
   which initializes custom colors and also carries the script name, server,
   debug, and auto-login settings.

The temporary account file avoids putting the password in the Java process
argument list, though it remains readable on disk while the client runs. The
generated pattern is ignored, and the root `Screenshots/` output directory was
also added to `.gitignore` after runtime screenshot testing.

The successful run proved all required pieces in sequence:

```text
Starting client for traci
The 'BridgeHelloWorld' script has been started!
[SCRIPTS] idlersc-bridge: hello world
```

Because IdleRSC waits for `controller.isLoggedIn()` before setting the script
running state, the script-start log is also evidence that automatic login
completed. The script name was present in the generated temporary account file,
which confirms it came through `.env` during a plain `make run`.

The smoke-test class was then renamed to its permanent entry-point name,
`BridgeScript`, before beginning the socket-server phase. The next
architectural decision is still the JavaScript engine for the later worker
phase.

## Socket-server skeleton

The permanent `BridgeScript` entry point now starts a daemon
`idlersc-bridge-server` thread after IdleRSC invokes the native script. The
initial server binds only to `127.0.0.1:8765`, accepts one client at a time,
reads one newline-delimited frame, echoes it unchanged, and closes the
connection. `Protocol` is intentionally only an echo seam at this stage; it
does not parse JSON or evaluate code.

The new classes compile into the runnable JAR and the root Makefile provides
`make test-bridge` for the live echo checkpoint. A client run that receives
login response `4` has not reached the script thread, so the echo test must be
performed only after a successful login; the server is not expected to bind
while IdleRSC is stuck retrying authentication.

## JavaScript execution begins

The next slice uses Nashorn, which is bundled with the required Java 8 runtime;
no JavaScript engine was present in IdleRSC's external dependencies. The
bridge now accepts a `run` frame containing base64-encoded source, creates a
fresh Nashorn engine in `ScriptWorker`, and exposes only the explicit
`controller` and `console.log` bindings for this smoke-test phase. Results and
errors are returned as small JSON responses. `make test-js` exercises
`console.log("js-smoke-test"); 1 + 1;` through the live socket.

This is intentionally not the full worker contract yet: there is no job ID,
status endpoint, timeout, or cancellation. Those require separate tests after
basic JavaScript execution is proven.

## Shutdown behavior

Inspection of the pinned IdleRSC source showed that its JVM shutdown hook only
force-stops batching; it does not send a logout packet. The bridge therefore
registers its own best-effort shutdown hook. It disables auto-login, calls
`Controller.logout()`, and closes the loopback server socket. IdleRSC documents
that logout is not guaranteed during shutdown, so this reduces stale sessions
but does not replace the server's normal session timeout.

## Architecture constraints that remain

The planned dynamic JavaScript worker cannot yet be implemented from the
pinned IdleRSC source alone. A source/dependency search found no GraalJS,
Nashorn, Luaj, or other embedded JavaScript/Lua engine. The existing plan's
future `ScriptWorker` therefore needs an explicit engine and dependency
decision before code is written.

No bridge Java classes, socket server, JavaScript evaluator, Node CLI, or bot
library have been added yet. The project is still at the Phase-0 checkpoint:
the upstream source/build integration is proven, but the runtime execution
architecture is deliberately not being guessed.

## Current security and hygiene rules

- Do not modify tracked files inside the IdleRSC submodule.
- Keep the generated bridge link local and relative.
- Keep `.env`, Gradle caches, logs, and generated runtime artifacts out of the
  bridge repository's tracked files.
- Bind any future bridge service to loopback only.
- Treat dynamically received script code as trusted local code until a real
  sandbox design exists.
- Preserve IdleRSC's GPL licensing and do not copy upstream source into the
  bridge repository.
