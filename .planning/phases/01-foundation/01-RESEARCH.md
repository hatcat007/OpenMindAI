# Phase 1: Foundation - Research

**Researched:** 2025-02-03
**Domain:** Bun + SQLite storage layer + @opencode-ai/plugin SDK
**Confidence:** HIGH

## Summary

This research covers implementing a Bun-compatible SQLite-based storage layer for the `opencode-brain` plugin. Since @memvid/sdk is confirmed NOT compatible with Bun, we must implement a custom storage layer using Bun's native `bun:sqlite` module.

**Key Findings:**
1. Bun:sqlite is a high-performance, synchronous SQLite3 driver built into Bun (3-6x faster than better-sqlite3)
2. SQLite's built-in locking mechanisms + WAL mode provide sufficient concurrency protection
3. FTS5 full-text search is available but requires consideration for cross-platform compatibility
4. @opencode-ai/plugin SDK uses a simple pattern: export async function receiving context, returning hooks object
5. Bun has excellent TypeScript support with zero configuration needed
6. `bun:test` provides Jest-compatible testing out of the box

**Primary Recommendation:** Use `bun:sqlite` Database class with WAL mode enabled, implement simple file-based locking only if needed for cross-process coordination, use Bun's native TypeScript support with tsup for builds.

---

## Standard Stack

### Core Storage
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `bun:sqlite` | Built-in (Bun 1.1+) | SQLite database driver | Native Bun support, fastest SQLite driver, synchronous API |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@opencode-ai/plugin` | ^1.x | Plugin SDK types | TypeScript type checking for plugin development |
| `proper-lockfile` | ^4.1.2 | Cross-process file locking | Only if multi-process contention beyond SQLite's capabilities |

### Storage API Surface (Required for @memvid/sdk compatibility)
```typescript
interface StorageAPI {
  create(options: { filePath: string }): void;           // Initialize storage
  write(id: string, data: unknown): void;                // Store entry
  read(id: string): unknown | null;                     // Retrieve entry
  search(query: string): Array<{ id: string; data: unknown }>; // Full-text search
  close(): void;                                         // Clean shutdown
}
```

**Installation:**
```bash
# Core dependencies
npm install @opencode-ai/plugin proper-lockfile

# Dev dependencies (if using tsup)
npm install -D tsup typescript @types/bun
```

---

## Architecture Patterns

### Recommended Project Structure
```
opencode-brain/
├── src/
│   ├── index.ts           # Plugin entry point
│   ├── storage/
│   │   ├── index.ts       # Storage API exports
│   │   ├── database.ts    # Bun:sqlite wrapper
│   │   ├── schema.ts      # SQLite schema definitions
│   │   └── lock.ts        # File locking utilities
│   ├── hooks/
│   │   ├── index.ts       # Hook exports
│   │   ├── session.ts     # Session event handlers
│   │   └── tool.ts        # Tool execution handlers
│   └── types.ts           # TypeScript interfaces
├── dist/                  # Compiled output
├── package.json
├── tsconfig.json
└── bun.lock
```

### Pattern 1: Bun:sqlite Database Wrapper
**What:** Wraps bun:sqlite Database with required API surface
**When to use:** Implementing storage layer
**Example:**
```typescript
// Source: https://bun.com/docs/runtime/sqlite
import { Database } from "bun:sqlite";

export class BrainStorage {
  private db: Database;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.db = new Database(filePath, { create: true });
    
