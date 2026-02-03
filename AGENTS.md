# AGENTS.md - Agentic Coding Guide for claude-brain

## Build Commands

```bash
# Build the project (creates dist/, copies hooks.json)
npm run build

# Watch mode for development
npm run dev

# Pre-publish build
npm run prepublishOnly
```

## Test Commands

```bash
# Run all tests
npm test

# Run single test file
npx vitest run src/__tests__/mind-lock.test.ts

# Run tests in watch mode
npx vitest

# Run tests with coverage
npx vitest run --coverage
```

## Lint & Type Commands

```bash
# Lint source files
npm run lint

# Type check without emitting
npm run typecheck
```

## Code Style Guidelines

### Imports
- Use ESM module syntax (`"type": "module"` in package.json)
- Prefer `node:` prefix for built-in modules: `import { readFile } from "node:fs"`
- Use `.js` extensions for local imports (TypeScript handles resolution)
- Order: node built-ins first, then external packages, then local imports
- Use `type` imports for type-only imports: `import type { Observation } from "./types.js"`

### Formatting
- No explicit formatter configured; follow existing patterns
- Use 2-space indentation
- Max line length: approximately 100-120 characters
- Use semicolons
- Use double quotes for strings

### Types & Naming
- Strict TypeScript enabled (`strict: true`)
- Use explicit return types on exported functions
- Interface names: PascalCase (e.g., `Observation`, `MindConfig`)
- Type names: PascalCase with `Type` suffix for unions (e.g., `ObservationType`)
- Function names: camelCase, descriptive and verb-based
- Constants: UPPER_SNAKE_CASE for true constants, camelCase otherwise
- Private class methods/properties: prefix with `_` or use `#` for true private

### Error Handling
- Always handle errors with try/catch
- Use type guards for error messages: `error instanceof Error ? error.message : String(error)`
- In hooks, never block on errors - always `writeOutput({ continue: true })`
- For SDK errors, check specific error message patterns for corruption detection
- Silent fail for non-critical operations (backup pruning, cleanup)

### Conventions
- JSDoc comments for all exported functions and classes
- File header comments describing the module purpose
- Use `async/await` over raw promises
- Prefer `const` over `let`; never use `var`
- Unused parameters: prefix with `_` to satisfy ESLint
- Allow `any` type only with ESLint disable comment for SDK dynamic imports

### Project Structure
```
src/
  core/          # Core engine (mind.ts)
  hooks/         # Claude Code hooks (post-tool-use.ts, session-start.ts, stop.ts, smart-install.ts)
  utils/         # Helpers (helpers.ts, compression.ts, memvid-lock.ts)
  types.ts       # Type definitions
  __tests__/     # Vitest test files (*.test.ts)
  scripts/       # SDK-based CLI scripts (find.ts, ask.ts, stats.ts, timeline.ts)
```

### Testing Patterns
- Use vitest with `describe` and `it`
- Import test utilities: `import { describe, it, expect } from "vitest"`
- Use temp directories in tests: `mkdtempSync(join(tmpdir(), "prefix-"))`
- Clean up temp files in `finally` blocks
- Set timeout for slow tests: `}, 15000)` for async operations

### Hook Development
- All hooks must read from stdin and write JSON to stdout
- Use `writeOutput()` to ensure immediate process exit
- Always return `{ continue: true }` unless explicitly blocking
- Use `debug()` for logging to stderr (controlled by MEMVID_MIND_DEBUG env var)

### Environment
- Node.js >= 18 required
- Uses @memvid/sdk for memory operations
- Project directory determined by `CLAUDE_PROJECT_DIR` or `process.cwd()`
- Memory file path: `.claude/mind.mv2` by default

### Build Output
- tsup builds to `dist/` directory
- Outputs: index.js + types, hook scripts, utility scripts
- ESM format only
- Source maps and declarations generated
