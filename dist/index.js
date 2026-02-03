#!/usr/bin/env bun

// src/storage/sqlite-storage.ts
import { Database } from "bun:sqlite";
var BrainStorage = class {
  db;
  filePath;
  fts5Available;
  /**
   * Create a new storage instance
   * @param filePath - Path to SQLite database file
   */
  constructor(filePath) {
    this.filePath = filePath;
    this.db = new Database(filePath, { create: true });
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA busy_timeout = 5000");
    this.fts5Available = this.checkFTS5Availability();
    this.initializeSchema();
  }
  /**
   * Check if FTS5 is available (not available on macOS by default)
   */
  checkFTS5Availability() {
    try {
      this.db.run("CREATE VIRTUAL TABLE IF NOT EXISTS _fts5_test USING fts5(x)");
      this.db.run("DROP TABLE IF EXISTS _fts5_test");
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Initialize database schema
   */
  initializeSchema() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        session_id TEXT
      )
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type)
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at)
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id)
    `);
    if (this.fts5Available) {
      this.db.run(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
          content,
          content_rowid='rowid'
        )
      `);
    }
  }
  /**
   * Store a memory entry (SYNCHRONOUS)
   * @param id - Unique identifier
   * @param data - Memory entry data
   */
  write(id, data) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO memories
        (id, type, content, metadata, created_at, session_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id,
        data.type,
        data.content,
        JSON.stringify(data.metadata),
        data.createdAt,
        data.metadata?.sessionId || null
      );
      stmt.finalize();
      if (this.fts5Available) {
        try {
          const rowId = this.db.query("SELECT rowid FROM memories WHERE id = ?").get(id);
          if (rowId) {
            const ftsStmt = this.db.prepare(`
              INSERT OR REPLACE INTO memories_fts (rowid, content)
              VALUES (?, ?)
            `);
            ftsStmt.run(rowId.rowid, data.content);
            ftsStmt.finalize();
          }
        } catch (ftsError) {
          console.error("FTS5 index update failed:", ftsError);
        }
      }
    } catch (error) {
      console.error("Storage write failed:", error);
    }
  }
  /**
   * Retrieve a memory entry by ID (SYNCHRONOUS)
   * @param id - Unique identifier
   * @returns Memory entry or null if not found
   */
  read(id) {
    try {
      const row = this.db.query("SELECT * FROM memories WHERE id = ?").get(id);
      if (!row) {
        return null;
      }
      return this.rowToMemoryEntry(row);
    } catch (error) {
      console.error("Storage read failed:", error);
      return null;
    }
  }
  /**
   * Search memory entries (SYNCHRONOUS)
   * @param query - Search query string
   * @param limit - Maximum results (default: 10)
   * @returns Array of matching entries
   */
  search(query, limit = 10) {
    try {
      if (this.fts5Available) {
        return this.searchFTS5(query, limit);
      } else {
        return this.searchLIKE(query, limit);
      }
    } catch (error) {
      console.error("Storage search failed:", error);
      return [];
    }
  }
  /**
   * Search using FTS5 (Linux/Windows)
   */
  searchFTS5(query, limit) {
    try {
      const stmt = this.db.prepare(`
        SELECT m.* FROM memories m
        JOIN memories_fts fts ON fts.rowid = m.rowid
        WHERE fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `);
      const rows = stmt.all(query, limit);
      stmt.finalize();
      return rows.map((row) => this.rowToMemoryEntry(row));
    } catch {
      return this.searchLIKE(query, limit);
    }
  }
  /**
   * Search using LIKE (macOS fallback)
   */
  searchLIKE(query, limit) {
    const likePattern = `%${query.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    const stmt = this.db.prepare(`
      SELECT * FROM memories
      WHERE content LIKE ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(likePattern, limit);
    stmt.finalize();
    return rows.map((row) => this.rowToMemoryEntry(row));
  }
  /**
   * Get storage statistics (SYNCHRONOUS)
   * @returns Storage statistics
   */
  stats() {
    try {
      const countRow = this.db.query("SELECT COUNT(*) as count FROM memories").get();
      const timeRange = this.db.query("SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM memories").get();
      const typeCounts = this.db.query("SELECT type, COUNT(*) as count FROM memories GROUP BY type").all();
      const byType = {};
      for (const { type, count } of typeCounts) {
        byType[type] = count;
      }
      let sizeBytes = 0;
      try {
        const pageCount = this.db.query("PRAGMA page_count").get();
        const pageSize = this.db.query("PRAGMA page_size").get();
        if (pageCount && pageSize) {
          sizeBytes = pageCount["page_count"] * pageSize["page_size"];
        }
      } catch {
      }
      return {
        count: countRow?.count || 0,
        sizeBytes,
        oldestEntry: timeRange?.oldest || void 0,
        newestEntry: timeRange?.newest || void 0,
        byType
      };
    } catch (error) {
      console.error("Storage stats failed:", error);
      return {
        count: 0,
        sizeBytes: 0,
        byType: {}
      };
    }
  }
  /**
   * Close storage connection (SYNCHRONOUS)
   */
  close() {
    try {
      this.db.close();
    } catch (error) {
      console.error("Storage close failed:", error);
    }
  }
  /**
   * Convert database row to MemoryEntry
   */
  rowToMemoryEntry(row) {
    let metadata;
    try {
      metadata = JSON.parse(row.metadata);
    } catch {
      metadata = {};
    }
    return {
      id: row.id,
      type: row.type,
      content: row.content,
      createdAt: row.created_at,
      metadata: {
        ...metadata,
        sessionId: row.session_id || metadata.sessionId
      }
    };
  }
  /**
   * Check if WAL mode is enabled
   */
  isWALModeEnabled() {
    try {
      const result = this.db.query("PRAGMA journal_mode").get();
      return result?.journal_mode === "wal";
    } catch {
      return false;
    }
  }
  /**
   * Check if FTS5 is available
   */
  isFTS5Available() {
    return this.fts5Available;
  }
  /**
   * Get the storage file path
   */
  getFilePath() {
    return this.filePath;
  }
};
function createStorage(options) {
  return new BrainStorage(options.filePath);
}

