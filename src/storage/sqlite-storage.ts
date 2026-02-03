/**
 * Bun SQLite Storage Implementation
 *
 * Bun-compatible storage layer using bun:sqlite.
 * SYNCHRONOUS API - bun:sqlite returns values directly, not Promises.
 *
 * Features:
 * - WAL mode for concurrent access (no additional locking needed)
 * - FTS5 full-text search with macOS LIKE fallback
 * - Bun-compatible synchronous API
 * - Silent error handling (never crashes the plugin)
 */

import { Database } from "bun:sqlite";
import { unlinkSync, existsSync } from "node:fs";
import type {
  StorageInterface,
  StorageOptions,
  StorageStats,
  MemoryEntry,
  MemoryMetadata,
} from "./storage-interface.js";
import type { ObservationType } from "../types.js";

/**
 * SQLite-based storage implementation for Bun runtime
 *
 * All methods are SYNCHRONOUS - bun:sqlite uses synchronous API.
 */
export class BrainStorage implements StorageInterface {
  private db: Database;
  private filePath: string;
  private fts5Available: boolean;

  /**
   * Create a new storage instance
   * @param filePath - Path to SQLite database file
   */
  constructor(filePath: string) {
    this.filePath = filePath;

    // Clean up stale lock files that can cause hangs
    // These are created by WAL mode and can be left behind after crashes
    this.cleanupStaleLockFiles(filePath);

    // Open database with creation enabled
    this.db = new Database(filePath, { create: true });

    // Enable WAL mode for concurrent access
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA busy_timeout = 5000");

    // Check FTS5 availability
    this.fts5Available = this.checkFTS5Availability();

    // Initialize schema
    this.initializeSchema();
  }

