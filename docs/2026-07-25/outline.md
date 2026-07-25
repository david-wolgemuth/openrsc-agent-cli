# idlersc-bridge — file structure

```
idlersc-bridge/
├── java-server/                  # lives inside IdleRSC's src tree, loaded as a script
│   └── src/main/java/bridge/
│       ├── BridgeScript.java     # IdleScript subclass, entry point IdleRSC calls
│       ├── ScriptServer.java     # TCP supervisor: accept, single-slot job gate
│       ├── ScriptWorker.java     # worker thread, owns the GraalVM/Nashorn Context
│       ├── Job.java              # job state model
│       ├── Protocol.java         # frame encode/decode (newline-delimited JSON)
│       └── ErrorMapper.java      # PolyglotException/ScriptException -> structured error
│
├── cli/                          # Node CLI, agent-facing
│   ├── package.json
│   ├── bin/
│   │   └── mycli.js              # shebang entrypoint, delegates to cli.js
│   ├── cli.js                    # commander setup, subcommand registration
│   ├── socketClient.js           # TCP framing client
│   ├── bundler.js                # esbuild wrapper (write:false, target, sourcemap)
│   ├── sourcemapRemap.js         # remap JVM error line -> original source
│   ├── commands/
│   │   ├── run.js                # `mycli run <file|-c>`
│   │   ├── status.js             # `mycli status`
│   │   ├── cancel.js             # `mycli cancel`
│   │   └── logs.js               # `mycli logs <job-id>`
│   └── subroutines.js            # registers bot/subroutines/*.mjs as named CLI verbs
│
├── bot/                          # dynamic scripts, sent over the wire (CommonJS-style)
│   ├── botlib.js                 # stdlib wrapping Controller — the porcelain layer
│   ├── subroutines/
│   │   ├── walk.js
│   │   └── bank-deposit.js
│   └── docs/
│       └── api.jsdoc.js          # curated JSDoc surface — "what should be called"
│
├── .eslintrc.cjs                 # scoped overrides: bot/ vs cli/
├── .gitignore
├── package.json                  # workspace root (or just cli/'s, if single-package)
└── README.md
```

---

## java-server/

### BridgeScript.java
```java
public class BridgeScript extends IdleScript {
    // holds the Controller reference (from setController) and starts ScriptServer
    @Override
    public void start(String[] parameters) {
        // TODO: instantiate ScriptServer(controller), server.listen(port)
    }
}
```

### ScriptServer.java
```java
public class ScriptServer {
    public ScriptServer(Controller controller, int port) {
        """Bind 127.0.0.1:port, accept exactly one connection at a time."""
        // TODO
    }

    public void listen() {
        """Accept loop: parse incoming Job requests via Protocol, reject if busy."""
        // TODO
    }

    public void handleConnection(Socket client) {
        """Dispatch run/status/cancel/logs frames to the active ScriptWorker."""
        // TODO
    }
}
```

### ScriptWorker.java
```java
public class ScriptWorker extends Thread {
    public ScriptWorker(Controller controller, String bundledSource, String jobId) {
        """Own a fresh JS Context, bind controller, prep console.log capture buffer."""
        // TODO
    }

    @Override
    public void run() {
        """Eval bundledSource; catch PolyglotException -> ErrorMapper; write Job result."""
        // TODO
    }

    public void interrupt() {
        """Cancel path: Context.close(cancelIfExecuting=true) or hard thread interrupt."""
        // TODO
    }
}
```

### Job.java
```java
public class Job {
    // TODO: fields — id, state (IDLE/RUNNING/PAUSED), startedAt, timeoutMs,
    //       consoleBuffer, cancelled, timedOut, error
}
```

### Protocol.java
```java
public class Protocol {
    public static Job parseFrame(String line) {
        """Newline-delimited JSON -> Job request object."""
        // TODO
    }

    public static String encodeResult(Job job) {
        """Job result -> single JSON line (state, cancelled, timed_out, error, output)."""
        // TODO
    }
}
```

### ErrorMapper.java
```java
public class ErrorMapper {
    public static Map<String, Object> toStructuredError(Throwable t) {
        """Extract message, line, column from PolyglotException/ScriptException."""
        // TODO
    }
}
```

---

## cli/

### cli.js
```javascript
function buildProgram() {
    """Register run/status/cancel/logs + subroutine commands via commander; wire --help."""
    // TODO
}
```

### socketClient.js
```javascript
async function sendFrame(payload, { host, port, timeoutMs }) {
    """Open TCP conn, write framed JSON, await one response frame, close."""
    // TODO
}

function sendCancel({ host, port }) {
    """Fire-and-confirm cancel frame on a live/new connection."""
    // TODO
}
```

### bundler.js
```javascript
async function bundleScript({ entryPath, entrySource, resolveDir, target }) {
    """esbuild.build({write:false, bundle:true, sourcemap:'inline', target}).
    Reject disallowed imports (node:*, outside bot/) at build time."""
    // TODO
}
```

### sourcemapRemap.js
```javascript
function remapError(bundledError, sourcemap) {
    """Translate flattened-source line/col back to original file via trace-mapping."""
    // TODO
}
```

### commands/run.js
```javascript
async function runCommand(target, options) {
    """target = file path or inline -c string. Bundle -> send -> print structured result."""
    // TODO
}
```

### commands/status.js
```javascript
async function statusCommand() {
    """No-arg default: query server for current job state, print it."""
    // TODO
}
```

### commands/cancel.js
```javascript
async function cancelCommand() {
    """Send cancel frame; report cancelled/no-op explicitly."""
    // TODO
}
```

### commands/logs.js
```javascript
async function logsCommand(jobId, options) {
    """Fetch per-job console buffer, and optionally correlated engine-log slice with --full."""
    // TODO
}
```

### subroutines.js
```javascript
function registerSubroutines(program) {
    """Scan bot/subroutines/*.js, read sibling metadata (not require()), add as CLI verbs."""
    // TODO
}
```

---

## bot/

### botlib.js
```javascript
// CommonJS-style, bundled/flattened before send — never run directly by Node.
module.exports.walkTo = function walkTo(mapPoint) {
    """Wraps controller.walkTo(x, y, 0, true, false) with a sane single-arg signature."""
    // TODO
};

module.exports.bank = {
    deposit(itemIds) {
        """Wraps controller bank deposit calls, unwraps Optional-shaped returns."""
        // TODO
    },
};
```

### subroutines/walk.js
```javascript
// Named subroutine — sugar over botlib.walkTo, invoked as `mycli walk <x> <y>`.
module.exports = function main(x, y) {
    """One concrete, parameterized operation — shipped as intent-signaling vocabulary."""
    // TODO
};
```

### subroutines/bank-deposit.js
```javascript
module.exports = function main(itemIds) {
    """`mycli bank-deposit <items>` — pre-written common routine."""
    // TODO
};
```

### docs/api.jsdoc.js
```javascript
/**
 * Curated JS-facing API surface over Controller. Documents only what SHOULD
 * be called (not everything Controller exposes). Fed to the agent as context.
 *
 * @function walkTo
 * @param {{x:number,y:number}} point
 * @returns {void} - blocks until arrival
 */
// TODO: incrementally add entries as real scripts use new Controller methods
```

---

## Root

### .eslintrc.cjs
```javascript
module.exports = {
    // TODO: overrides — bot/**/*.js: no Node globals/require of node:*;
    //       cli/**/*.js: normal Node ruleset
};
```

### package.json (cli/)
```json
{
  "dependencies": {
    "commander": "*",
    "esbuild": "*",
    "@jridgewell/trace-mapping": "*"
  }
}
```