// src/config.ts
import { join } from "path";
import { mkdirSync } from "fs";
var DEFAULT_CONFIG = {
  storagePath: ".opencode/mind.mv2",
  autoInitialize: true,
  debug: false
};
function loadConfig(ctx) {
  const userConfig = ctx.config || {};
  const envConfig = {};
  if (process.env.OPENCODE_BRAIN_STORAGE_PATH) {
    envConfig.storagePath = process.env.OPENCODE_BRAIN_STORAGE_PATH;
  }
  if (process.env.OPENCODE_BRAIN_DEBUG) {
    envConfig.debug = process.env.OPENCODE_BRAIN_DEBUG === "true";
  }
  if (process.env.OPENCODE_BRAIN_AUTO_INIT) {
    envConfig.autoInitialize = process.env.OPENCODE_BRAIN_AUTO_INIT !== "false";
  }
  return {
    storagePath: envConfig.storagePath ?? userConfig.storagePath ?? DEFAULT_CONFIG.storagePath,
    autoInitialize: envConfig.autoInitialize ?? userConfig.autoInitialize ?? DEFAULT_CONFIG.autoInitialize,
    debug: envConfig.debug ?? userConfig.debug ?? DEFAULT_CONFIG.debug
  };
}
function getStoragePath(worktree, config) {
  const storagePath = config.storagePath || DEFAULT_CONFIG.storagePath;
  if (storagePath.startsWith("/")) {
    ensureDirectory(storagePath);
    return storagePath;
  }
  const absolutePath = join(worktree, storagePath);
  ensureDirectory(absolutePath);
  return absolutePath;
}
function ensureDirectory(filePath) {
  try {
    const parentDir = filePath.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")) : ".";
    if (parentDir && parentDir !== ".") {
      mkdirSync(parentDir, { recursive: true });
    }
  } catch (error) {
  }
}

// src/plugin.ts
var OpencodeBrainPlugin = async ({
  client,
  directory,
  worktree
}) => {
  const pluginConfig = client.config?.["opencode-brain"] || {};
  const config = loadConfig({
    directory,
    worktree,
    config: pluginConfig
  });
  const projectPath = worktree || directory;
  const storagePath = getStoragePath(projectPath, config);
  let storage;
  try {
    storage = createStorage({ filePath: storagePath });
  } catch (error) {
    console.error(
      "[opencode-brain] Failed to initialize storage:",
      error instanceof Error ? error.message : String(error)
    );
    return {
      onError: (err) => {
        console.error("[opencode-brain] Error:", err.message);
      }
    };
  }
  if (config.debug) {
    try {
      const stats = storage.stats();
      client.app.log({
        message: `[opencode-brain] Storage initialized at ${storagePath} (${stats.count} memories)`
      });
    } catch {
      client.app.log({
        message: `[opencode-brain] Storage initialized at ${storagePath}`
      });
    }
  }
  return {
    /**
     * Session created - Called when a new Opencode session starts
     *
     * This is where context injection would happen in Phase 3.
     * Currently just logs initialization in debug mode.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "session.created": async ({ session }) => {
      if (config.debug) {
        client.app.log({
          message: `[opencode-brain] Session ${session.id} started`
        });
      }
    },
    /**
     * Tool executed - Called after each tool execution
     *
     * Captures tool usage for memory. Stub for Phase 2 implementation.
     * Currently just logs if debug mode is enabled.
     */
    "tool.execute.after": async (input) => {
      if (config.debug) {
        console.log(
          `[opencode-brain] Tool executed: ${input.tool}`,
          input.args ? Object.keys(input.args) : "no args"
        );
      }
    },
    /**
     * File edited - Called when a file is modified
     *
     * Captures file changes for memory. Stub for Phase 2.
     */
    "file.edited": async (input) => {
      if (config.debug) {
        console.log(`[opencode-brain] File edited: ${input.filePath}`);
      }
    },
    /**
     * Session deleted - Called when session ends
     *
     * Use session.deleted (not session.idle) for cleanup.
     * This is the reliable signal for session termination.
     */
    "session.deleted": async () => {
      if (config.debug) {
        console.log("[opencode-brain] Session ended, closing storage");
      }
      try {
        storage.close();
      } catch (error) {
        console.error(
          "[opencode-brain] Error closing storage:",
          error instanceof Error ? error.message : String(error)
        );
      }
    },
    /**
     * Error handler - Called when plugin encounters an error
     *
     * Never throw from here - log and continue gracefully.
     */
    onError: (error) => {
      console.error("[opencode-brain] Plugin error:", error.message);
    }
  };
};

// src/index.ts
var index_default = OpencodeBrainPlugin;
export {
  OpencodeBrainPlugin,
  index_default as default
};
//# sourceMappingURL=index.js.map