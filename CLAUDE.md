# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**opencode-brain** is an Opencode plugin that provides persistent memory across sessions using SQLite. The plugin automatically captures tool executions, file edits, and errors, storing them in a local `.opencode/mind.mv2` database file.

## Development Commands

```bash
# Install dependencies
bun install

# Build the plugin
bun run build

# Watch mode for development
bun run dev

# Run tests
bun test

# Run specific test file
bun test src/storage/sqlite-storage.test.ts

# Test storage functionality
bun run test:storage

# Lint code
bun run lint

# Type check
bun run typecheck
```

## Architecture

### Core Components

1. **Plugin Entry Point** (`src/plugin.ts`)
   - Implements `@opencode-ai/plugin` SDK hooks
   - Manages session lifecycle (session.created, session.deleted)
   - Registers event handlers for tool.execute.after, file.edited, session.error
   - Uses event buffer for batched writes to reduce I/O overhead

2. **Storage Layer** (`src/storage/sqlite-storage.ts`)
   - Bun-native SQLite using `bun:sqlite` (synchronous API)
   - WAL mode enabled for concurrent access
   - FTS5 full-text search with macOS LIKE fallback
   - Automatic cleanup of stale lock files (-wal, -shm) to prevent hangs
   - Schema: `memories` table with id, sessionId, timestamp, type, content, metadata

3. **Event Buffer** (`src/events/buffer.ts`)
   - In-memory buffering for batched writes (default: 50 entries or 5s interval)
   - Prevents concurrent flushes with isFlushing flag
   - Reduces I/O overhead by 10-100x vs per-event writes

4. **Event Capture Modules** (`src/events/`)
   - `tool-capture.ts` - Captures tool executions (Bash, Read, Write, etc.)
   - `file-capture.ts` - Captures file edits with path tracking
   - `error-capture.ts` - Captures session errors with stack traces

5. **Privacy Layer** (`src/privacy/filter.ts`)
   - Filters sensitive content before storage (passwords, API keys, .env files)
   - Sanitizes bash commands and file paths
   - Excludes binary files, large files, and sensitive directories

6. **Configuration** (`src/config.ts`)
   - Loads from `opencode.json` under `"opencode-brain"` key
   - Environment variable overrides (OPENCODE_BRAIN_STORAGE_PATH, OPENCODE_BRAIN_DEBUG)
   - Pre-flight validation of storage path before database creation

### Data Flow

```
Opencode Event → Event Capture Module → Privacy Filter → Event Buffer → SQLite Storage
                                                              ↓
                                                         (batched flush every 5s or 50 entries)
```

### Build System

- **tsup** with dual output configuration:
  - Main plugin: `src/index.ts` → `dist/index.js` (ESM, with types)
  - CLI scripts: `src/scripts/*.ts` → `dist/scripts/*.js` (ESM, no types)
- External dependencies: `@opencode-ai/plugin`, `bun:sqlite`, `node:*`
- Source maps enabled for debugging

## Key Design Decisions

### Bun-Specific Synchronous API
All storage operations use synchronous methods because `bun:sqlite` returns values directly (not Promises). This differs from Node.js async patterns.

### WAL Mode + Lock File Cleanup
The plugin uses WAL (Write-Ahead Logging) mode for concurrent access but cleans up stale lock files (`-wal`, `-shm`) on startup. This prevents indefinite hangs when Opencode crashes or is killed abruptly.

### Graceful Degradation
If storage initialization fails, the plugin returns minimal no-op hooks rather than crashing Opencode. This ensures the editor remains functional even if the plugin fails.

### Event Buffering
Instead of writing each event immediately, the buffer accumulates events and flushes in batches. This is critical for performance when processing rapid tool executions.

## Testing

Tests use Bun's built-in test runner (`bun:test`):

```typescript
import { describe, test, expect } from "bun:test";
```

Key test files:
- `src/storage/sqlite-storage.test.ts` - Storage layer tests
- `src/events/buffer.test.ts` - Event buffer tests
- `src/events/tool-capture.test.ts` - Tool capture tests
- `src/events/file-capture.test.ts` - File capture tests
- `src/privacy/filter.test.ts` - Privacy filter tests

## Common Gotchas

1. **Lock file hangs**: If the database hangs on open, stale `-wal` or `-shm` files may exist. The plugin cleans these automatically, but manual deletion may be needed for recovery.

2. **FTS5 availability**: FTS5 is not available on macOS by default. The plugin falls back to LIKE queries when FTS5 is unavailable.

3. **Path resolution**: Storage path is resolved relative to `worktree` (project root), not `directory` (plugin location). Absolute paths are used as-is.

4. **Peer dependencies**: `@opencode-ai/plugin` must be installed in the parent project. The plugin cannot bundle this dependency.

5. **Node.js built-ins**: All Node.js imports use `node:` prefix (e.g., `node:fs`, `node:path`) to prevent bundling issues with tsup.
