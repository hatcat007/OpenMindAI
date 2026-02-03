# External Integrations

**Analysis Date:** 2026-02-03

## APIs & External Services

**None detected** - This is a fully local, file-based system with no external API calls.

## Data Storage

**Databases:**
- None - Uses local file-based storage

**File Storage:**
- Local filesystem only
  - Memory files: `.mv2` format (Memvid format)
  - Default location: `.claude/mind.mv2` (relative to project directory)
  - Lock files: `.mv2.lock` (for concurrent access protection)
  - Backup files: `.mv2.backup-{timestamp}` (automatic backups on corruption)
  - Storage engine: `@memvid/sdk` (Rust-based, native performance)
  - Implementation: `src/core/mind.ts`

**Caching:**
- None - Direct file access via SDK

## Authentication & Identity

**Auth Provider:**
- None required - Fully local operation

## Monitoring & Observability

**Error Tracking:**
- None - Errors logged to stderr (`console.error`)

**Logs:**
- Debug logging via `console.error` (when `MEMVID_MIND_DEBUG=1`)
  - Implementation: `src/utils/helpers.ts` (`debug()` function)
  - Logs prefixed with `[memvid-mind]`

## CI/CD & Deployment

**Hosting:**
- NPM package registry (for distribution)
- GitHub (source repository: `memvid/claude-brain`)

**CI Pipeline:**
- GitHub Actions
  - Config: `.github/workflows/ci.yml`
  - Tests Node.js versions: 18, 20, 22
  - Steps: Install → Build → Type check → Lint → Test
  - Plugin structure verification job

**Release:**
- GitHub Actions release workflow
  - Config: `.github/workflows/release.yml` (not analyzed in detail)

## Environment Configuration

**Required env vars:**
- `CLAUDE_PLUGIN_ROOT` - Set by Claude Code runtime
  - Used in: `src/hooks/smart-install.ts`, `src/scripts/*.ts`
  - Purpose: Locates plugin installation directory
- `CLAUDE_PROJECT_DIR` - Set by Claude Code runtime (optional, falls back to `process.cwd()`)
  - Used in: `src/core/mind.ts`, `src/hooks/session-start.ts`, `src/scripts/*.ts`
  - Purpose: Determines where to store/read memory files

**Optional env vars:**
- `MEMVID_MIND_DEBUG` - Set to "1" to enable debug logging
  - Used in: `src/utils/helpers.ts`

**Secrets location:**
- No secrets required - fully local operation

## Webhooks & Callbacks

**Incoming:**
- None - No webhook endpoints

**Outgoing:**
- None - No external callbacks

## Plugin Integration

**Claude Code Plugin System:**
- Plugin manifest: `.claude-plugin/plugin.json`
- Hooks configuration: `src/hooks/hooks.json` → `dist/hooks/hooks.json`
- Hook types:
  - `SessionStart` - Runs on session initialization
    - `smart-install.js` - Auto-installs dependencies
    - `session-start.js` - Injects memory context
  - `PostToolUse` - Runs after each tool call
    - `post-tool-use.js` - Records tool usage as observations
  - `Stop` - Runs on session end
    - `stop.js` - Saves session summary
- Hook execution: Node.js scripts via `node` command
- Timeouts: 5-30 seconds depending on hook type

## SDK Integration

**Memvid SDK:**
- Package: `@memvid/sdk` ^2.0.149
- Usage: Dynamic import (allows smart-install to run first)
  - Implementation: `src/core/mind.ts` (`loadSDK()` function)
- Functions used:
  - `create(path, "basic")` - Creates new memory file
  - `use("basic", path)` - Opens existing memory file
  - `memvid.put()` - Stores observations
  - `memvid.find()` - Lexical search
  - `memvid.ask()` - Question answering
  - `memvid.timeline()` - Retrieves chronological entries
  - `memvid.stats()` - Memory statistics
- Storage format: `.mv2` (binary format, Rust-based)
- Search mode: Lexical (`mode: "lex"`)

## File System Integration

**Local File Operations:**
- Memory file creation/reading: Via `@memvid/sdk`
- File locking: `proper-lockfile` library
  - Implementation: `src/utils/memvid-lock.ts`
  - Prevents concurrent access corruption
- Backup management: Automatic backup on corruption detection
  - Implementation: `src/core/mind.ts` (`pruneBackups()` function)
  - Keeps 3 most recent backups
- Directory creation: Automatic via `mkdir` with recursive option

---

*Integration audit: 2026-02-03*