    // Enable WAL mode for better concurrency
    this.db.run("PRAGMA journal_mode = WAL");
    this.initSchema();
  }

  private initSchema() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);
    
    // FTS5 virtual table for full-text search (Linux/Windows)
    // Fallback to LIKE queries on macOS without custom SQLite
    this.db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        content,
        content_rowid=id
      )
    `);
  }

  write(id: string, data: unknown): void {
    const tx = this.db.transaction((id: string, content: string, meta: string) => {
      this.db.run(
        "INSERT OR REPLACE INTO memories (id, content, metadata) VALUES (?, ?, ?)",
        [id, content, meta]
      );
    });
    tx(id, JSON.stringify(data), "{}");
  }

  read(id: string): unknown | null {
    const result = this.db
      .query("SELECT content FROM memories WHERE id = ?")
      .get(id);
    return result ? JSON.parse(result.content) : null;
  }

  search(query: string): Array<{ id: string; data: unknown }> {
    // Use FTS5 if available, fallback to LIKE
    try {
      const results = this.db
        .query(`
          SELECT m.id, m.content 
          FROM memories_fts fts
          JOIN memories m ON fts.rowid = m.rowid
          WHERE memories_fts MATCH ?
        `)
        .all(query);
      return results.map(r => ({ id: r.id, data: JSON.parse(r.content) }));
    } catch {
      // Fallback for macOS without FTS5
      const results = this.db
        .query("SELECT id, content FROM memories WHERE content LIKE ?")
        .all(`%${query}%`);
      return results.map(r => ({ id: r.id, data: JSON.parse(r.content) }));
    }
  }

  close(): void {
    this.db.close();
  }
}
```

### Pattern 2: Opencode Plugin Structure
**What:** Native Opencode plugin with event hooks
**When to use:** Plugin architecture
**Example:**
```typescript
// Source: https://opencode.ai/docs/plugins/
import type { Plugin } from "@opencode-ai/plugin";
import { BrainStorage } from "./storage/database.js";

export const OpenCodeBrain: Plugin = async ({ client, directory, worktree }) => {
  // Determine storage path based on worktree
  const storageDir = worktree || directory;
  const dbPath = `${storageDir}/.opencode/mind.mv2`;
  
  // Auto-initialize storage
  const storage = new BrainStorage(dbPath);
  
  return {
    // Session lifecycle
    "session.created": async ({ session }) => {
      client.app.log({
        service: "opencode-brain",
        level: "info",
        message: `Storage initialized for session ${session.id}`,
      });
    },

    // Tool execution tracking
    "tool.execute.after": async (input) => {
      if (input.tool === "edit" || input.tool === "write") {
        // Store memory about file modifications
        storage.write(`edit-${Date.now()}`, {
          type: "file-edit",
          file: input.args.filePath,
          timestamp: Date.now(),
        });
      }
    },

    // Cleanup on session end
    "session.deleted": async () => {
      storage.close();
    },
  };
};
```

### Pattern 3: Bun TypeScript Configuration
**What:** Zero-config TypeScript with Bun
**When to use:** All TypeScript files in Bun projects
**Example:**
```json
// tsconfig.json - Bun optimized
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*"]
}
```

### Anti-Patterns to Avoid
- **Don't use `better-sqlite3`**: bun:sqlite is 3-6x faster and built-in
- **Don't hand-roll file locking**: SQLite has built-in locking, only add if cross-process coordination needed
- **Don't use async SQLite APIs**: bun:sqlite is synchronous by design (faster for typical use)
- **Don't commit .opencode/ to git**: Storage file should be gitignored

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite driver | better-sqlite3, sqlite3 | bun:sqlite | 3-6x faster, zero deps, native Bun |
| Database locking | Custom lock files | SQLite WAL mode + built-in locking | SQLite handles concurrent readers/writer automatically |
| Cross-process locking | Custom IPC | proper-lockfile | Battle-tested, handles edge cases like crashes |
| Full-text search | Custom indexing | SQLite FTS5 (Linux) / LIKE fallback (macOS) | FTS5 is production-grade, built into SQLite |
| TypeScript transpiling | tsc | Bun native TS support | Zero config, instant startup |
| Testing | Jest/Vitest | bun:test | Built-in, Jest-compatible, faster |

**Key insight:** SQLite is a battle-tested, production-grade database. Its built-in locking (especially with WAL mode) handles most concurrency scenarios. Only add additional file locking for multi-process scenarios beyond SQLite's single-writer model.

---

## Common Pitfalls

### Pitfall 1: macOS FTS5 Unavailability
**What goes wrong:** FTS5 virtual tables fail on macOS because Apple's SQLite build disables extensions
**Why it happens:** macOS ships with proprietary SQLite build, not vanilla SQLite
**How to avoid:** 
- Detect FTS5 availability at runtime
- Provide LIKE-based fallback for full-text search
- Optionally use `Database.setCustomSQLite()` with Homebrew SQLite

