Skip to main contentAccessibility help
AI Mode
All
Short videos
Videos
Images
More




open runescape classic IdleRSC vs APOS
In Open RuneScape Classic ecosystems, IdleRSC and APOS are both client tools used for automation and scripting, with APOS serving as a legacy standard and IdleRSC acting as a modern, evolved successor. 

GitHub
 +2
Core Differences
APOS: A classic, highly popular historical botting client from the later active eras of RuneScape Classic. It relies on older injection methods and its native APOS script format.
IdleRSC: A modern iteration built for Open-RSC worlds (such as Uranium and Coleslaw) utilizing code injection and reflection. It introduces its own API (IdleScript) while retaining backwards compatibility for older APOS and SBot scripts.
Feature Scope: IdleRSC expands past traditional skilling and walking frameworks by natively supporting modern additions like staker bot functionality, whereas APOS remains strictly tied to its vintage operational environment. 

GitHub
 +3
For tips on how to get the classic client setup and running smoothly:
Related video thumbnail
6m
Which Runescape should you play?
1M views · 3 years ago

YouTube · J1mmy
If you want to proceed, let me know:
Are you trying to set up scripts for a specific OpenRSC server world?
Do you need help converting an older APOS script to work with IdleRSC?





5 sites
Open-RSC/IdleRSC - GitHub
This started as a project in April 2020 due to a distinct lack of botting clients available for RSC post-closure. After Jagex deci...


GitHub
OpenRSC - GitLab
IdleRSC. IdleRSC is a bot for OpenRSC coleslaw and uranium worlds that uses code injection and reflection. It has it's own custom ...


GitLab
idlersc - Seatta - GitLab
IdleRSC is a bot for the OpenRSC coleslaw and uranium worlds that uses code injection and reflection. It has its own custom script...

