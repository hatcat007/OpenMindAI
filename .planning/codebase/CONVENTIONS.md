# Coding Conventions

**Analysis Date:** 2026-02-03

## Naming Patterns

**Files:**
- Source files: `camelCase.ts` (e.g., `mind.ts`, `helpers.ts`)
- Script files: `kebab-case.ts` (e.g., `session-start.ts`, `post-tool-use.ts`)
- Test files: `*.test.ts` in `src/__tests__/` directory
- Type definition files: `types.ts`

**Functions:**
- Use `camelCase` for function names
- Examples: `generateId()`, `estimateTokens()`, `openMemorySafely()`
- See: `src/utils/helpers.ts`, `src/core/mind.ts`

**Variables:**
- Use `camelCase` for variables
- Examples: `memoryPath`, `sessionId`, `configOverrides`
- Private class properties: `private memvid: Memvid`, `private config: MindConfig`

**Types:**
- Interfaces: `PascalCase` (e.g., `Observation`, `MindConfig`, `HookInput`)
- Type aliases: `PascalCase` (e.g., `ObservationType`, `MemorySearchResult`)
- Classes: `PascalCase` (e.g., `Mind`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_CONFIG`)

## Code Style

**Formatting:**
- No explicit Prettier config detected
- Code appears consistently formatted
- 2-space indentation observed

**Linting:**
- Tool: ESLint 9.x with flat config (`eslint.config.js`)
- Config: `@eslint/js` recommended + `typescript-eslint` recommended
- Key rules:
  - `@typescript-eslint/no-unused-vars`: error (args with `^_` prefix ignored)
  - `@typescript-eslint/no-explicit-any`: warn
- Config file: `eslint.config.js`

**TypeScript:**
- Strict mode enabled (`tsconfig.json`)
- Key compiler options:
  - `noUnusedLocals: true`
  - `noUnusedParameters: true`
  - `noImplicitReturns: true`
  - `noFallthroughCasesInSwitch: true`
  - `forceConsistentCasingInFileNames: true`
- Target: ES2022
- Module: ESNext with bundler resolution

## Import Organization

**Order:**
1. Node.js built-ins (with `node:` prefix)
2. External dependencies
3. Internal modules (relative imports)

**Path Aliases:**
- No path aliases configured
- Use relative imports: `../utils/helpers.js`, `./types.js`

**Import Style:**
- Always use `.js` extension in imports (ESM requirement)
- Examples:
  - `import { resolve, dirname } from "node:path"`
  - `import { Mind } from "../core/mind.js"`
  - `import type { Observation } from "./types.js"`
- Dynamic imports: `await import("@memvid/sdk")`
- See: `src/core/mind.ts`, `src/index.ts`

**Type-only Imports:**
- Use `import type` for type-only imports
- Example: `import type { HookInput } from "../types.js"`

## Error Handling

**Patterns:**
- Use try/catch blocks for async operations
- Silent error handling in cleanup code (backup deletion, pruning)
- Error messages logged to `console.error` with `[memvid-mind]` prefix
- Functions return `null` or throw errors (no Result types)
- Example pattern:
```typescript
try {
  // operation
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  // handle error
}
```
- See: `src/core/mind.ts` (lines 144-167), `src/utils/helpers.ts` (lines 53-59)

**Error Classification:**
- Custom error checking functions: `isCorruptedMemoryError()`
- See: `src/scripts/utils.ts` (lines 28-41)

## Logging

**Framework:** `console.error` for debug/logging

**Patterns:**
- Debug logging via `debug()` helper function
- Debug messages prefixed with `[memvid-mind]`
- Controlled by `MEMVID_MIND_DEBUG` environment variable
- Error messages use `console.error` directly
- Example:
```typescript
debug(`Session starting: ${hookInput.session_id}`);
console.error(`[memvid-mind] Opened: ${memoryPath}`);
```
- See: `src/utils/helpers.ts` (lines 86-90), `src/hooks/session-start.ts`

## Comments

**When to Comment:**
- File-level JSDoc comments for modules
- Class-level JSDoc with `@example` for public APIs
- Function-level JSDoc for exported functions
- Inline comments for complex logic or workarounds

**JSDoc/TSDoc:**
- Use JSDoc-style comments for public APIs
- Include `@example` blocks for complex functions
- Package-level documentation: `@packageDocumentation`
- Example:
```typescript
/**
 * Mind - Claude's portable memory engine
 *
 * @example
 * ```typescript
 * const mind = await Mind.open();
 * await mind.remember({...});
 * ```
 */
```
- See: `src/core/mind.ts` (lines 76-90), `src/index.ts`

**ESLint Disable Comments:**
- Use `eslint-disable-next-line` for intentional violations
- Common: `@typescript-eslint/no-explicit-any` for SDK types
- See: `src/core/mind.ts` (lines 9-10, 63-66)

## Function Design

**Size:** Functions are generally focused and single-purpose

**Parameters:**
- Use object parameters for functions with 3+ arguments
- Example: `Mind.open(configOverrides: Partial<MindConfig> = {})`
- Optional parameters use default values or `Partial<>` types

**Return Values:**
- Explicit return types preferred
- Async functions return `Promise<T>`
- Functions that exit process: return type `never`
- Example: `writeOutput(output: unknown): never`
- See: `src/utils/helpers.ts` (line 78)

## Module Design

**Exports:**
- Barrel file pattern: `src/index.ts` re-exports from other modules
- Named exports preferred over default exports
- Type exports: `export type { ... }`
- Value exports: `export { ... }`
- See: `src/index.ts`

**Barrel Files:**
- `src/index.ts` serves as main entry point
- Re-exports types, classes, functions, and constants
- See: `src/index.ts`

**File Structure:**
- One main export per file (class or set of related functions)
- Types centralized in `src/types.ts`
- Utilities grouped by purpose: `src/utils/helpers.ts`, `src/utils/compression.ts`

## Special Patterns

**Shebang:**
- Script files use `#!/usr/bin/env node`
- Applied to hook files and CLI scripts
- See: `src/hooks/session-start.ts` (line 1), `src/scripts/ask.ts` (line 1)

**Dynamic Imports:**
- SDK loaded lazily to allow smart-install hook to run first
- Pattern: `await import("@memvid/sdk")`
- See: `src/core/mind.ts` (lines 68-74)

**Locking:**
- File locking via `proper-lockfile` package
- Wrapper function: `withMemvidLock()`
- See: `src/utils/memvid-lock.ts`

**Singleton Pattern:**
- `getMind()` function provides singleton instance
- `resetMind()` for testing
- See: `src/core/mind.ts` (lines 411-428)

---

*Convention analysis: 2026-02-03*
