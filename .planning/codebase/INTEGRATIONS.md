# External Integrations

**Analysis Date:** 2026-02-03

## APIs & External Services

**None** - This is a local file-based system with no network dependencies.

## Data Storage

**Databases:**
- None - Uses local file-based storage

**File Storage:**
- Local filesystem only
- Memory files stored as `.mv2` format (via `@memvid/sdk`)
- Default location: `.claude/mind.mv2` in project root
- Configurable via `MindConfig.memoryPath` (see `src/types.ts:64`)

**Caching:**
- In-memory deduplication cache in `src/hooks/post-tool-use.ts:43`
- Prevents duplicate observations within 60-second window
- No persistent cache

## Authentication & Identity

**Auth Provider:**
- None - No authentication required
- All operations are local file system only

## Monitoring & Observability

**Error Tracking:**
- None - No external error tracking service

**Logging:**
- Console-based debug logging (`src/utils/helpers.ts:87`)
- Controlled by `MEMVID_MIND_DEBUG` environment variable
- Debug output goes to `stderr` (see `src/utils/helpers.ts:debug()`)

## CI/CD & Deployment

**Hosting:**
- npm registry - Package published to npmjs.com
- GitHub - Source code and releases hosted on GitHub

**CI Pipeline:**
- GitHub Actions (`.github/workflows/`)
  - `ci.yml` - Continuous integration
    - Tests on Node 18, 20, 22
    - Builds, type checks, lints, tests
  - `release.yml` - Automated releases
    - Triggers on version tags (`v*`)
    - Publishes to npm with provenance
    - Creates GitHub releases

## Environment Configuration

**Required env vars:**
- None required - All environment variables are optional

**Optional env vars:**
- `CLAUDE_PROJECT_DIR` - Override project directory
  - Used in: `src/core/mind.ts:113`, `src/hooks/session-start.ts:24`, `src/scripts/*.ts`
  - Defaults to `process.cwd()`
- `CLAUDE_PLUGIN_ROOT` - Plugin root directory
  - Used in: `src/hooks/smart-install.ts:15`
  - Defaults to parent of `__dirname`
- `MEMVID_MIND_DEBUG` - Enable debug logging
  - Used in: `src/utils/helpers.ts:87`
  - Set to `"1"` to enable

**Secrets location:**
- npm token stored as GitHub secret `NPM_TOKEN` (used in release workflow)
- No secrets required for runtime operation

## Webhooks & Callbacks

**Incoming:**
- None - No webhook endpoints

**Outgoing:**
- None - No external API calls

## External SDKs & Libraries

**@memvid/sdk:**
- Type: Local file-based memory storage SDK
- Version: ^2.0.149
- Purpose: Provides `.mv2` file format for storing observations
- Usage: Dynamically imported in `src/core/mind.ts:70` and all scripts
- Integration points:
  - `src/core/mind.ts` - Core memory operations
  - `src/scripts/ask.ts:38` - Question answering
  - `src/scripts/find.ts:38` - Memory search
  - `src/scripts/stats.ts:38` - Statistics
  - `src/scripts/timeline.ts:38` - Timeline view
- Note: SDK is externalized in build (not bundled) - see `tsup.config.ts:25`

**proper-lockfile:**
- Type: File locking library
- Version: ^4.1.2
- Purpose: Prevents concurrent write corruption
- Usage: `src/utils/memvid-lock.ts`
- Integration: Wraps all memory file operations with file locks

## Claude Code Plugin Integration

**Plugin System:**
- Integrates with Claude Code via hook system
- Plugin manifest: `.claude-plugin/plugin.json`
- Hooks:
  - `session-start` (`src/hooks/session-start.ts`) - Injects context at session start
  - `post-tool-use` (`src/hooks/post-tool-use.ts`) - Captures observations after tool use
  - `smart-install` (`src/hooks/smart-install.ts`) - Handles SDK installation
  - `stop` (`src/hooks/stop.ts`) - Session cleanup
- Hook configuration: `src/hooks/hooks.json` and `hooks/hooks.json`

**Commands:**
- Command definitions in `commands/` directory:
  - `ask.md` - Ask memory questions
  - `recent.md` - View recent timeline
  - `search.md` - Search memories
  - `stats.md` - View statistics

## Internal Boundaries

**No External Network Calls:**
- All operations are local file system only
- No HTTP/HTTPS requests
- No database connections
- No cloud services

**File System Operations:**
- Reads/writes `.mv2` memory files
- Creates lock files (`.lock` extension)
- Creates backup files (`.backup-{timestamp}`)
- Reads project directory structure

## Planned or Partial Integrations

**None detected** - All integrations are fully implemented.

---

*Integration audit: 2026-02-03*
