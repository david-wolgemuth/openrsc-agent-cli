The Model

The [10 principles].
Token-efficient output — Use TOON format for ~40% token savings over JSON
Minimal default schemas — 3–4 fields per list item, not 10+
Content truncation — Truncate large text with size hints and a --full escape hatch
Pre-computed aggregates — Include aggregated counts and statuses that eliminate round trips
Definitive empty states — Explicit “0 results” rather than ambiguous empty output
Structured errors & exit codes — Idempotent mutations, structured errors, no interactive prompts, fail loud on unknown flags
Ambient context — Install opt-in session integrations first, then offer an on-demand skill
Content first — Running with no arguments shows live data, not help text
Contextual disclosure — Include next-step suggestions after each output
Consistent way to get help — Concise per-subcommand reference when agents need it
Efficiency
1. Token-efficient output
Use TOON (Token-Optimized Object Notation) format instead of JSON or tab-separated tables. TOON omits braces, quotes, and commas, yielding approximately 40% token savings over equivalent JSON while remaining unambiguous to LLMs.

Conventional (JSON)

[{"number":42,"title":"Fix login bug","state":"open",
 "author":"alice","labels":["bug","P1"]},
{"number":43,"title":"Add dark mode","state":"open",
 "author":"bob","labels":["feature"]}]
AXI (TOON)

issues[2]{number,title,state}:
  42,Fix login bug,open
  43,Add dark mode,open
2. Minimal default schemas
Return 3–4 fields per list item by default, not 10+. Agents rarely need all available fields and can request additional ones explicitly via a --fields flag.

3. Content truncation
Truncate large text fields to a configurable limit, appending a size hint such as (truncated, 2847 chars total — use --full to see complete body). This prevents a single verbose response from consuming the agent’s context budget while preserving enough content for most tasks.

Robustness
4. Pre-computed aggregates
Include aggregate or derived fields that eliminate round trips. The most impactful example is totalCount: always report the total number of items, not just the page size. Other examples include computed CI status summaries (e.g., “27 passed, 0 failed, 10 skipped”) inline in PR views.

Conventional: no total count

$ gh label list
bug    Something isn't working    #d73a4a
docs   Improvements or additions  #0075ca
... (30 rows -- default page, no total)
AXI: total count + CI pre-computed

$ gh-axi label list
count: 126
labels[126]{name}:
  bug
  docs
  ...

$ gh-axi pr view 51772
pull_request:
  title: "refactor(plugins): route..."
  state: merged
  checks: "27 passed, 0 failed, 10 skipped"
5. Definitive empty states
When a query returns no results, output an explicit zero-result message rather than empty output. Agents cannot distinguish “no output” from “command failed silently” without this signal.

6. Structured errors & exit codes
Mutations should be idempotent, errors should be structured and written to stdout (not stderr), and commands must never prompt for interactive input. Reserve stdout for structured data and stderr for debug/log output. Use clean exit codes: 0 for success, 1 for errors. Unknown flags must fail loud (exit 2) rather than be silently ignored — the same guarantee a CLI already gives for an unknown command — so an agent that invents a flag learns it did nothing instead of trusting unscoped output.

Discoverability
7. Ambient context
Install into the agent’s session hooks or plugin system from an explicit setup command so that every conversation starts with relevant state already visible — before the agent takes any action. The integration provides a compact, directory-scoped dashboard as initial context. As a secondary recommendation, also ship an installable Agent Skill (generated from the same home-view guidance) so agents that support the skill format can load your guidance on demand, without the per-session cost of a hook.

8. Content first
Running a command with no arguments should display live, actionable data rather than help text. The home view should also include the current executable path, with the home-directory prefix rendered as ~, and a one-sentence description of what the AXI does.

Conventional: no-args shows help

$ gh issue
Work with GitHub issues.

USAGE
  gh issue <command> [flags]

AVAILABLE COMMANDS
  close, create, list, view, ...
AXI: no-args shows live state

$ gh-axi issue
bin: ~/.local/bin/gh-axi
description: Browse and manage GitHub issues for the current repository
count: 14 of 8771 total
issues[14]{number,title,state}:
  51815,"[Bug]: Telegram plugin...",open
  ...
help[2]:
  Run `gh-axi issue view <number>`
  Run `gh-axi issue create --title "..."`
9. Contextual disclosure
Append help[] lines after output, suggesting logical next steps as concrete command templates. Carry forward fixed disambiguating flags, but leave runtime values parameterized as placeholders like <id> instead of guessing them. This eliminates tool-discovery turns and guides agents through multi-step workflows.

10. Consistent way to get help
Each subcommand should offer a concise --help flag as a fallback when contextual hints are insufficient.
