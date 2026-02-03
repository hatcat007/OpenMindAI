# Architecture

**Analysis Date:** 2026-02-03

## Pattern Overview

**Overall:** Plugin-based hook system with singleton memory engine

**Key Characteristics:**
- Event-driven architecture via Claude Code hooks (SessionStart, PostToolUse, Stop)
- Singleton pattern for Mind instance (shared across hooks)
- Lazy SDK loading to minimize startup overhead
- File-based persistence using `.mv2` format via `@memvid/sdk`
- Lock-based concurrency control for safe multi-process access

## Layers

**Hook Layer:**
- Purpose: Entry points for Claude Code plugin system
- Location: `src/hooks/`
- Contains: Hook scripts that respond to Claude Code events
- Depends on: Core Mind class, utility helpers
- Used by: Claude Code runtime (via hooks.json configuration)
- Key files:
  - `src/hooks/session-start.ts`: Lightweight startup, injects context without loading SDK
  - `src/hooks/post-tool-use.ts`: Captures observations after tool execution
  - `src/hooks/stop.ts`: Generates session summaries and captures file changes
  - `src/hooks/smart-install.ts`: Auto-installs dependencies on first run

**Core Layer:**
- Purpose: Memory persistence engine and main API
- Location: `src/core/mind.ts`
- Contains: `Mind` class with singleton accessor
- Depends on: `@memvid/sdk`, utility modules (lock, helpers)
- Used by: Hooks, scripts, external consumers via `src/index.ts`
- Key abstractions:
  - `Mind.open()`: Factory method for creating/opening memory files
  - `mind.remember()`: Store observations with type classification
  - `mind.search()`: Lexical search over memories
  - `mind.getContext()`: Retrieve recent/relevant memories for session injection
  - `mind.stats()`: Memory statistics

**Utility Layer:**
- Purpose: Shared helpers and cross-cutting concerns
- Location: `src/utils/`
- Contains: Compression, locking, general helpers
- Depends on: Node.js standard library
- Used by: Core, hooks, scripts
- Key modules:
  - `src/utils/compression.ts`: Tool output compression ("Endless Mode")
  - `src/utils/memvid-lock.ts`: File locking for safe concurrent access
  - `src/utils/helpers.ts`: ID generation, token estimation, I/O helpers

**Script Layer:**
- Purpose: CLI-like scripts for querying memory
- Location: `src/scripts/`
- Contains: Standalone scripts for ask, find, stats, timeline
- Depends on: Core Mind, SDK utilities
- Used by: Command system (via `commands/` markdown files)
- Key files:
  - `src/scripts/ask.ts`: Question answering via SDK
  - `src/scripts/find.ts`: Search interface
  - `src/scripts/stats.ts`: Statistics display
  - `src/scripts/timeline.ts`: Chronological memory view
  - `src/scripts/utils.ts`: Shared memory opening logic

**Type Layer:**
- Purpose: TypeScript type definitions
- Location: `src/types.ts`
- Contains: Interfaces for observations, config, hooks, search results
- Depends on: None (pure types)
- Used by: All layers

## Data Flow

**Observation Capture Flow:**

1. Claude Code executes a tool (Read, Edit, Bash, etc.)
2. `PostToolUse` hook receives tool name, input, and response via stdin
3. Hook filters tools (only captures from `OBSERVED_TOOLS` set)
4. Deduplication check (1-minute window) prevents duplicate captures
5. Compression applied if output exceeds threshold (~3000 chars)
6. Observation type classified (`discovery`, `decision`, `problem`, etc.)
7. `mind.remember()` called with observation data
8. Mind acquires file lock, stores via SDK `put()` method
9. Observation stored in `.claude/mind.mv2` file

**Session Start Flow:**

1. Claude Code session begins
2. `SessionStart` hook runs (after `smart-install` if needed)
3. Hook checks for memory file existence (no SDK load)
4. If memory exists, reads file stats and builds context string
5. Context injected into Claude session via `hookSpecificOutput.additionalContext`
6. SDK loaded lazily on first actual memory operation

**Session End Flow:**

1. Claude Code session ends
2. `Stop` hook receives session ID and optional transcript path
3. Hook captures file changes via git diff + find (workaround for Edit hook bug)
4. Retrieves recent observations from current session
5. Generates session summary if >= 3 observations
6. Saves summary via `mind.saveSessionSummary()`

