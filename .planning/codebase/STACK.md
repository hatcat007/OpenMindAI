# Technology Stack

**Analysis Date:** 2026-02-03

## Languages

**Primary:**
- TypeScript 5.7.0 - Entire codebase (`src/**/*.ts`)

**Secondary:**
- JavaScript (ESM) - Build output (`dist/**/*.js`)

## Runtime

**Environment:**
- Node.js >=18.0.0
- Target: ES2022
- Module: ESNext (ES Modules)

**Package Manager:**
- npm (with `package-lock.json` present)
- Lockfile: Present (`package-lock.json`)

## Frameworks

**Core:**
- None (vanilla TypeScript/Node.js)

**Testing:**
- Vitest 3.0.0 - Test runner and assertion library
  - Config: Default (no explicit config file detected)
  - Test files: `src/__tests__/**/*.test.ts`

**Build/Dev:**
- tsup 8.0.0 - TypeScript bundler
  - Config: `tsup.config.ts`
  - Output: ESM format, Node.js 18+ target
  - Source maps: Enabled
  - Type declarations: Generated for main entry point
- TypeScript 5.7.0 - Compiler
  - Config: `tsconfig.json`
  - Strict mode: Enabled
  - Target: ES2022
  - Module resolution: bundler

## Key Dependencies

**Critical:**
- `@memvid/sdk` ^2.0.149 - Core memory storage SDK
  - Used in: `src/core/mind.ts`, `src/scripts/*.ts`
  - Purpose: Provides file-based memory storage engine (.mv2 files)
  - External dependency (not bundled)
- `proper-lockfile` ^4.1.2 - File locking library
  - Used in: `src/utils/memvid-lock.ts`
  - Purpose: Prevents concurrent access to memory files

**Infrastructure:**
- `@types/node` ^22.0.0 - Node.js type definitions
- `@types/proper-lockfile` ^4.1.4 - Type definitions for lockfile library

## Configuration

**Environment:**
- No `.env` files detected
- Environment variables used:
  - `CLAUDE_PLUGIN_ROOT` - Plugin installation directory (set by Claude Code)
  - `CLAUDE_PROJECT_DIR` - Project directory for memory file location (set by Claude Code)
  - `MEMVID_MIND_DEBUG` - Debug flag (optional, set to "1" to enable)

**Build:**
- `tsup.config.ts` - Build configuration
  - Multiple entry points: `index`, `hooks/*`, `scripts/*`
  - ESM output format
  - Externalizes `@memvid/sdk` (not bundled)
- `tsconfig.json` - TypeScript compiler configuration
  - Strict mode enabled
  - Source maps and declaration maps enabled

## Platform Requirements

**Development:**
- Node.js >=18.0.0
- npm (for dependency management)
- TypeScript 5.7.0+ (dev dependency)

**Production:**
- Node.js >=18.0.0
- No external services required (fully local)
- File system access for `.mv2` memory files

---

*Stack analysis: 2026-02-03*