**Detection code:**
```typescript
function hasFTS5(db: Database): boolean {
  try {
    db.run("CREATE VIRTUAL TABLE _test_fts USING fts5(x)");
    db.run("DROP TABLE _test_fts");
    return true;
  } catch {
    return false;
  }
}
```

### Pitfall 2: SQLite "database is locked" Errors
**What goes wrong:** Concurrent writes fail with SQLITE_BUSY
**Why it happens:** SQLite allows unlimited readers but only ONE writer at a time
**How to avoid:**
- Always enable WAL mode: `db.run("PRAGMA journal_mode = WAL")`
- Use transactions for bulk operations
- Implement retry logic with exponential backoff for writes
- Consider busy_timeout pragma: `db.run("PRAGMA busy_timeout = 5000")`

### Pitfall 3: Plugin Context Destructuring
**What goes wrong:** Plugin fails to access client, $, or other context properties
**Why it happens:** Plugin receives context object, not individual parameters
**How to avoid:**
```typescript
// CORRECT
export const MyPlugin: Plugin = async ({ client, $ }) => { ... }

// WRONG
export const MyPlugin: Plugin = async (client) => { ... } // client is actually context!
```

### Pitfall 4: Not Closing Database Connections
**What goes wrong:** Database corruption, WAL files not cleaned up
**Why it happens:** Bun garbage collects but SQLite cleanup needs explicit close()
**How to avoid:**
- Always call `storage.close()` in session.deleted handler
- Use `using` statement where available
- Register cleanup handlers for process exit signals

### Pitfall 5: Bun.lock Confusion
**What goes wrong:** Bun.lock is for package management, not file locking
**Why it happens:** Bun has `bun.lock` (lockfile) which is different from file locking
**How to avoid:** 
- Bun.lock tracks npm package versions
- Use proper-lockfile or SQLite's built-in locking for file access control
- Don't try to use Bun.lock for runtime file locking

---

## Code Examples

### Bun:sqlite Basic Operations
```typescript
// Source: https://bun.com/docs/runtime/sqlite
import { Database } from "bun:sqlite";

// Open database with options
const db = new Database("mind.mv2", { 
  create: true,  // Create if doesn't exist
  strict: true   // Error on missing params
});

// Enable WAL mode (critical for concurrency)
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA synchronous = NORMAL"); // Balance safety/speed

// Prepared statements (recommended)
const insert = db.prepare("INSERT INTO memories (id, content) VALUES (?, ?)");
const select = db.prepare("SELECT content FROM memories WHERE id = ?");

// Transaction
const batchInsert = db.transaction((items: string[]) => {
  for (const item of items) {
    insert.run(item, JSON.stringify({ data: item }));
  }
});

// Using statement with automatic cleanup
{
  using query = db.query("SELECT * FROM memories");
  const results = query.all();
}

// Close when done
db.close();
```

### Testing with bun:test
```typescript
// Source: https://bun.com/docs/test
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { BrainStorage } from "../src/storage/database.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("BrainStorage", () => {
  let tempDir: string;
  let storage: BrainStorage;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "brain-test-"));
    storage = new BrainStorage(join(tempDir, "test.mv2"));
  });

  afterEach(() => {
    storage.close();
    // Clean up tempDir
  });

  test("should write and read data", () => {
    storage.write("test-1", { message: "hello" });
    const result = storage.read("test-1");
    expect(result).toEqual({ message: "hello" });
  });

  test("should return null for missing keys", () => {
    const result = storage.read("non-existent");
    expect(result).toBeNull();
  });

  test("search should find matching content", () => {
    storage.write("a", { text: "hello world" });
    storage.write("b", { text: "goodbye world" });
    
    const results = storage.search("hello");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("a");
  });
});
```

### Build Configuration with tsup
```typescript
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "esnext",
  platform: "node",
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  external: [
    // Bun built-ins
    "bun:sqlite",
    "bun:test",
    // Opencode will provide these
    "@opencode-ai/plugin"
  ],
});
```

