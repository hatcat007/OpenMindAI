# Technology Stack

**Analysis Date:** 2026-02-03

## Languages

**Primary:**
- TypeScript 5.7.0 - Entire codebase (`src/`)

**Secondary:**
- JavaScript (ES2022) - Generated output (`dist/`)

## Runtime

**Environment:**
- Node.js >=18.0.0 (required by `package.json` engines)
- Target: Node 18+ (configured in `tsup.config.ts`)

**Package Manager:**
- npm (primary, `package-lock.json` present)
- Also supports: bun (`bun.lock` present), pnpm (`pnpm-lock.yaml` present)
- Lockfile: `package-lock.json` committed

## Frameworks

**Core:**
- None - Pure TypeScript library

**Testing:**
- Vitest 3.0.0 - Test runner and framework (`src/__tests__/`)
- Config: No explicit config file, uses defaults

**Build/Dev:**
- tsup 8.0.0 - TypeScript bundler (`tsup.config.ts`)
  - Builds ESM output to `dist/`
  - Generates source maps and type declarations
  - Multiple entry points for hooks and scripts
- TypeScript 5.7.0 - Compiler (`tsconfig.json`)
  - Target: ES2022
  - Module: ESNext
  - Strict mode enabled
  - Module resolution: bundler

## Key Dependencies

**Critical:**
- `@memvid/sdk` ^2.0.149 - Core memory storage SDK
  - Used in `src/core/mind.ts` and all scripts
  - Dynamically imported to allow lazy loading
  - Provides file-based memory storage (.mv2 format)
- `proper-lockfile` ^4.1.2 - File locking for concurrent access
  - Used in `src/utils/memvid-lock.ts`
  - Prevents corruption during concurrent writes

**Infrastructure:**
- Node.js built-in modules (`node:fs`, `node:path`, `node:fs/promises`) - File system operations

## Configuration

**Environment:**
- Optional env vars:
  - `CLAUDE_PROJECT_DIR` - Project directory override (defaults to `process.cwd()`)
  - `CLAUDE_PLUGIN_ROOT` - Plugin root directory (for smart-install hook)
  - `MEMVID_MIND_DEBUG` - Enable debug logging (set to "1")
- No `.env` file required - all config is optional

**Build:**
- `tsup.config.ts` - Build configuration
  - Entry points: `src/index.ts` + 4 hooks + 4 scripts
  - Format: ESM only
  - External: `@memvid/sdk` (not bundled)
  - Target: node18
  - Source maps enabled
- `tsconfig.json` - TypeScript configuration
  - Strict mode with comprehensive checks
  - Declaration files generated
  - JSON module resolution enabled

## Platform Requirements

**Development:**
- Node.js >=18.0.0
- npm (or bun/pnpm)
- TypeScript 5.7.0+

**Production:**
- Node.js >=18.0.0
- Deployed as npm package
- Consumed by Claude Code plugin system

## Tooling

**Linting:**
- ESLint 9.0.0 (`eslint.config.js`)
- typescript-eslint 8.50.0
- @eslint/js 9.39.2
- Config: Flat config format

**Type Checking:**
- TypeScript compiler (`npm run typecheck`)
- Strict mode enabled

**CI/CD:**
- GitHub Actions (`.github/workflows/`)
  - `ci.yml` - Tests on Node 18, 20, 22
  - `release.yml` - Publishes to npm on version tags
- Build verification included in CI

## Module System

**Format:**
- ESM (ES Modules) - `"type": "module"` in `package.json`
- All imports use `.js` extensions (TypeScript requirement for ESM)
- Dynamic imports used for lazy SDK loading

## Non-Standard Notes

- **Dynamic SDK Import**: `@memvid/sdk` is dynamically imported to allow hooks to run before SDK installation (see `src/core/mind.ts:68-74`)
- **Multiple Lockfiles**: Project includes `package-lock.json`, `bun.lock`, and `pnpm-lock.yaml` - supports multiple package managers
- **Plugin Architecture**: Built as Claude Code plugin with hooks system (see `.claude-plugin/plugin.json`)
- **File-Based Storage**: No database - uses local `.mv2` files via SDK
- **No Network Dependencies**: All operations are local file system only

---

*Stack analysis: 2026-02-03*
