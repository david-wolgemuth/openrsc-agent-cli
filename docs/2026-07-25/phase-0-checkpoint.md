# Phase 0 checkpoint — 2026-07-25

## Completed verification

- IdleRSC is registered as a submodule at `vendors/Open-RSC/IdleRSC/`.
- Upstream URL: `https://github.com/Open-RSC/IdleRSC.git`.
- Pinned commit: `963e3094a4157c615d7297fcfa9eaff854646a0a`.
- Gradle wrapper: `8.0.2`.
- Runtime: Java `1.8.0_492` on WSL2/Linux.
- Upstream Java compatibility: Java 8 (`client/build.gradle`).
- Native script source set: `app/src/main/java`.
- Native script package: `scripting.idlescript`.
- Native script base class: `scripting.idlescript.IdleScript`.
- Entry point: `IdleScript.start(String[])`, invoked by IdleRSC's dedicated
  `IdleRSC - Running Script` thread.
- Script discovery: Reflections scans subclasses of `IdleScript`; selection is
  by case-insensitive simple class name and `--script-name`.
- Runnable build output: `app/build/libs/app.jar`; the `copyJar` task copies
  it to `IdleRSC.jar` at the repository root.
- No GraalJS, Nashorn, Luaj, or other JavaScript/Lua engine dependency was
  found in the checked-out source or Gradle configuration.

## Reproducible checks

```text
java -version
cd vendors/Open-RSC/IdleRSC
./gradlew --version
./gradlew :app:compileJava --no-daemon
```

The wrapper version check succeeds. Compilation currently fails before source
compilation with:

```text
No Java compiler found, please ensure you are running Gradle with a JDK
```

The environment has a Java 8 runtime but no `javac`; a Java 8 JDK is required
before `make build` or any bridge source can be compiled.

## Hard-stop items

1. Install or select a Java 8 JDK, then rerun the compile probe.
2. Resolve the architecture conflict caused by the absence of an embedded
   JavaScript engine. The later `ScriptWorker`/JavaScript-evaluation design
   cannot be implemented from the current IdleRSC dependency set without an
   explicit engine/dependency decision.
3. Run the stock client and basic login smoke test before Phase 1. This has
   not been attempted because the current environment is not yet build-ready.

No bridge Java source or generated symlink has been added yet.

## Root Makefile

The root [Makefile](/home/david/rsc/Makefile) now exposes:

- `make check` — validate the environment and verified IdleRSC paths.
- `make install-jdk` — install `openjdk-8-jdk` through `apt-get` when
  `javac` is missing; override with `JAVA_PACKAGE=...` when needed.
- `make setup` — create `bridge/`, create the local relative symlink, and
  locally exclude that generated link inside the submodule.
- `make build` — run the vendor repository's own `make build` and verify
  `IdleRSC.jar`.
- `make run` — build and launch the resulting JAR.
- `make clean-link` — remove only the generated symlink.

On this managed WSL environment, `make setup` reaches the JDK installation
step but cannot use `sudo` because the environment sets `no new privileges`.
On a normal WSL shell with working `sudo`, it will install the package and
continue automatically. `make check` and `make build` still fail clearly until
`javac` is available.