### File Locking (if needed)
```typescript
// Lock utility using proper-lockfile
import lockfile from "proper-lockfile";

export async function withLock<T>(
  filePath: string,
  operation: () => T
): Promise<T> {
  const release = await lockfile.lock(filePath, {
    retries: {
      retries: 10,
      factor: 2,
      minTimeout: 100,
      maxTimeout: 1000,
    },
  });
  
  try {
    return operation();
  } finally {
    await release();
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| better-sqlite3 | bun:sqlite | Bun 1.0+ | 3-6x faster, zero dependencies |
| Async SQLite APIs | Synchronous bun:sqlite | Bun 1.0+ | Simpler code, faster for typical use |
| DELETE journal mode | WAL mode | SQLite 3.7.0+ (2010) | Better concurrency, readers don't block writers |
| Separate build step | Bun native TS | Bun 1.0+ | Zero config, instant execution |
| Jest/Vitest | bun:test | Bun 1.0+ | Built-in, no deps, Jest-compatible |
| bun.lockb (binary) | bun.lock (text) | Bun 1.2+ | Human-readable, git-diffable |

**Deprecated/outdated:**
- @memvid/sdk: Not Bun-compatible, requires custom implementation
- better-sqlite3: Still works but bun:sqlite is superior for Bun projects
- DELETE journal mode: Slower concurrency, use WAL mode

---

## Open Questions

1. **FTS5 Availability on macOS**
   - What we know: macOS Apple SQLite disables extensions, FTS5 unavailable by default
   - What's unclear: Whether we should require Homebrew SQLite or use LIKE fallback
   - Recommendation: Implement runtime detection with LIKE fallback for Phase 1, add Homebrew option later

2. **Cross-Process Locking Necessity**
   - What we know: SQLite handles single-process concurrency well with WAL mode
   - What's unclear: Whether multiple OpenCode processes could access same database
   - Recommendation: Start without proper-lockfile, add only if SQLITE_BUSY errors observed in practice

3. **Plugin Auto-Installation Behavior**
   - What we know: Opencode auto-installs npm plugins to `~/.cache/opencode/node_modules/`
   - What's unclear: Exact initialization timing and error handling
   - Recommendation: Implement defensive initialization, log errors without crashing plugin

4. **Session Storage Scope**
   - What we know: Opencode has sessions with session.created/deleted events
   - What's unclear: Whether storage should be per-session or global with session metadata
   - Recommendation: Global storage with session_id column for filtering

---

## Sources

### Primary (HIGH confidence)
- https://bun.com/docs/runtime/sqlite - Bun:sqlite official documentation
- https://bun.com/reference/bun/sqlite/Database - Database class API reference
- https://opencode.ai/docs/plugins/ - Opencode plugin development guide
- https://bun.com/docs/test - Bun test runner documentation
- https://www.sqlite.org/wal.html - SQLite WAL mode documentation
- https://www.sqlite.org/fts5.html - FTS5 extension documentation

### Secondary (MEDIUM confidence)
- https://oneuptime.com/blog/post/2026-01-31-bun-sqlite/view - Bun SQLite guide
- https://gist.github.com/johnlindquist/0adf1032b4e84942f3e1050aba3c5e4a - OpenCode plugins guide
- https://github.com/oven-sh/bun/discussions/3468 - FTS5 enabled on Linux in Bun v0.6.12
- https://stackoverflow.com/questions/4060772/sqlite-concurrent-access - SQLite locking details

### Tertiary (LOW confidence)
- Various blog posts on Bun + TypeScript - Patterns confirmed with official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - From official Bun and Opencode documentation
- Architecture: HIGH - Multiple verified sources with code examples
- Pitfalls: HIGH - SQLite documentation + Bun GitHub discussions

**Research date:** 2025-02-03
**Valid until:** 30 days (stable APIs, but check for Bun 1.2+ changes)

**Researcher notes:**
- All Bun:sqlite APIs confirmed against official documentation
- Opencode plugin SDK verified against official docs and community examples
- FTS5 availability confirmed: Linux/Windows yes, macOS no (without custom SQLite)
- Testing approach verified: bun:test is production-ready and Jest-compatible
