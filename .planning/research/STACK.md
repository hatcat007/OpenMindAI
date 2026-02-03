# Stack Research: Opencode Brain

## Current Stack (Claude-Brain)

```
Runtime: Node.js 18+
Language: TypeScript 5.7+
Build: tsup (bundles to dist/)
Dependencies:
  - @memvid/sdk ^2.0.149    # Memory storage engine
  - proper-lockfile ^4.1.2  # File locking
Dev:
  - TypeScript, ESLint, Vitest
  - tsup for bundling
```

## Target Stack (Opencode-Brain)

### Runtime Environment

**Opencode uses Bun, not Node.js**

| Component | Claude-Brain | Opencode-Brain |
|-----------|--------------|----------------|
| Runtime | Node.js 18+ | Bun (Opencode's runtime) |
| Package Manager | npm | Bun (built-in) |
| Module System | ESM | ESM |
| TypeScript | Compile then run | Native support |

### Plugin Dependencies

**Required for Opencode plugin:**

```json
{
  "dependencies": {
    "@opencode-ai/plugin": "latest",     # Plugin SDK
    "@memvid/sdk": "^2.0.149",           # Keep existing memory engine
    "proper-lockfile": "^4.1.2"          # Keep file locking
  },
  "devDependencies": {
    "@types/node": "^22.0.0",            # Node types (for compatibility)
    "@types/bun": "latest",              # Bun types
    "typescript": "^5.7.0"
  }
}
```

### Key Technical Decisions

#### 1. Memory Engine Compatibility

**Status:** ✅ Compatible

The `@memvid/sdk` is a separate package that should work in Bun. It uses:
- Native Rust core via Node-API (should work with Bun)
- Standard file system operations

**Risk Level:** LOW
- Bun has good Node.js compatibility
- File operations are standard
- Native modules may need testing

#### 2. File Locking

**Current:** `proper-lockfile` (Node.js specific)

**Options:**
- Keep using `proper-lockfile` (Bun supports most Node APIs)
- Switch to `async-lock` or native Bun file locking
- Implement simple locking with `Bun.write()` + `Bun.file()`

**Recommendation:** Start with `proper-lockfile`, test in Bun

#### 3. Storage Location

**Claude-Brain:** `.claude/mind.mv2`

**Opencode-Brain:** `.opencode/mind.mv2`

**Rationale:** Follow Opencode conventions for discoverability

#### 4. Plugin Distribution

**Option A: NPM Package (Recommended)**

```bash
npm install opencode-brain
```

Then add to `opencode.json`:
```json
{
  "plugin": ["opencode-brain"]
}
```

**Option B: Local Plugin Files**

```bash
.opencode/plugins/opencode-brain.ts
```

**Option C: GitHub Installation**

Install from repo directly.

**Recommendation:** 
- Publish as `opencode-brain` on npm
- Also support local installation for development
- Provide CLI installer script

### Plugin Architecture

```typescript
// .opencode/plugins/opencode-brain.ts
import type { Plugin } from "@opencode-ai/plugin"
import { MemoryManager } from "./memory"

export const OpencodeBrain: Plugin = async (ctx) => {
  const memory = new MemoryManager(ctx.worktree)
  
  return {
    // Session start - inject memory
    "session.created": async () => {
      const context = await memory.load()
      // Inject into session
    },
    
    // Tool use - capture actions
    "tool.execute.after": async (input, output) => {
      await memory.recordToolUse(input, output)
    },
    
    // Session end - save memory
    "session.idle": async () => {
      await memory.save()
    },
    
    // Add custom tool
    tool: {
      mind: {
        description: "Search and query memory",
        args: { /* ... */ },
        execute: async (args, context) => {
          return await memory.query(args.query)
        }
      }
    }
  }
}
```

### Core Components to Port

From `claude-brain/src/`:

| File | Port Status | Notes |
|------|-------------|-------|
| `core/mind.ts` | ✅ Port | Core memory management logic |
| `utils/helpers.ts` | ✅ Port | Utility functions |
| `utils/compression.ts` | ✅ Port | Context compression |
| `utils/memvid-lock.ts` | ⚠️ Review | File locking - test in Bun |
| `types.ts` | ✅ Port | Type definitions |
| `hooks/*.ts` | ❌ Replace | Convert to event handlers |
| `scripts/*.ts` | ⚠️ Adapt | Convert to commands/tools |

### Build Configuration

**tsup.config.ts:**
```typescript
import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node18",  // Bun compatible
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    "@opencode-ai/plugin",  // Provided by host
    "@memvid/sdk"         # External dependency
  ]
})
```

### Testing Strategy

**Current:** Vitest with Node.js

**For Opencode:**
- Keep Vitest for unit tests (works with Bun)
- Add integration tests with Opencode runtime
- Test plugin loading and event handling

```bash
# Test with Bun
bun test

# Test with Node (for compatibility)
npm test
```

### Confidence Assessment

| Component | Confidence | Risk |
|-----------|------------|------|
| TypeScript compilation | HIGH | Bun has native TS support |
| @memvid/sdk | MEDIUM-HIGH | Needs testing with Bun |
| File operations | HIGH | Standard APIs |
| proper-lockfile | MEDIUM | May need alternative |
| Plugin SDK | HIGH | Official Opencode API |
| Event system | HIGH | Well documented |

### Recommended Versions

```json
{
  "opencode": ">=1.0.0",
  "@opencode-ai/plugin": "latest",
  "@memvid/sdk": "^2.0.149",
  "bun": ">=1.0.0"
}
```

### Next Steps

1. **Test @memvid/sdk with Bun** - Verify compatibility
2. **Set up Bun development environment** 
3. **Create plugin prototype** - Test event hooks
4. **Port core logic** - mind.ts, helpers.ts
5. **Add custom commands** - /mind stats, /mind search
6. **Test end-to-end** - Full session flow
7. **Package for npm** - Publish opencode-brain