  /**
   * Check if FTS5 is available (not available on macOS by default)
   */
  private checkFTS5Availability(): boolean {
    try {
      // Try to create a test FTS5 table
      this.db.run("CREATE VIRTUAL TABLE IF NOT EXISTS _fts5_test USING fts5(x)");
      this.db.run("DROP TABLE IF EXISTS _fts5_test");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up stale SQLite lock files that can cause indefinite hangs
   *
   * WAL mode creates -wal and -shm files. If Opencode crashes or is killed,
   * these can be left behind with stale locks, causing the next open to hang.
   *
   * @param filePath - Path to the SQLite database file
   */
  private cleanupStaleLockFiles(filePath: string): void {
    const lockFiles = [
      `${filePath}-wal`,      // WAL journal file
      `${filePath}-shm`,      // Shared memory file
      `${filePath}-wal-summary`, // WAL summary file (if exists)
    ];

    for (const lockFile of lockFiles) {
      try {
        if (existsSync(lockFile)) {
          unlinkSync(lockFile);
          console.log(`[opencode-brain] Cleaned up stale lock file: ${lockFile}`);
        }
      } catch {
        // Silent fail - file might not exist or we don't have permission
        // If we can't delete it, the database open might hang, but that's
        // better than crashing with an error
      }
    }
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    // Main memories table
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

    // Indices for efficient querying
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type)
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at)
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id)
    `);

    // FTS5 virtual table for full-text search (if available)
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
  write(id: string, data: MemoryEntry): void {
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

      // Update FTS5 index if available
      if (this.fts5Available) {
        try {
          const rowId = this.db
            .query("SELECT rowid FROM memories WHERE id = ?")
            .get(id) as { rowid: number } | null;

          if (rowId) {
            const ftsStmt = this.db.prepare(`
              INSERT OR REPLACE INTO memories_fts (rowid, content)
              VALUES (?, ?)
            `);
            ftsStmt.run(rowId.rowid, data.content);
            ftsStmt.finalize();
          }
        } catch (ftsError) {
          // Silent fail for FTS5 errors
          console.error("FTS5 index update failed:", ftsError);
        }
      }
    } catch (error) {
      // Silent fail - log but don't crash
      console.error("Storage write failed:", error);
    }
  }

  /**
   * Retrieve a memory entry by ID (SYNCHRONOUS)
   * @param id - Unique identifier
   * @returns Memory entry or null if not found
   */
  read(id: string): MemoryEntry | null {
    try {
      const row = this.db
        .query("SELECT * FROM memories WHERE id = ?")
        .get(id) as DatabaseRow | null;

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
  search(query: string, limit = 10): MemoryEntry[] {
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
  private searchFTS5(query: string, limit: number): MemoryEntry[] {
    try {
      const stmt = this.db.prepare(`
        SELECT m.* FROM memories m
        JOIN memories_fts fts ON fts.rowid = m.rowid
        WHERE fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `);

      const rows = stmt.all(query, limit) as DatabaseRow[];
      stmt.finalize();

      return rows.map((row) => this.rowToMemoryEntry(row));
    } catch {
      // Fallback to LIKE if FTS5 fails
      return this.searchLIKE(query, limit);
    }
  }

  /**
   * Search using LIKE (macOS fallback)
   */
  private searchLIKE(query: string, limit: number): MemoryEntry[] {
    const likePattern = `%${query.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

    const stmt = this.db.prepare(`
      SELECT * FROM memories
      WHERE content LIKE ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(likePattern, limit) as DatabaseRow[];
    stmt.finalize();

    return rows.map((row) => this.rowToMemoryEntry(row));
  }

  /**
   * Get storage statistics (SYNCHRONOUS)
   * @returns Storage statistics
   */
  stats(): StorageStats {
    try {
      const countRow = this.db
        .query("SELECT COUNT(*) as count FROM memories")
        .get() as { count: number } | null;

      const timeRange = this.db
        .query("SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM memories")
        .get() as { oldest: number | null; newest: number | null } | null;

      const typeCounts = this.db
        .query("SELECT type, COUNT(*) as count FROM memories GROUP BY type")
        .all() as { type: string; count: number }[];

      const byType: Record<string, number> = {};
      for (const { type, count } of typeCounts) {
        byType[type] = count;
      }

      // Estimate size based on SQLite page count
      let sizeBytes = 0;
      try {
        const pageCount = this.db
          .query("PRAGMA page_count")
          .get() as { "page_count": number } | null;
        const pageSize = this.db
          .query("PRAGMA page_size")
          .get() as { "page_size": number } | null;

        if (pageCount && pageSize) {
          sizeBytes = pageCount["page_count"] * pageSize["page_size"];
        }
      } catch {
        // Size estimation is not critical
      }

      return {
        count: countRow?.count || 0,
        sizeBytes,
        oldestEntry: timeRange?.oldest || undefined,
        newestEntry: timeRange?.newest || undefined,
        byType,
      };
    } catch (error) {
      console.error("Storage stats failed:", error);
      return {
        count: 0,
        sizeBytes: 0,
        byType: {},
      };
    }
  }

  /**
   * Close storage connection (SYNCHRONOUS)
   */
  close(): void {
    try {
      this.db.close();
    } catch (error) {
      console.error("Storage close failed:", error);
    }
  }

  /**
   * Convert database row to MemoryEntry
   */
  private rowToMemoryEntry(row: DatabaseRow): MemoryEntry {
    let metadata: MemoryMetadata;
    try {
      metadata = JSON.parse(row.metadata) as MemoryMetadata;
    } catch {
      metadata = {};
    }

    return {
      id: row.id,
      type: row.type as ObservationType,
      content: row.content,
      createdAt: row.created_at,
      metadata: {
        ...metadata,
        sessionId: row.session_id || metadata.sessionId,
      },
    };
  }

  /**
   * Check if WAL mode is enabled
   */
  isWALModeEnabled(): boolean {
    try {
      const result = this.db
        .query("PRAGMA journal_mode")
        .get() as { journal_mode: string } | null;
      return result?.journal_mode === "wal";
    } catch {
      return false;
    }
  }

  /**
   * Check if FTS5 is available
   */
  isFTS5Available(): boolean {
    return this.fts5Available;
  }

  /**
   * Get the storage file path
   */
  getFilePath(): string {
    return this.filePath;
  }
}

/**
 * Database row type
 */
interface DatabaseRow {
  id: string;
  type: string;
  content: string;
  metadata: string;
  created_at: number;
  session_id: string | null;
  rowid?: number;
}

/**
 * Factory function to create storage instance
 * @param options - Storage options
 * @returns StorageInterface instance
 */
export function createStorage(options: StorageOptions): StorageInterface {
  return new BrainStorage(options.filePath);
}