**Memory Retrieval Flow:**

1. `mind.getContext(query?)` called (e.g., at session start)
2. Acquires lock, calls SDK `timeline()` for recent observations
3. If query provided, calls `searchUnlocked()` for relevant memories
4. Builds context within token limits (`maxContextTokens`)
5. Returns `InjectedContext` with recent/relevant observations

## Key Abstractions

**Mind Class:**
- Purpose: Main interface for memory operations
- Examples: `src/core/mind.ts`
- Pattern: Singleton via `getMind()` factory, lazy SDK loading
- Key methods:
  - `open()`: Static factory, handles file creation/corruption recovery
  - `remember()`: Store observation with metadata
  - `search()`: Lexical search with scoring
  - `ask()`: Question answering via SDK
  - `getContext()`: Build session context within token limits
  - `stats()`: Memory statistics

**Observation:**
- Purpose: Represents a captured memory unit
- Examples: Defined in `src/types.ts`
- Pattern: Typed observation with classification (`ObservationType`)
- Fields: id, timestamp, type, summary, content, metadata, tool

**Hook System:**
- Purpose: Event-driven integration with Claude Code
- Examples: `src/hooks/hooks.json` defines hook registration
- Pattern: JSON configuration maps events to command scripts
- Events: SessionStart, PostToolUse, Stop

**Compression:**
- Purpose: Reduce memory footprint ("Endless Mode")
- Examples: `src/utils/compression.ts`
- Pattern: Tool-specific compression strategies
- Targets: ~2000 chars (~500 tokens) from larger outputs
- Strategies: Extract structure (imports, functions, classes) for code; focus on errors/success for bash

## Entry Points

**Plugin Entry:**
- Location: `.claude-plugin/plugin.json`
- Triggers: Claude Code plugin system
- Responsibilities: Plugin metadata, version, author

**Hook Entry Points:**
- Location: `src/hooks/hooks.json`
- Triggers: Claude Code events (SessionStart, PostToolUse, Stop)
- Responsibilities: Register hook scripts, configure timeouts
- Execution: Node.js scripts via `node "${CLAUDE_PLUGIN_ROOT}/dist/hooks/{hook}.js"`

**Library Entry:**
- Location: `src/index.ts`
- Triggers: External imports
- Responsibilities: Export public API (Mind class, types, utilities)

**Script Entry Points:**
- Location: `src/scripts/*.ts`
- Triggers: Command system (via `commands/*.md` files)
- Responsibilities: CLI-like operations (ask, find, stats, timeline)

## Error Handling

**Strategy:** Fail gracefully, never block Claude Code operations

**Patterns:**
- All hooks use try/catch with `writeOutput({ continue: true })` on error
- Memory file corruption handled by backup + recreate in `Mind.open()`
- File locking failures retry with exponential backoff (via `proper-lockfile`)
- SDK loading errors caught, logged, but don't prevent hook continuation
- Large file detection (>100MB) triggers fresh memory creation

**Recovery Mechanisms:**
- Corrupted memory files backed up with timestamp before recreation
- Lock timeouts prevent indefinite blocking (30s stale, 1000 retries)
- Smart install retries with `--force` flag if initial install fails

## Cross-Cutting Concerns

**Logging:** 
- Debug logging via `debug()` helper (enabled via `MEMVID_MIND_DEBUG=1`)
- Logs to stderr to avoid interfering with stdout JSON output
- Used throughout hooks and core for troubleshooting

**Validation:**
- TypeScript strict mode enforces type safety
- Observation types validated via `ObservationType` union
- Config validated via `MindConfig` interface with defaults

**Concurrency:**
- File locking via `proper-lockfile` prevents concurrent writes
- Lock path: `{memoryPath}.lock`
- All memory operations wrapped in `withMemvidLock()`
- Singleton pattern ensures single Mind instance per process

**Performance:**
- Lazy SDK loading (only when needed, not at session start)
- Compression reduces storage footprint by ~20x for large outputs
- Deduplication cache prevents redundant observations (1-minute window)
- Token estimation (~4 chars/token) for context size management

---

*Architecture analysis: 2026-02-03*