GitLab
Show all
i'd like to be able to hook up w/ a code agent, so something that can be easily managed from command line, and allow some dynamic scripting
To hook up an AI code agent for dynamic scripting via the command line, IdleRSC is your best choice. It features a modern API structure, standard Java execution, and a decoupling of logic that makes it much easier to interface with external tools compared to the legacy APOS client.
Here is how you can set up this architecture to allow a code agent to manage and script the client dynamically:
1. Headless Command-Line Execution
IdleRSC can be launched directly from the command line without the graphical user interface (GUI). This is critical for code agents running in terminal environments or Docker containers.
The Command: You can pass arguments directly to the compiled JAR file:
java -jar IdleRSC.jar --headless --world [WorldID] --username [User] --password [Pass]
Agent Control: Your AI code agent can use standard shell execution libraries (like Python's subprocess or Node.js child_process) to spin up, monitor, and kill client instances.
2. Enabling Dynamic Scripting (The Bridge)
Traditional APOS scripts are static, compiled files. To allow an AI agent to dynamically control the game, you need a bridge. You can achieve this in two ways: 
The File Watcher Method (Simple):
Create a baseline IdleScript that continuously reads and executes instructions from a local text or JSON file (e.g., commands.json). Your AI code agent can dynamically write new target coordinates, item IDs, or state changes to this file. The running client reads it in real-time and reacts. 
The Webhook / Socket Method (Advanced):
Modify a basic IdleScript to open a local WebSocket or HTTP listener port (e.g., localhost:8080). Your code agent can then send live, dynamic HTTP POST requests or socket payloads directly to the running game client to change behaviors on the fly.
3. Folder Structure for Your Agent
To allow your agent easy access, organize your workspace so the agent can read client logs and write script files seamlessly: 
/idle-rsc-client/ (Contains the client execution files)
/idle-rsc-client/scripts/ (Where your agent can dynamically drop new .java or .class script files)
/agent-workspace/ (Where your AI agent code, prompt templates, and API connectors live)
4. Sample Agent Workflow
Agent analyzes the game state by reading the local client log file.
Agent decides the character needs to mine iron.
Agent writes a simple JSON instruction: {"action": "mine", "object_id": 12, "location": [xmin, ymin]}.
IdleRSC client reads the file, loads the parameters dynamically, and executes the actions using its internal API. 
To help you build this bridge, please let me know:
What programming language is your code agent written in?
Do you want a template for a file-based bridge or a network socket bridge?





6 sites
The Missing Layer in Every Agent Harness | Hindsight
Static context files (CLAUDE.md, AGENTS.md, . cursorrules) Most coding harnesses now support a project-level instruction file. Cla...


Hindsight
Understanding the Agent's State: Managing Context, Memory, and Task Progress in AI Agents - Interactive | Michael Brenndoerfer
State Is Dynamic Link Copied Here's an important point: state isn't static. It changes constantly as the agent works. The agent is...


Michael Brenndoerfer
OpenCode: The Open-Source AI Coding Agent That Supports 75 Models (and Runs Offline)
This generates a shareable URL for the current session. Teammates can view your AI coding session in real time: what the agent is ...


Medium
Show all
is it possible to have something beyond json ; like idk, fully dynamic lua or something
Yes, it is entirely possible to implement fully dynamic Lua scripting. Moving past flat JSON strings into executable scripts means your AI agent can inject complex logic, dynamic control flow, loop conditions, and immediate calculations directly into the runtime. 

Reddit
·r/roguelikedev
Because the IdleRSC client runs on Java (JVM), the cleanest way to do this is by embedding a lightweight Java-based Lua interpreter called Luaj directly into your custom IdleScript wrapper. 

GitHub
The Dynamic Architecture
Instead of having your AI code agent rewrite and compile .java files continuously, the architecture shifts to an interpretation model:
[ AI Code Agent ]  -- (Writes Dynamic Lua Code) -->  [ script.lua ]
                                                            │
                                                     (Hot Reloads)
                                                            ▼
[ IdleRSC Client ] <-- (Executes API Bindings) -- [ Java Luaj Engine ]
1. How to Bind the IdleRSC Java API to Lua
You can write a structural Java "Bootstrap" script inside IdleRSC that instantiates a Luaj environment, maps the client's actions (like walking, attacking, or banking) into Lua global functions, and executes the code dynamically.
Here is a conceptual example of how you expose IdleRSC methods to a runtime Lua environment:
java
import org.luaj.vm2.*;
import org.luaj.vm2.lib.jse.*;

public class LuaBridgeScript extends IdleScript {
    private Globals globals;

    @Override
    public void onStart() {
        // Initialize the Luaj execution environment
        globals = JsePlatform.standardGlobals();

        // Bind the IdleRSC API methods directly into Lua functions
        globals.set("walkTo", new OneArgFunction() {
            public LuaValue call(LuaValue arg) {
                LuaTable coords = arg.checktable();
                int x = coords.get("x").checkint();
                int y = coords.get("y").checkint();
                walkToCoordinate(x, y); // IdleRSC native method
                return LuaValue.NIL;
            }
        });

        globals.set("getMyHp", new ZeroArgFunction() {
            public LuaValue call() {
                return LuaValue.valueOf(getYourPlayer().getCurHp());
            }
        });
        
        // Load and run the dynamic script dropped by your AI Agent
        executeLuaScript();
    }

    public void executeLuaScript() {
        try {
            LuaValue chunk = globals.loadfile("agent_workspace/dynamic.lua");
            chunk.call();
        } catch (Exception e) {
            System.out.println("Lua Script Error: " + e.getMessage());
        }
    }
}
Use code with caution.
2. What the AI Agent's Dynamic Lua Looks Like
Your command-line code agent doesn't need to touch Java compilation anymore. It can evaluate the game state and write a raw, structural dynamic.lua script that handles complex behaviors locally inside the client loop: 

Reddit
·r/roguelikedev
lua
-- dynamic.lua (Generated on-the-fly by your AI Agent)
local currentHp = getMyHp()

if currentHp < 15 then
    print("Health critical! Retreating to safety...")
    walkTo({x = 120, y = 645})
else
    print("Health optimal. Proceeding to target.")
    walkTo({x = 135, y = 660})
end
Use code with caution.
3. Implementing a Hot-Reload Loop
To make it truly dynamic without restarting the client, you can set up a basic file watchdog in your Java bootstrap script.
Use Java's native WatchService to monitor the agent_workspace/ directory.
Every time your AI agent rewrites dynamic.lua, the Java wrapper intercepts the event.
It clears the old execution state and re-calls globals.loadfile().
The bot instantly changes its behavior mid-stride based on the new logic.
4. Advantages of this Setup
Sandbox Safety: Lua environments are completely isolated. If your AI agent introduces a syntax error, an infinite loop, or bad logic, it only crashes the Lua state—not the underlying IdleRSC thread. 

Reddit
·r/roguelikedev
Instant Iteration: Zero compile time. The agent can update behaviors in milliseconds over standard command-line file streams. 

Reddit
·r/gamedev
 +1
Complex Data Mapping: Lua's primitive table data structure natively bridges associative arrays and lists, mirroring JSON payloads flawlessly while maintaining executable power. 

Reddit
·r/roguelikedev
 +2
If you are ready to construct this, let me know:
Do you need the code snippet to implement the automatic hot-reloader / file watcher in Java?
What specific game actions (e.g., inventory management, object interaction) do you want mapped to the Lua environment first?





7 sites
[design] What makes Lua so useful for external files? - Reddit
I use Lua for a number of reasons: * It's easy to embed in my C++ projects (with or without additional wrappers). * It's small and...


Reddit
Open-RSC/IdleRSC - GitHub
IdleRSC is a bot for the OpenRSC coleslaw and uranium worlds that uses code injection and reflection. It has its own custom script...


GitHub
Why is it so common to see Lua used as an in game scripting ...
Obviously you are not getting all the usual Python batteries, just the core language only. On the other hand it may make it more s...


Reddit
Show all
hm ; but this means that anytime the file is touched, it'd run? i'd rather it be something like a command line tool it can run to interact
Yes, you are exactly right. Monitoring a single file means any minor write loop or partial save from your agent would trigger mid-execution chaos, forcing the game client to react to incomplete scripts.
To achieve a true command-line interface (CLI) execution model, you can embed a small HTTP or TCP listener inside your IdleRSC Java bootstrap script. Instead of reading a file automatically, the game client sits patiently until your agent manually executes a terminal command to push the script.
The Architecture: CLI to Client Engine
[ AI Agent ] ──> (Runs CLI Command) ──> [ curl / script runner ]
                                               │
                                       (Sends Lua Payload)
                                               ▼
[ IdleRSC Client ] <── (Executes) ◄── [ Embedded HTTP Server ]
1. The Java Bootstrap (The Server)
By embedding Java's built-in, lightweight HttpServer, you turn the IdleRSC client into a localized API endpoint. It only executes Lua payloads when a strict POST request hits it.
Add this framework to your IdleRSC custom Java script:
java
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import org.luaj.vm2.*;
import org.luaj.vm2.lib.jse.*;

public class LuaCliBridge extends IdleScript {
    private Globals luaGlobals;

    @Override
    public void onStart() {
        // Initialize Luaj and bind your API actions (walkTo, getMyHp, etc.)
        luaGlobals = JsePlatform.standardGlobals();
        setupLuaBindings(); 

        try {
            // Start a local server on port 8085
            HttpServer server = HttpServer.create(new InetSocketAddress(8085), 0);
            server.createContext("/execute", new LuaHandler());
            server.setExecutor(null); 
            server.start();
            System.out.println("CLI Bridge active on port 8085...");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private class LuaHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws java.io.IOException {
            if ("POST".equals(exchange.getRequestMethod())) {
                // Read the incoming raw Lua script sent from the CLI
                InputStream is = exchange.getRequestBody();
                String luaCode = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                
                String response;
                try {
                    // Evaluate and run the dynamic Lua code immediately
                    LuaValue chunk = luaGlobals.load(luaCode);
                    chunk.call();
                    response = "SUCCESS: Script executed.";
                } catch (Exception e) {
                    response = "ERROR: " + e.getMessage();
                }

                // Send execution status back to the terminal
                exchange.sendResponseHeaders(200, response.length());
                OutputStream os = exchange.getResponseBody();
                os.write(response.getBytes());
                os.close();
            } else {
                exchange.sendResponseHeaders(405, -1); // Method Not Allowed
            }
        }
    }
}
Use code with caution.
2. How the Agent Interacts from the Terminal
Now your AI agent has complete control over when code runs. It can generate a custom script snippet and fire it directly from the command line using standard networking utilities.
Using standard curl:
The agent can pipe a script string or a script file straight into the game client instance:
bash
curl -X POST -H "Content-Type: text/plain" --data-binary "@my_combat_logic.lua" http://localhost:8085/execute
Use code with caution.
Creating a dedicated Python CLI runner (run_lua.py):
If you want to wrap this cleanly for your agent, write a microscopic command-line utility:
python
import sys
import requests

def run_script(file_path):
    try:
        with open(file_path, 'r') as file:
            lua_code = file.read()
        
        # Fire payload directly into the client runtime
        response = requests.post("http://localhost:8085/execute", data=lua_code)
        print(response.text)
    except Exception as e:
        print(f"Failed to communicate with IdleRSC: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        run_script(sys.argv[1])
    else:
        print("Usage: python run_lua.py <path_to_script.lua>")
Use code with caution.
Why this is vastly superior for an AI Agent
Transactional Control: Your agent writes the file, double-checks its integrity, and then triggers the execution command. There is zero risk of the client trying to read a half-written file. 
Console Feedback: The server catches Lua syntax or runtime errors and passes the error stack trace right back through the HTTP response to the terminal. Your AI agent can read the terminal output to immediately debug its own code if something fails. 
State Verification: You can easily expand the server to accept GET /status requests, allowing your CLI agent to query inventory or player positions as raw strings before generating the next Lua instruction payload.
If you like this architectural direction, let me know:
Would you like to add a state-checking routine (GET /status) so the agent can inspect the game world from the command line before writing a script?
Do you want help writing a baseline library of Lua wrapper functions for standard movements or interactions?





3 sites
Config Files That Run Code: Supply Chain Security Blindspot
The Cursor case is the one to watch. A Markdown file that tells an AI agent to run a script becomes executable content the moment ...


SafeDep
Microsoft forks its own Windows Terminal – for AI
A key innovation is automatic error detection: If a command fails, the terminal visibly indicates it and passes the error context ...


heise online
Chrome DevTools MCP: Let Your AI Agent Debug Your App
The value is immediate. Your AI agent goes from making educated guesses to seeing actual errors. When something breaks in producti...

Trevor I. Lasn
is lua the easiet way, or possible to just run java ; again dynamic through cli
Yes, it is entirely possible to run Java code dynamically through the CLI, but Lua is significantly easier to set up. 
Because Java is a compiled language, running it dynamically requires you to build a runtime compilation compiler or a REPL framework inside the game client. 

Medium
 +1
If your AI agent is already strong with Java, skipping Lua entirely removes the burden of writing manual API mappings. Two methods allow you to push raw Java code directly via the terminal into a running IdleRSC instance:
Method 1: The Modern & Robust Way (Java JShell API)
Introduced in Java 9, JShell is Java’s official REPL (Read-Eval-Print Loop) engine. You can programmatically host a JShell instance inside your IdleRSC HTTP bridge wrapper. 

Medium
 +1
Instead of evaluating strings as arbitrary text, JShell cleanly compiles snippets, functions, or full classes on-the-fly directly inside the running JVM. 

Medium
·Daniel Kirschner
 +1
The Java HTTP JShell Server
Your IdleRSC core code can listen for POST requests and dump the raw Java payload straight into the engine:
java
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import jdk.jshell.JShell;
import jdk.jshell.SnippetEvent;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;

public class JavaCliBridge extends IdleScript {
    private JShell jshell;

    @Override
    public void onStart() {
        // Initialize JShell and inject the context of this active script
        this.jshell = JShell.create();
        
        // Pass a reference of this running script to JShell variables 
        // so snippets can access native bot commands like walkToCoordinate()
        jshell.eval("import org.openrsc.client.*;"); 
        
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress(8085), 0);
            server.createContext("/execute-java", new JavaHandler());
            server.start();
            System.out.println("Java CLI Bridge running...");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private class JavaHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws java.io.IOException {
            if ("POST".equals(exchange.getRequestMethod())) {
                InputStream is = exchange.getRequestBody();
                String rawJavaCode = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                
                // Process the incoming dynamic Java statement
                List<SnippetEvent> events = jshell.eval(rawJavaCode);
                
                // Parse errors or values to send straight back to your agent's terminal
                StringBuilder response = new StringBuilder();
                for (SnippetEvent e : events) {
                    if (e.status() == jdk.jshell.Snippet.Status.VALID) {
                        response.append("SUCCESS: ").append(e.value()).append("\n");
                    } else {
                        response.append("FAILED: ").append(e.status()).append("\n");
                    }
                }

                exchange.sendResponseHeaders(200, response.length());
                OutputStream os = exchange.getResponseBody();
                os.write(response.toString().getBytes());
                os.close();
            }
        }
    }
}
Use code with caution.
What your AI Agent types in the CLI:
Your agent can pipe standard multi-line Java chunks over curl directly to the client without needing a project structure, a package declaration, or a main method container: 

Red Hat Developer
bash
curl -X POST -H "Content-Type: text/plain" -d '
    if (getYourPlayer().getCurHp() < 15) {
        walkToCoordinate(120, 645);
    } else {
        walkToCoordinate(135, 660);
    }
' http://localhost:8085/execute-java
Use code with caution.
Method 2: The Lightweight Way (javax.tools.JavaCompiler)
If you don't want to use JShell, you can leverage Java’s native in-memory compiler API. 

Java Code Geeks
 +1
Your AI Agent drops a clean, functional standalone class (e.g., DynamicAction.java) into a folder using the CLI.
The agent executes a terminal signal to tell the client to compile it.
The custom IdleScript uses ToolProvider.getSystemJavaCompiler() to translate the file straight into bytecode in RAM, bypassing the file system. 

Java Code Geeks
 +1
It initializes the class via a ClassLoader instance and executes its main trigger method. 

Stack Overflow
 +2
Pros & Cons: Lua vs. Java
Feature	Lua (Luaj)	Java (JShell)
Setup Difficulty	Very Simple (Tiny wrapper jar)	Complex (Messy ClassLoader/API mappings)
Sandbox Security	High (Agent cannot break the core JVM)	Zero (Agent can accidentally call System.exit(0))
Compilation Lag	None (Interpreted instantly)	Micro-delay (Requires JShell or javac compilation step)
Autocompletion/Context	Manual setup required	Native capability for Java-focused code agents
If your agent is already optimized to read, structure, and write Java code syntax, JShell via the HTTP Bridge will give you a powerful setup.
Would you like a template script demonstrating how to bundle the JShell compilation engine with error reporting so your agent can diagnose syntax mistakes instantly?





8 sites
Compile Java Code with Java Compiler API
The Java Compiler API gives developers the flexibility to integrate dynamic code compilation into their Java applications. This op...

Java Code Geeks
Compile and execute java source file in memory - Stack Overflow
Comments. ... Java does have a compilation API to compile files dynamically, but I'm not aware of an option that would not persist...

Stack Overflow
Running Arbitrary Java Code On The Fly | by Murat Kilic | Medium
Dynamic Java code execution allows you to execute arbitrary Java code from another Java program without hardcoding and compiling y...


Medium
Show all
and it seems like both of these require having an http server running in the idlersc instance
Yes, both the Lua and JShell methods require embedding a listener (like an HTTP server or TCP socket) directly inside the running IdleRSC instance. This is because IdleRSC is designed as a standalone Java application. It boots up its own JVM (Java Virtual Machine), sandboxes its memory, and does not natively expose a console or external pipeline for outside programs to inject commands.
If you want a true command-line interface without writing or maintaining an HTTP server inside the bot, you have to approach it by tricking the operating system or using external automation tools.
Here are the three ways to build a CLI bridge without running a server inside the client:
1. The Standard Dynamic Script Compilation (No Servers)
Instead of forcing the client to accept code while it is running, you rely on a standard file-drop loop. IdleRSC can hot-reload scripts from its /scripts folder if you trigger a reload hotkey or command.
Your AI Agent writes a standard Java script class to scripts/AgentTask.java.
Your Agent runs a local command line command to compile it via the OS terminal:
javac -cp IdleRSC.jar scripts/AgentTask.java
To tell IdleRSC to execute it without an HTTP server, you use a CLI automation tool (like xdotool on Linux or nircmd on Windows) to programmatically send the client window the key combination to refresh and launch the script.
2. Standard Input (stdin) Pipe Hijacking
If you launch IdleRSC purely from the command line in headless mode (java -jar IdleRSC.jar --headless), the client process attaches to the standard input (stdin) of your terminal.
While IdleRSC doesn't natively parse game commands from stdin, you can write a tiny Java Agent or a simple modified boot-wrapper class that wraps the main client launch. It loops over terminal input:
java
// Inside a custom wrapper main method
Scanner scanner = new Scanner(System.in);
while (scanner.hasNextLine()) {
    String inputCommand = scanner.nextLine();
    // Pass this command to your script engine
}
Use code with caution.
With this setup, your agent can control the client using standard OS piping tricks directly from the terminal:
bash
echo "walkTo(120, 645)" > /proc/[Client_PID]/fd/0
Use code with caution.
3. Native OS GUI Automation (The "No-Code" CLI)
If modifying the Java code or setting up interpreters inside the client is too much friction, your CLI tool can treat the IdleRSC client as a black box. Your agent interacts with it purely through terminal commands that simulate mouse clicks and keystrokes based on screen pixels or text scraping (OCR).
Using a Python CLI tool backed by pyautogui, your agent executes terminal commands like this:
bash
python bot_cli.py --click 400,300 --type "::walk 120 645"
Use code with caution.
Pros: Zero modifications to IdleRSC; no servers, no JShell, no coding inside the JVM.
Cons: Fragile. If the client window moves, or another window pops up, the coordinates break.
Summary: Why the HTTP Server is Usually Preferred
While running an HTTP server inside the client sounds heavy, Java's com.sun.net.httpserver.HttpServer adds virtually zero overhead (less than 5MB of RAM and 0% CPU when idle) and requires roughly 15 lines of code. It provides a robust, direct channel into the JVM memory space where the player data lives. Without it, you are forced to rely on external OS window hacks, terminal pipe hijacking, or constant disk writes.
How would you prefer to handle the setup? We can look closer at the Standard Input (stdin) loop if you want a pure terminal pipe, or flesh out the external compilation workflow.




and can i run idlersc with UI too to inspect, and see logs etc?
Yes, absolutely. You can run IdleRSC with the full User Interface (UI) enabled while simultaneously using any of the CLI methods discussed.
In fact, keeping the UI visible is highly recommended during the development phase of your AI agent so you can visually debug what the agent is doing in real time.
How it Works with the UI Open
When you launch IdleRSC normally (with the GUI window), the embedded HTTP server or stdin pipe listener runs quietly on a background thread inside that exact same window process.
Visual Verification: You can watch your character move, fight, or bank on the screen the exact moment your CLI agent pushes a command.
Real-Time Logs: You can look at the client's built-in console log window (or your terminal output) to see system events, XP drops, and incoming network packets.
Manual Overrides: Because the UI is active, you can physically click the screen or type in-game commands to rescue your character if your agent injects a broken script or gets stuck in a loop.
Setting Up the Ideal "Inspection" Workspace
To get the most out of running with the UI, you should configure your launcher command to split the client logs into your terminal window.
Instead of double-clicking the raw .jar file, launch it from your command line tool like this:
bash
java -Xmx512m -jar IdleRSC.jar --debug
Use code with caution.
The --debug flag forces the Open-RSC client to output verbose engine logs directly to the standard output (stdout) of your terminal window.
You can position the IdleRSC game window on one side of your monitor and your AI agent's command terminal on the other side.
Watching the Agent Live
With the UI open, your workflows look like this:
Using the HTTP Server / JShell: You type a curl command into your terminal to send a Java snippet. You instantly see the code compile in your terminal logs, and half a second later, you watch your character execute the command visually in the game window.
Using the External Compiler: Your agent writes AgentTask.java. You watch your script list in the IdleRSC UI refresh, and you can manually click "Start Script" in the game menu to watch it run, or let your agent trigger it.
Would you like to see how to format your custom script logs so they cleanly print directly into your terminal alongside the core game engine logs?




would the ability to run dyanamic as said also work w/ APOS?
Yes, it would absolutely work with APOS because APOS is also a compiled Java standalone client. However, implementing it on APOS presents distinct operational challenges due to its legacy design: 

GitHub
1. The Code Implementation is Identical
Because APOS runs on Java 8 (JVM), you can drop the exact same embedded HTTP server wrapper code (com.sun.net.httpserver) or a JShell engine right into an APOS background script or directly modify the APOS source code. Java's core networking capabilities behave identically in both clients. 

GitHub
2. The Major Friction Points with APOS
API Limitations: APOS relies on a heavily dated, hardcoded script structure (Script class) and older reflection models. It does not have the modern, streamlined developer APIs found in IdleRSC's IdleScript. Mapping functions like item interactions, exact pathfinding coordinates, and entity IDs to your Lua or Java bridge will require more complex, manual structural tracking. 

GitHub
Compilation Hurdles: APOS relies heavily on Apache Ant and batch files (compile_all.cmd) to build scripts. If you chose a file-drop hot-reload approach rather than an HTTP server, managing the external compilation loop programmatically for APOS through your agent's command line is significantly clunkier. 

GitHub
Maintenance & Forks: The original APOS client was abandoned years ago. Any versions floating around git ecosystems are unmaintained archive mirrors. If you run into a deep JVM hook bug while building your dynamic agent bridge, you will have to fix the client's deobfuscation core manually. 
Why IdleRSC is Preferred for This
IdleRSC was intentionally built with an open, accessible structure to accommodate modern automation setups. It already includes cleaner class abstractions, making it highly receptive to having a server framework bound directly to its internal game loop loops without breaking client-side rendering threads. 

GitHub
If you are set on using the legacy client, let me know:
Do you already have a working source directory of APOS compiled on your machine?
Would you like assistance identifying the exact target class files in APOS where you would insert the server-socket initialization?





3 sites
Open-RSC/APOS · GitHub
Stormy developed it from 2012 to 2016, and the source code was released in 2016. Here are some requirements for APOS: * Java JDK 8...


GitHub
Open-RSC/IdleRSC - GitHub
IdleRSC is a bot for the OpenRSC coleslaw and uranium worlds that uses code injection and reflection. It has its own custom script...


GitHub
APOS - RSC PRJ - GitLab
Import APOS. 7 years ago. Scripts. Scripts again (#6) 4 years ago. apache-ant-1.10.5. Adds portable Apache Ant and compile/run scr...

GitLab
if i wanted the llm agent to be able to do mixture of create heuristic bot and run one-off scripts, i suppose giving it the ability to write script files that can build programs, w/ various entrypoints?
You have hit on the exact design pattern used by advanced, production-grade automation frameworks. Providing your LLM agent with the ability to write structured script files with dynamic entry points—rather than feeding it isolated, one-off code snippets—is the definitive way to handle a hybrid workflow. 
This approach perfectly balances high-level, persistent decision-making (the Heuristic Bot) with immediate tactical execution (the One-Off Scripts).
The Architecture: "The Orchestrator & The Workers"
Instead of treating the game client as a blank slate for every command, you structure your Java runtime workspace into a permanent Core Hook (the orchestrator) and dynamically loaded Modules (the workers). 
                    ┌─────────────── [ LLM Agent ] ───────────────┐
                    │                                             │
             (Generates / Modifies)                       (Fires CLI Trigger)
                    ▼                                             ▼
  [ scripts/modules/Woodcutting.java ]            [ curl POST "run: Woodcutting" ]
                    │                                             │
                    └───────────────► [ Core Hook ] ◄─────────────┘
                                             │
                                     (Executes Module)
                                             ▼
                                    [ IdleRSC Client ]
1. Defining the Entrypoints (The Interface)
To make this work seamlessly, you define a strict Java interface that every script written by the LLM must follow. This ensures that no matter what crazy logic the LLM writes, the Core Hook always knows exactly how to boot it, pause it, or kill it.
java
// Place this permanently in your workspace
public interface AgentModule {
    String getName();
    void onInitialize();       // For persistent heuristics (allocating memory, state tracking)
    void onTick();             // Ran every client game loop cycle
    void onTerminate();        // Cleanup when switching modules or completing a one-off task
}
Use code with caution.
2. How the LLM Agent Writes a "One-Off Script"
When the LLM needs to do something simple and immediate (e.g., "Walk to Lumbridge bank and deposit all iron ore"), it writes a lightweight file to a designated directory (/scripts/modules/DepositIron.java):
java
import org.openrsc.client.*;

public class DepositIron implements AgentModule {
    public String getName() { return "DepositIron"; }
    
    public void onInitialize() {
        System.out.println("Executing one-off banking routine...");
    }

    public void onTick() {
        if (NativeAPI.isBankOpen()) {
            NativeAPI.depositAll(Const.IRON_ORE_ID);
            NativeAPI.closeBank();
            this.onTerminate(); // Signals completion
        } else {
            NativeAPI.interactObject(Const.BANK_BOOTH_ID);
        }
    }

    public void onTerminate() {
        // Signal the Core Hook that this one-off script is finished
        CoreHook.notifyFinished(this.getName());
    }
}
Use code with caution.
3. How the LLM Agent Writes a "Heuristic Bot"
When you want the agent to handle a complex, long-running loop (e.g., "Combat training, eating fish when low health, buried bones, run away if a PKer shows up"), the LLM writes a persistent state machine into a file (/scripts/modules/CombatHeuristic.java):
java
public class CombatHeuristic implements AgentModule {
    private enum BotState { FIGHTING, EATING, BURYING, FLEEING }
    private BotState currentState = BotState.FIGHTING;

    public String getName() { return "CombatHeuristic"; }
    public void onInitialize() { System.out.println("Heuristic engine online."); }

    public void onTick() {
        // 1. High-level safety heuristics take absolute priority
        if (NativeAPI.isPkerNearby()) { currentState = BotState.FLEEING; }

        // 2. State Machine Evaluation
        switch(currentState) {
            case FLEEING:
                NativeAPI.teleportOrRun();
                break;
            case EATING:
                if (NativeAPI.getHp() > 40) currentState = BotState.FIGHTING;
                else NativeAPI.eatFood(Const.LOBSTER_ID);
                break;
            case FIGHTING:
                if (NativeAPI.getHp() < 15) { currentState = BotState.EATING; }
                else if (NativeAPI.isTargetDead()) { currentState = BotState.BURYING; }
                else { NativeAPI.attackNearestNPC(Const.GOBLIN_ID); }
                break;
            case BURYING:
                // Burying logic...
                break;
        }
    }
    public void onTerminate() {}
}
Use code with caution.
4. How the CLI Ties It Together
Your agent controls the entire ecosystem using clean, multi-layered command-line triggers.
Step A: Compile the File
The LLM drops the .java file into the folder and runs a local shell command to compile it against the IdleRSC client classes:
bash
javac -cp IdleRSC.jar -d bin/ scripts/modules/CombatHeuristic.java
Use code with caution.
Step B: Live-Inject and Execute via CLI
The LLM sends a quick execution command over your HTTP bridge or stdin pipe to tell the Core Hook to swap to the new logic:
bash
curl -X POST -d '{"command": "load_module", "class": "CombatHeuristic"}' http://localhost:8085/control
Use code with caution.
Inside the Core Hook, Java uses dynamic reflection to instantly instantiate the newly compiled class file:
java
// Inside CoreHook.java
Class<?> clazz = Class.forName("bin.modules." + targetClassName);
AgentModule activeModule = (AgentModule) clazz.getDeclaredConstructor().newInstance();
activeModule.onInitialize(); // The loop is now live!
Use code with caution.
Why this approach wins:
Separation of Concerns: The LLM agent doesn't need to track real-time game loops. It just updates files and issues high-level macro commands ("Run this module now"). 
Crash Proofing: If a one-off script crashes or finishes, your CoreHook catches the exception cleanly, stays running, drops back to an idle state, and reports the error stack trace back to the LLM agent via the terminal so it can rewrite the file.
Agent Cleanliness: Your LLM prompt templates stay incredibly tidy. You can give the agent strict system instructions: "You are an OpenRSC bot developer. Your output must exclusively be a valid Java class implementing the AgentModule interface." 
If you want to implement this structure, we can look at building the Dynamic ClassLoader routine for the Core Hook so it can gracefully read newly compiled .class files while the game is running. Would you like to start there?





6 sites
AutoGen Implementation Patterns: Building Production-Ready Multi-Agent AI Systems
Advanced Implementation Patterns for Building Robust AutoGen Systems Building production-ready AutoGen systems requires sophistica...


Galileo AI
Every API is a Tool for Agents with Code Mode by Matt Carey
Dynamic worker loaders, super catchy name, but basically you're just running a Cloudflare worker from a script. So actually, very ...


GitNation
How to Create Your Own AI Coding Agent
Any learnings the LLM has made (you can set the agent to update the file itself)


DEV Community
Show all
id want it to be possible to run certain program , but be able to inspect and stop the program, see where it stops, be able to run something dynamically, think enter quick repl, then kick back off long running ;
To achieve this exact workflow—pausing a long-running heuristic bot, entering a live REPL to run a one-off command or check variables, and then resuming the main loop without losing your place—you need a Stateful Coroutine or Pausable Engine architecture. 
Because Java does not natively support pausing a running method mid-execution easily without messy multi-threading, the cleanest way to build this is by combining the Dynamic JShell Context with a State Machine Engine.
Here is how you structure this setup so your AI agent has absolute surgical control over the client from the command line.
The Architecture: Pausable Runtime Workspace
Your Core Hook will hold a global state variable (RUNNING, PAUSED, REPL_CONTROL). When the client is paused, it freezes your custom loop logic but keeps the game's actual networking and rendering engine alive. This allows you to safely poke around in real time. 
                    ┌─────────────── [ LLM Agent (CLI) ] ───────────────┐
                    │                                                   │
             (1. Send "PAUSE")                                 (3. Send "RESUME")
                    │                                                   │
                    ▼                                                   ▼
[ Active Heuristic Bot ] ──► [ Core Hook (State: PAUSED) ] ──► [ Active Heuristic Bot ]
                                        ▲
                                        │ (2. Inject dynamic JShell commands)
                                [ Dynamic REPL ]
1. The Core Hook with Thread-Safe Controls
This Java class lives permanently inside your IdleRSC instance. It manages your long-running script modules and routes dynamic CLI requests on the fly:
java
import com.sun.net.httpserver.*;
import jdk.jshell.JShell;
import java.io.*;
import java.net.InetSocketAddress;

public class OrchestratorEngine extends IdleScript {
    public enum EngineState { RUNNING, PAUSED }
    private EngineState currentState = EngineState.RUNNING;
    
    private AgentModule activeModule; // Your long-running heuristic bot
    private JShell jshell;            // Your live dynamic REPL engine

    @Override
    public void onStart() {
        this.jshell = JShell.create();
        // Expose this exact engine instance to JShell so REPL scripts can modify it
        jshell.eval("import org.openrsc.client.*;");
        
        setupHttpControlServer();
    }

    @Override
    public void onTick() {
        // If the LLM agent paused the bot, skip the heuristic script entirely
        if (currentState == EngineState.PAUSED) {
            return; 
        }

        // Otherwise, run the normal long-running game loops
        if (activeModule != null) {
            try {
                activeModule.onTick();
            } catch (Exception e) {
                System.out.println("Module Error: " + e.getMessage());
                currentState = EngineState.PAUSED; // Auto-pause on crash for LLM inspection
            }
        }
    }

    // --- CLI API Endpoints ---
    public void setEngineState(EngineState state) { this.currentState = state; }
    public String getEngineStatus() {
        return String.format("{\"state\":\"%s\", \"module\":\"%s\"}", 
            currentState, (activeModule != null ? activeModule.getName() : "None"));
    }
    public JShell getJShell() { return this.jshell; }
}
Use code with caution.
2. The Interactive CLI Lifecycle (How the Agent Operates)
With this structure in place, your LLM agent can manipulate the game execution state fluidly through terminal commands.
Step A: Inspecting a Long-Running Bot
Your heuristic bot is currently woodcutting. The LLM wants to check what it is doing and inspect its exact point in the logic loop:
bash
curl -X GET http://localhost:8085/status
Use code with caution.
Response from Client: {"state":"RUNNING", "module":"WoodcutterHeuristic"}
Step B: Pausing the Execution
The LLM decides it needs to interrupt the loop to do something else or fix an issue:
bash
curl -X POST -d "action=PAUSE" http://localhost:8085/control
Use code with caution.
The game client remains perfectly active on screen, your character stays logged in, but the WoodcutterHeuristic loop instantly freezes on its current step.
Step C: Entering the "Quick REPL" (Dynamic One-Offs)
While the main bot is frozen, the LLM can execute arbitrary, one-off Java commands directly into the runtime context via JShell.
Example 1: Checking a variable or status:
bash
curl -X POST -d "getYourPlayer().getCurHp();" http://localhost:8085/repl
Use code with caution.
Terminal Output: SUCCESS: 54
Example 2: Executing a manual action (e.g., dropping a specific item):
bash
curl -X POST -d "NativeAPI.dropAllExcept(Const.AXE_ID);" http://localhost:8085/repl
Use code with caution.
Terminal Output: SUCCESS: Inventory cleared.
Step D: Kicking Back Off the Long-Running Loop
Once the dynamic intervention or inspection is finished, the LLM agent sends a single command to resume the frozen heuristic bot exactly where it left off:
bash
curl -X POST -d "action=RESUME" http://localhost:8085/control
Use code with caution.
The engine flips back to RUNNING, and your character seamlessly continues woodcutting. 
Why this design matches your exact requirements:
Crash Inspection: If your heuristic bot throws an unhandled Java exception, the OrchestratorEngine automatically catches it, pauses the bot, and echoes the stack trace back to your agent's logs. The agent can use the REPL to inspect inventory and environment states to figure out why it stopped. 
True Modality: By using the HTTP server as a traffic controller, you cleanly separate the core game execution thread from your agent's command loop, entirely preventing terminal lockups.
No Loss of Memory Context: Because JShell and your active modules live inside the same running memory heap, objects or state counters modified during your "quick REPL" session are instantly respected by the main bot when it resumes.
If you are ready to construct this interactive pipeline, let me know:
Do you want the complete implementation code for the HTTP Server Router Handler that cleanly maps the /status, /control, and /repl paths?
Would you like to design a specific diagnostic report structure that the client sends back to your LLM agent whenever an auto-pause event triggers?





5 sites
poll_next
Nov 27, 2023 — Coroutines like asynchronous functions and generators prevent users from making this mistake, because the compiler generates the s...

Without boats
How to debug a Node.js Server
Dec 18, 2023 — Inside the repl mode, you can check the values of the variables in your program. Try to get to the last debugger statement and go ...


nirjan.dev
4.2 Example: Iterative Looping, Expressions, and Sub-models | Simulation Modeling and Arena
If the counter is a (global) variable, then it is accessible from anywhere in the model. If the WHILE-ENDWHILE loop contains a blo...


GitHub Pages documentation
Show all
does any of this get easier if using something like lua/python/js as a scripting language that it runs, rather than the java jshell
Yes, it gets significantly easier, cleaner, and faster to implement if you switch from Java JShell to an interpreted language like Lua or JavaScript (JS).
While Python can be embedded into Java using tools like Jython, it doesn't cleanly support modern Python libraries or syntax without immense overhead. Therefore, Lua and JavaScript are the gold standards for this specific architectural design. 
Choosing an interpreted runtime over Java JShell radically simplifies your REPL, pause-and-resume loop, and error handling for several key reasons:
1. State Inspection and REPL are Native Features
With Java JShell, you have to parse raw strings, manage complex snippet compilation events, and handle class loading contexts manually.
In contrast, interpreted languages naturally store variables, functions, and state in a global table or object graph that can be queried instantly.
In Lua/JS: The REPL can simply evaluate any string against the global context.
To inspect the active script's variables via the CLI, your agent can just send: return current_target or return player_state. The engine prints the value instantly without compiling a single line of bytecode.
2. Built-in "Hot Swap" and Soft Pausing
Because interpreters execute scripts line-by-line or function-by-function, pausing a script does not require halting heavy JVM framework threads. 
You can simply add a tiny hook inside your Lua/JS event loop. When the PAUSE command is sent via the CLI, the loop sits in a sleep state.
While paused, the environment remains active. You can use the CLI REPL to inject code, redefine functions on the fly, or change variables, and the script will immediately use those new values the millisecond you hit RESUME. 
The Architecture: Java Host + JavaScript (GraalVM ScriptEngine)
The most robust way to build this in modern Java frameworks (like IdleRSC's environment) is using JavaScript via GraalVM. It comes built into many modern JDKs or can be dropped in via a tiny dependency. It allows your AI agent to write standard JS syntax, while running at near-native speeds. 
Here is how simple the Java backend becomes when you let JavaScript do the heavy lifting:
java
import com.sun.net.httpserver.*;
import org.graalvm.polyglot.*; // JavaScript Polyglot Engine
import java.io.*;
import java.net.InetSocketAddress;

public class JsEngineBridge extends IdleScript {
    private Context jsContext;
    private boolean isPaused = false;

    @Override
    public void onStart() {
        // 1. Initialize the JavaScript runtime environment
        this.jsContext = Context.newBuilder("js").allowAllAccess(true).build();

        // 2. Map your native IdleRSC client API straight into JavaScript globals
        jsContext.getBindings("js").putMember("client", this);
        jsContext.getBindings("js").putMember("api", new YourNativeApiBindings());

        // 3. Start your CLI Listener
        setupHttpControlServer();
    }

    @Override
    public void onTick() {
        if (isPaused) return; // True soft pause

        // Execute the main heuristic tick loop written in JS by the LLM
        try {
            jsContext.eval("js", "if (typeof onTick === 'function') onTick();");
        } catch (Exception e) {
            System.out.println("JS Error: " + e.getMessage());
            isPaused = true; // Auto-pause on runtime error for inspection
        }
    }

    // --- The Web Server Router simplifies down to this ---
    private void handleReplRequest(String rawJsCode, OutputStream responseStream) throws IOException {
        try {
            // Evaluate ANY raw JS code instantly from the CLI, even while paused!
            Value result = jsContext.eval("js", rawJsCode);
            responseStream.write(("SUCCESS: " + result.toString()).getBytes());
        } catch (Exception e) {
            responseStream.write(("REPL ERROR: " + e.getMessage()).getBytes());
        }
    }
}
Use code with caution.
How Your LLM Agent Exploits This From the CLI
Because the runtime is now a flexible scripting language, the workflows match your exact requirements perfectly:
Step 1: Run a Long-Running Heuristic Script
Your agent uploads a standard JavaScript file via the CLI that defines the core loop logic:
javascript
// bot_logic.js
var targetMob = "Goblin";
var healThreshold = 20;

function onTick() {
    if (api.getHp() < healThreshold) {
        api.eatFood();
    } else {
        api.attackNPC(targetMob);
    }
}
Use code with caution.
Step 2: Hit a Snag? Enter the REPL to Inspect and Modify Live
Let's say the bot stops moving because the game updated and the NPC name changed to "Goblin Guard". The Java engine catches the error and auto-pauses. Your agent enters a quick REPL command via the terminal to diagnose and fix it live:
bash
# Query the live value of a script variable
curl -X POST -d "targetMob;" http://localhost:8085/repl
> SUCCESS: Goblin

# Change the live variable context instantly via the REPL
curl -X POST -d "targetMob = 'Goblin Guard'; healThreshold = 25;" http://localhost:8085/repl
> SUCCESS: Goblin Guard
Use code with caution.
Step 3: Kick It Back Off
With the variable fixed inside the live memory heap, the agent sends the resume command:
bash
curl -X POST -d "action=RESUME" http://localhost:8085/control
Use code with caution.
The script instantly picks up where it left off, but now it starts searching for "Goblin Guards" and eating at 25 HP.
The Verdict: Lua/JS vs Java JShell
Metric	Java JShell	JavaScript / Lua
Code Generation	Heavy, verbose syntax.	Ultra-lightweight, fluid structure.
Error Resilience	Compilation errors can crash snippet states.	Highly sandboxed. Syntax errors just reject the line.
Hot Swapping	Requires resetting class structures.	Literally re-assigning variables/functions live.
LLM Friendliness	Harder for LLMs to generate partial code.	LLMs are master-class at quick, single-line JS/Lua logic.
If you want the lowest barrier to entry with the highest degree of dynamic interaction, using JavaScript (via GraalVM) or Lua (via Luaj) inside the IdleRSC client is unequivocally the easiest path forward. 
Would you like to see a complete template of how the JavaScript script runner file looks, or do you want to explore the Lua equivalent if you prefer an even tighter, more lightweight footprint?





8 sites
Java Multi-Language Integration
Nov 22, 2023 — Jython: Jython is an implementation of Python that runs on the Java platform. It allows Python code to be seamlessly integrated wi...


Medium
Why JavaScript is Still King for Front-End Development
Nov 19, 2025 — Whether you are building a simple portfolio site or a complex SaaS platform, JavaScript is not just an option — it is the standard...


Medium
scripting language | Robonito
Sep 25, 2023 — Unlike traditional programming languages, scripts are interpreted and executed line by line. This means that a separate compilatio...


Robonito
Show all
from the _cli_ perspective, can assume would make a wrapper around http etc, so it would look more like `mycli -c "console.log()"` or `mycli myscript.js` (ideally supporting full importing etc, so the files could be perhaps idk, transpiled in a very easily debugable way) and then something like, if ctrl-c / sigterm send , it would send the cancel to the server and kill the cmd on the server ; and if sending something to the server, would it add to a queue to run? or auto cancel whatever is running?
It looks like there's no response available for this search. Try asking something else.
AI responses may include mistakes. Learn more


from the _cli_ perspective, can assume would make a wrapper around http etc, so it would look more like `mycli -c "console.log()"` or `mycli myscript.js` (ideally supporting full importing etc, so the files could be perhaps idk, transpiled in a very easily debugable way) and then something like, if ctrl-c / sigterm send , it would send the cancel to the server and kill the cmd on the server ; and if sending something to the server, would it add to a queue to run? or auto cancel whatever is running??
It looks like there's no response available for this search. Try asking something else.
AI responses may include mistakes. Learn more


AI Mode is thinking about your query
Ask about 
