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
