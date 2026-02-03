# Architecture

**Analysis Date:** 2026-02-03

## Pattern Overview

**Overall:** Plugin-based event-driven architecture with singleton memory management

**Key Characteristics:**
- Hook-based integration with Claude Code lifecycle events
- Singleton pattern for Mind instance management
- File-based persistent storage using @memvid/sdk
- Event-driven observation capture from tool executions
- Lazy SDK loading for fast startup
- File locking for concurrent access safety

## Layers

**Hook Layer:**
- Purpose: Intercept Claude Code events and capture observations
- Location: `src/hooks/`
- Contains: SessionStart, PostToolUse, Stop hooks
- Depends on: Core Mind class, utility helpers
- Used by: Claude Code runtime (via hooks.json configuration)

**Core Layer:**
- Purpose: Memory management and persistence abstraction
- Location: `src/core/mind.ts`
- Contains: Mind class, getMind singleton factory
- Depends on: @memvid/sdk, file locking utilities, type definitions
- Used by: Hooks, scripts

**Script Layer:**
- Purpose: CLI-like commands for memory interaction
- Location: `src/scripts/`
- Contains: ask.ts, find.ts, stats.ts, timeline.ts
- Depends on: Core Mind, SDK utilities
- Used by: Users via command execution

**Utility Layer:**
- Purpose: Shared helpers for compression, locking, and data processing
- Location: `src/utils/`
- Contains: compression.ts, memvid-lock.ts, helpers.ts
- Depends on: Node.js standard library
- Used by: All layers

**Type Layer:**
- Purpose: TypeScript type definitions and configuration
- Location: `src/types.ts`
- Contains: Observation, MindConfig, HookInput/Output interfaces
- Depends on: None
- Used by: All layers

## Data Flow

**Observation Capture Flow:**

1. Claude Code executes a tool (Read, Edit, Bash, etc.)
2. PostToolUse hook (`src/hooks/post-tool-use.ts`) receives tool output
3. Hook filters and deduplicates observations
4. Large outputs compressed via `src/utils/compression.ts` (Endless Mode)
5. Observation classified by type (discovery, decision, problem, etc.)
6. Mind.remember() stores observation in `.claude/mind.mv2` file
7. Storage wrapped in file lock (`src/utils/memvid-lock.ts`) for safety

**Session Start Flow:**

1. SessionStart hook (`src/hooks/session-start.ts`) runs on Claude startup
2. Smart-install hook (`src/hooks/smart-install.ts`) ensures dependencies installed
3. Hook checks if memory file exists (without loading SDK for speed)
4. Provides context banner to Claude with memory status
5. SDK loaded lazily on first actual memory access

**Session End Flow:**

1. Stop hook (`src/hooks/stop.ts`) runs when session ends
2. Captures file changes via git diff (workaround for Edit tool hook bug)
3. Generates session summary from observations
4. Stores summary as memory for future reference

**Memory Query Flow:**

1. User invokes script (ask.ts, find.ts, stats.ts, timeline.ts)
2. Script ensures dependencies installed
3. Opens memory file safely (handles corruption)
4. Executes query via SDK (lexical search mode)
5. Returns formatted results

**State Management:**
- Memory state stored in single `.claude/mind.mv2` file per project
- Mind instance managed as singleton via `getMind()` function
- File locking prevents concurrent write corruption
- In-memory deduplication cache prevents duplicate observations within 1-minute window

## Key Abstractions

**Mind Class:**
- Purpose: Primary interface for memory operations
- Examples: `src/core/mind.ts`
- Pattern: Factory method (`Mind.open()`) with singleton accessor (`getMind()`)
- Responsibilities: Open/create memory file, store observations, search memories, get context, generate stats

**Observation:**
- Purpose: Represents a captured memory unit
- Examples: Defined in `src/types.ts`
- Pattern: Structured data with type, summary, content, metadata
- Types: discovery, decision, problem, solution, pattern, warning, success, refactor, bugfix, feature

**Hook System:**
- Purpose: Integrate with Claude Code lifecycle
- Examples: `src/hooks/session-start.ts`, `src/hooks/post-tool-use.ts`, `src/hooks/stop.ts`
- Pattern: Command-based hooks registered in `src/hooks/hooks.json`
- Communication: JSON stdin/stdout protocol

**Compression System:**
- Purpose: Reduce large tool outputs while preserving key information
- Examples: `src/utils/compression.ts`
- Pattern: Tool-specific compression strategies (Read, Bash, Grep, etc.)
- Target: ~500 tokens (~2000 chars) per observation

## Entry Points

**Plugin Entry:**
- Location: `.claude-plugin/plugin.json`
- Triggers: Claude Code plugin system
- Responsibilities: Register hooks, define plugin metadata

**Hook Entry Points:**
- Location: `src/hooks/hooks.json`
- Triggers: Claude Code lifecycle events
- Responsibilities: Route events to appropriate handlers

**Script Entry Points:**
- Location: `src/scripts/*.ts` (compiled to `dist/scripts/*.js`)
- Triggers: Direct execution via node
- Responsibilities: Provide CLI-like memory interaction

**Library Entry:**
- Location: `src/index.ts`
- Triggers: Import by other packages
- Responsibilities: Export public API (Mind class, types, utilities)

## Error Handling

**Strategy:** Fail gracefully, don't block Claude Code

**Patterns:**
- Hooks always return `{ continue: true }` even on errors
- Errors logged to stderr via debug() function
- Corrupted memory files automatically backed up and recreated
- File operations wrapped in try-catch with fallbacks
- SDK loading errors handled with user-friendly messages

**Corruption Handling:**
- Detects corrupted files via error message patterns (`src/scripts/utils.ts`)
- Creates backup before recreating fresh memory
- Prunes old backups (keeps only 3 most recent)
- Validates file size (rejects files >100MB as likely corrupted)

## Cross-Cutting Concerns

**Logging:** Debug messages via `debug()` helper, only when `MEMVID_MIND_DEBUG=1` env var set

**Validation:** TypeScript strict mode, runtime validation for corrupted files

**Authentication:** None required - file-based storage

**Concurrency:** File locking via `proper-lockfile` package, prevents concurrent write corruption

**Performance:**
- Lazy SDK loading (only when needed)
- Lightweight session-start hook (no SDK load)
- Compression reduces storage size by ~20x
- Deduplication prevents redundant observations
- Lexical-only search mode for fast queries

---

*Architecture analysis: 2026-02-03*
