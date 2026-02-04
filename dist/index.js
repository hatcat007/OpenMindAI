#!/usr/bin/env bun

// src/storage/sqlite-storage.ts
import { Database } from "bun:sqlite";
import { unlinkSync, existsSync } from "fs";
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
    this.cleanupStaleLockFiles(filePath);
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
   * Clean up stale SQLite lock files that can cause indefinite hangs
   *
   * WAL mode creates -wal and -shm files. If Opencode crashes or is killed,
   * these can be left behind with stale locks, causing the next open to hang.
   *
   * @param filePath - Path to the SQLite database file
   */
  cleanupStaleLockFiles(filePath) {
    const lockFiles = [
      `${filePath}-wal`,
      // WAL journal file
      `${filePath}-shm`,
      // Shared memory file
      `${filePath}-wal-summary`
      // WAL summary file (if exists)
    ];
    for (const lockFile of lockFiles) {
      try {
        if (existsSync(lockFile)) {
          unlinkSync(lockFile);
          console.log(`[opencode-brain] Cleaned up stale lock file: ${lockFile}`);
        }
      } catch {
      }
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
import { mkdirSync, readFileSync, accessSync, constants, statSync } from "fs";
var DEFAULT_CONFIG = {
  storagePath: ".opencode/mind.mv2",
  autoInitialize: true,
  debug: false
};
function loadConfig(directory) {
  let config = { ...DEFAULT_CONFIG };
  try {
    const configPath = join(directory, "opencode.json");
    const fileContent = readFileSync(configPath, "utf-8");
    const opencodeConfig = JSON.parse(fileContent);
    const pluginConfig = opencodeConfig["opencode-brain"];
    if (pluginConfig) {
      config = {
        ...config,
        ...pluginConfig
      };
    }
  } catch {
  }
  if (process.env.OPENCODE_BRAIN_STORAGE_PATH) {
    config.storagePath = process.env.OPENCODE_BRAIN_STORAGE_PATH;
  }
  if (process.env.OPENCODE_BRAIN_DEBUG) {
    config.debug = process.env.OPENCODE_BRAIN_DEBUG === "true";
  }
  if (process.env.OPENCODE_BRAIN_AUTO_INIT) {
    config.autoInitialize = process.env.OPENCODE_BRAIN_AUTO_INIT !== "false";
  }
  return config;
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
      console.log(`[opencode-brain] Creating directory: ${parentDir}`);
      mkdirSync(parentDir, { recursive: true });
      console.log(`[opencode-brain] Directory ready: ${parentDir}`);
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = error.code;
      if (code === "EEXIST") {
        console.log(`[opencode-brain] Directory already exists: ${filePath.slice(0, filePath.lastIndexOf("/"))}`);
        return;
      }
    }
    console.error(`[opencode-brain] CRITICAL: Failed to create directory for ${filePath}`);
    console.error(`[opencode-brain] Error details:`, error);
    throw new Error(
      `Cannot create storage directory: ${error instanceof Error ? error.message : String(error)}. Path: ${filePath}. Check permissions and disk space.`
    );
  }
}
function validateStoragePath(filePath) {
  const messages = [];
  try {
    if (!filePath || filePath.trim() === "") {
      return {
        valid: false,
        messages: ["Storage path is empty"],
        error: "Empty storage path provided"
      };
    }
    messages.push(`\u2713 Storage path specified: ${filePath}`);
    if (filePath.includes(" ")) {
      messages.push(`\u26A0 Warning: Path contains spaces, which may cause issues: ${filePath}`);
    }
    const parentDir = filePath.slice(0, filePath.lastIndexOf("/"));
    if (!parentDir || parentDir === "") {
      return {
        valid: false,
        messages: [...messages, "Cannot determine parent directory"],
        error: "Invalid file path format"
      };
    }
    messages.push(`\u2713 Parent directory: ${parentDir}`);
    try {
      mkdirSync(parentDir, { recursive: true });
      messages.push(`\u2713 Parent directory exists/created: ${parentDir}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        messages: [...messages, `\u2717 Cannot create parent directory: ${errorMsg}`],
        error: `Failed to create directory: ${errorMsg}`
      };
    }
    try {
      accessSync(parentDir, constants.W_OK | constants.R_OK);
      messages.push(`\u2713 Parent directory is readable and writable`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        messages: [...messages, `\u2717 Parent directory not writable: ${errorMsg}`],
        error: `Permission denied: ${errorMsg}`
      };
    }
    try {
      const stats = statSync(filePath);
      if (stats.isDirectory()) {
        return {
          valid: false,
          messages: [...messages, `\u2717 Storage path is a directory, not a file: ${filePath}`],
          error: "Storage path points to a directory"
        };
      }
      messages.push(`\u2713 Storage file exists (${(stats.size / 1024).toFixed(2)} KB)`);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error) {
        const code = error.code;
        if (code === "ENOENT") {
          messages.push(`\u2713 Storage file will be created (doesn't exist yet)`);
        } else {
          messages.push(`\u26A0 Cannot stat file: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    return {
      valid: true,
      messages
    };
  } catch (error) {
    return {
      valid: false,
      messages: [...messages, `\u2717 Unexpected error: ${error instanceof Error ? error.message : String(error)}`],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// src/events/buffer.ts
var DEFAULT_BUFFER_CONFIG = {
  maxSize: 50,
  flushIntervalMs: 5e3,
  onFlush: () => {
  }
};
function createEventBuffer(config) {
  const fullConfig = {
    ...DEFAULT_BUFFER_CONFIG,
    ...config
  };
  if (!fullConfig.onFlush || fullConfig.onFlush === DEFAULT_BUFFER_CONFIG.onFlush) {
    console.error("[EventBuffer] Warning: onFlush callback not provided");
  }
  let entries = [];
  let lastFlush = Date.now();
  let timer = null;
  let isFlushing = false;
  return {
    /**
     * Add an entry to the buffer
     * Triggers flush if buffer reaches maxSize
     */
    add(entry) {
      entries.push(entry);
      if (entries.length >= fullConfig.maxSize) {
        this.flush();
      }
    },
    /**
     * Flush all buffered entries to storage
     * Clears buffer after successful flush
     * Never throws - errors are logged to console.error
     */
    flush() {
      if (isFlushing) {
        return;
      }
      if (entries.length === 0) {
        return;
      }
      isFlushing = true;
      const entriesToFlush = [...entries];
      try {
        entries = [];
        fullConfig.onFlush(entriesToFlush);
        lastFlush = Date.now();
      } catch (error) {
        console.error(
          "[EventBuffer] Flush error:",
          error instanceof Error ? error.message : String(error)
        );
        entries = entriesToFlush;
      } finally {
        isFlushing = false;
      }
    },
    /**
     * Clear the buffer without flushing
     * Use with caution - may cause data loss
     */
    clear() {
      entries = [];
    },
    /**
     * Start the periodic flush timer
     * Flushes buffer at flushIntervalMs intervals
     */
    start() {
      this.stop();
      timer = setInterval(() => {
        this.flush();
      }, fullConfig.flushIntervalMs);
    },
    /**
     * Stop the periodic flush timer
     * Optionally flushes remaining entries
     */
    stop(options) {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (options?.flushRemaining !== false) {
        this.flush();
      }
    },
    /**
     * Get current buffer size
     * @returns Number of entries in buffer
     */
    size() {
      return entries.length;
    },
    /**
     * Get time since last flush
     * @returns Milliseconds since last flush
     */
    getLastFlushTime() {
      return Date.now() - lastFlush;
    },
    /**
     * Check if buffer is currently flushing
     * @returns True if flush is in progress
     */
    isFlushInProgress() {
      return isFlushing;
    }
  };
}
function createBuffer(onFlush, options) {
  return createEventBuffer({
    ...options,
    onFlush
  });
}
var EventBuffer = createEventBuffer;

// src/privacy/filter.ts
var SENSITIVE_PATTERNS = [
  // Password patterns
  /password\s*[:=]\s*\S+/i,
  /[a-zA-Z0-9_]*password[a-zA-Z0-9_]*\s*[=:]\s*["']?[^"'\s]+["']?/i,
  // API key patterns
  /api[_-]?key\s*[:=]\s*\S+/i,
  // Token patterns
  /token\s*[:=]\s*\S+/i,
  // Secret patterns
  /secret\s*[:=]\s*\S+/i,
  // Private key patterns
  /private[_-]?key\s*[:=]\s*\S+/i,
  /-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/,
  // URL with embedded credentials
  /:\/\/[^\s:@]+:[^\s:@]+@/
];
var EXCLUDED_PATH_PATTERNS = [
  // .env files and variations (.env.local, .env.development.local, etc.)
  // Matches .env at root or in any directory
  /(^|\/)\.env$/,
  /(^|\/)\.env\.[\w.-]+$/,
  // Git directory
  /\.git\//,
  // Certificate and key files
  /\.(key|pem|p12|pfx)$/i,
  // Files with sensitive names in path
  /secret/i,
  /password/i,
  /credential/i,
  /token/i,
  /private/i
];
var SENSITIVE_BASH_PATTERNS = [
  // curl with user credentials
  /curl.*-u\s/,
  /curl.*--user\s/,
  // ssh with password
  /ssh.*-p\s/,
  // mysql with password
  /mysql.*-p\s/,
  /mysql.*--password/,
  // postgres with password
  /psql.*-W\s/,
  /psql.*--password/
];
var REDACTED_STRING = "[REDACTED]";
var REDACTED_COMMAND_STRING = "[REDACTED BASH COMMAND]";
function sanitizeContent(content) {
  if (!content || typeof content !== "string") {
    return "";
  }
  let sanitized = content;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      const colonIndex = match.indexOf(":");
      const equalsIndex = match.indexOf("=");
      if (colonIndex > 0 && (equalsIndex === -1 || colonIndex < equalsIndex)) {
        return match.substring(0, colonIndex + 1) + " " + REDACTED_STRING;
      }
      if (equalsIndex > 0 && (colonIndex === -1 || equalsIndex < colonIndex)) {
        return match.substring(0, equalsIndex + 1) + REDACTED_STRING;
      }
      if (match.includes("://")) {
        return match.replace(/:\/\/[^:]+:[^@]+@/, "://" + REDACTED_STRING + "@");
      }
      return REDACTED_STRING;
    });
  }
  return sanitized;
}
function shouldCaptureFile(filePath) {
  if (!filePath || typeof filePath !== "string") {
    return false;
  }
  const normalizedPath = filePath.replace(/\\/g, "/");
  for (const pattern of EXCLUDED_PATH_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      return false;
    }
  }
  return true;
}
function sanitizeBashCommand(command) {
  if (!command || typeof command !== "string") {
    return null;
  }
  const trimmedCommand = command.trim();
  if (trimmedCommand.length === 0) {
    return null;
  }
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(trimmedCommand)) {
      return REDACTED_COMMAND_STRING;
    }
  }
  for (const pattern of SENSITIVE_BASH_PATTERNS) {
    if (pattern.test(trimmedCommand)) {
      return REDACTED_COMMAND_STRING;
    }
  }
  return trimmedCommand;
}
function isSensitiveContent(content) {
  if (!content || typeof content !== "string") {
    return false;
  }
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(content)) {
      return true;
    }
  }
  return false;
}
function sanitizeObject(obj) {
  if (typeof obj === "string") {
    return sanitizeContent(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }
  if (obj !== null && typeof obj === "object") {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes("password") || lowerKey.includes("secret") || lowerKey.includes("token") || lowerKey.includes("key") || lowerKey.includes("credential")) {
        sanitized[key] = REDACTED_STRING;
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized;
  }
  return obj;
}
function getExclusionReasons(filePath) {
  if (!filePath || typeof filePath !== "string") {
    return ["Invalid path"];
  }
  const normalizedPath = filePath.replace(/\\/g, "/");
  const reasons = [];
  const patternDescriptions = [
    [/\.env$/, ".env file"],
    [/\.env\.\w+$/, ".env variant file"],
    [/\.git\//, "Git directory file"],
    [/\.(key|pem|p12|pfx)$/i, "Certificate/key file"],
    [/secret/i, "Path contains 'secret'"],
    [/password/i, "Path contains 'password'"],
    [/credential/i, "Path contains 'credential'"],
    [/token/i, "Path contains 'token'"],
    [/private/i, "Path contains 'private'"]
  ];
  for (const [pattern, description] of patternDescriptions) {
    if (pattern.test(normalizedPath)) {
      reasons.push(description);
    }
  }
  return reasons;
}

// src/events/tool-capture.ts
function determineObservationType(tool) {
  const typeMap = {
    search: "discovery",
    read: "discovery",
    glob: "discovery",
    ask: "discovery",
    write: "solution",
    bash: "solution",
    edit: "refactor"
  };
  return typeMap[tool] || "pattern";
}
function extractFilesFromArgs(args) {
  const files = [];
  if (!args || typeof args !== "object") {
    return files;
  }
  const filePathKeys = ["filePath", "path", "file"];
  for (const key of filePathKeys) {
    const value = args[key];
    if (typeof value === "string" && value.length > 0) {
      files.push(value);
    }
  }
  if (Array.isArray(args.files)) {
    for (const file of args.files) {
      if (typeof file === "string" && file.length > 0) {
        files.push(file);
      }
    }
  }
  if (args.oldString || args.newString) {
    if (files.length === 0 && args.filePath) {
      files.push(String(args.filePath));
    }
  }
  return Array.from(new Set(files.filter((f) => typeof f === "string" && f.length > 0)));
}
function formatToolContent(tool, args) {
  const safeArgs = args || {};
  switch (tool) {
    case "read": {
      const filePath = safeArgs.filePath || safeArgs.path || safeArgs.file;
      if (typeof filePath === "string") {
        return `Read file: ${filePath}`;
      }
      return "Read file";
    }
    case "write": {
      const filePath = safeArgs.filePath || safeArgs.path || safeArgs.file;
      if (typeof filePath === "string") {
        return `Wrote file: ${filePath}`;
      }
      return "Wrote file";
    }
    case "edit": {
      const filePath = safeArgs.filePath || safeArgs.path || safeArgs.file;
      if (typeof filePath === "string") {
        return `Edited file: ${filePath}`;
      }
      return "Edited file";
    }
    case "bash": {
      const command = safeArgs.command;
      if (typeof command === "string") {
        return `Executed: ${command}`;
      }
      return "Executed bash command";
    }
    case "search": {
      const pattern = safeArgs.pattern || safeArgs.query;
      if (typeof pattern === "string") {
        return `Searched: ${pattern}`;
      }
      return "Performed search";
    }
    case "glob": {
      const pattern = safeArgs.pattern;
      if (typeof pattern === "string") {
        return `Glob search: ${pattern}`;
      }
      return "Performed glob search";
    }
    case "ask": {
      const question = safeArgs.question;
      if (typeof question === "string") {
        const truncated = question.length > 100 ? question.substring(0, 100) + "..." : question;
        return `Asked: ${truncated}`;
      }
      return "Asked question";
    }
    default:
      return `Used ${tool} tool`;
  }
}
function captureToolExecution(input, sessionId) {
  try {
    const observationType = determineObservationType(input.tool);
    const args = input.metadata?.args || {};
    const formattedContent = formatToolContent(input.tool, args);
    let sanitizedContent;
    if (input.tool === "bash" && args.command) {
      const sanitizedCommand = sanitizeBashCommand(String(args.command));
      if (sanitizedCommand === null) {
        sanitizedContent = "[REDACTED BASH COMMAND]";
      } else if (sanitizedCommand === "[REDACTED BASH COMMAND]") {
        sanitizedContent = sanitizedCommand;
      } else {
        sanitizedContent = `Executed: ${sanitizedCommand}`;
      }
    } else {
      sanitizedContent = sanitizeContent(formattedContent);
    }
    const files = extractFilesFromArgs(args);
    const entry = {
      id: input.callID || crypto.randomUUID(),
      type: observationType,
      content: sanitizedContent,
      createdAt: Date.now(),
      metadata: {
        sessionId,
        tool: input.tool,
        summary: `${input.tool} executed`,
        files: files.length > 0 ? files : void 0
      }
    };
    return entry;
  } catch (error) {
    console.error(
      "[ToolCapture] Failed to capture tool execution:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

// src/events/file-capture.ts
function captureFileEdit(event, sessionId) {
  try {
    if (!shouldCaptureFile(event.filePath)) {
      return null;
    }
    const entry = {
      id: crypto.randomUUID(),
      type: "refactor",
      content: `File modified: ${event.filePath}`,
      createdAt: Date.now(),
      metadata: {
        sessionId,
        summary: `Edited ${event.filePath.split("/").pop() || event.filePath}`,
        files: [event.filePath]
      }
    };
    return entry;
  } catch (error) {
    console.error(
      "[FileCapture] Failed to capture file edit:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

// src/events/error-capture.ts
function captureSessionError(event, sessionId) {
  try {
    if (!event || !event.error) {
      return null;
    }
    const error = event.error;
    if (error.message && isSensitiveContent(error.message)) {
      const entry2 = {
        id: crypto.randomUUID(),
        type: "problem",
        content: "Session error: [REDACTED - contains sensitive data]",
        createdAt: Date.now(),
        metadata: {
          sessionId,
          summary: `Error: ${error.name}`,
          error: error.name,
          redacted: true
        }
      };
      return entry2;
    }
    const entry = {
      id: crypto.randomUUID(),
      type: "problem",
      content: `Session error: ${error.message}`,
      createdAt: Date.now(),
      metadata: {
        sessionId,
        summary: `Error: ${error.name}`,
        error: error.name
      }
    };
    return entry;
  } catch (error) {
    console.error(
      "[ErrorCapture] Failed to capture session error:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

// src/plugin.ts
var OpencodeBrainPlugin = async ({
  client,
  directory,
  worktree
}) => {
  console.log("[opencode-brain] Plugin starting...");
  const config = loadConfig(directory);
  console.log("[opencode-brain] Config loaded:", { debug: config.debug, storagePath: config.storagePath });
  const projectPath = worktree && worktree !== "/" ? worktree : directory;
  const storagePath = getStoragePath(projectPath, config);
  console.log("[opencode-brain] Storage path:", storagePath);
  console.log("[opencode-brain] Running pre-flight storage validation...");
  const validation = validateStoragePath(storagePath);
  for (const message of validation.messages) {
    console.log(`[opencode-brain] ${message}`);
  }
  if (!validation.valid) {
    console.error("[opencode-brain] \u274C STORAGE VALIDATION FAILED!");
    console.error(`[opencode-brain] Error: ${validation.error}`);
    console.error("[opencode-brain] Cannot initialize storage - plugin will run in read-only mode");
    return {
      config: async () => {
      },
      "session.created": async () => {
      },
      "session.deleted": async () => {
      },
      "file.edited": async () => {
      },
      "session.error": async () => {
      },
      "tool.execute.after": async () => {
      }
    };
  }
  console.log("[opencode-brain] \u2713 Pre-flight validation passed");
  let currentSessionId = "unknown";
  let storage;
  try {
    console.log("[opencode-brain] Creating storage instance...");
    storage = createStorage({ filePath: storagePath });
    console.log("[opencode-brain] \u2713 Storage initialized successfully at", storagePath);
    try {
      const stats = storage.stats();
      console.log(`[opencode-brain] \u2713 Storage ready: ${stats.count} memories, ${(stats.sizeBytes / 1024).toFixed(2)} KB`);
    } catch (statsError) {
      console.warn("[opencode-brain] \u26A0 Storage created but stats check failed:", statsError);
    }
  } catch (error) {
    console.error("[opencode-brain] \u274C CRITICAL: Failed to initialize storage!");
    console.error("[opencode-brain] Error type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("[opencode-brain] Error message:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error("[opencode-brain] Stack trace:", error.stack);
    }
    console.error("[opencode-brain] Storage path was:", storagePath);
    return {
      config: async () => {
      },
      "session.created": async () => {
      },
      "session.deleted": async () => {
      },
      "file.edited": async () => {
      },
      "session.error": async () => {
      },
      "tool.execute.after": async () => {
      }
    };
  }
  const eventBuffer = createEventBuffer({
    maxSize: 50,
    flushIntervalMs: 5e3,
    onFlush: (entries) => {
      try {
        for (const entry of entries) {
          storage.write(entry.id, entry);
        }
        if (config.debug) {
          console.log(`[opencode-brain] Flushed ${entries.length} entries`);
        }
      } catch (error) {
        console.error("[opencode-brain] Failed to flush:", error);
      }
    }
  });
  eventBuffer.start();
  console.log("[opencode-brain] Event buffer created");
  if (config.debug) {
    try {
      const stats = storage.stats();
      client.app.log({
        body: {
          service: "opencode-brain",
          level: "info",
          message: `[opencode-brain] Storage at ${storagePath} (${stats.count} memories)`
        }
      });
    } catch {
      client.app.log({
        body: {
          service: "opencode-brain",
          level: "info",
          message: `[opencode-brain] Storage at ${storagePath}`
        }
      });
    }
  }
  console.log("[opencode-brain] Returning hooks...");
  const hooks = {
    // Config hook (required by SDK v1.x)
    config: async () => {
    },
    // Session created handler
    "session.created": async ({ session }) => {
      try {
        currentSessionId = session.id;
        if (config.debug) {
          const stats = storage.stats();
          client.app.log({
            body: {
              service: "opencode-brain",
              level: "info",
              message: `Session ${session.id} started (${stats.count} memories)`
            }
          });
        }
      } catch (error) {
        console.error("[opencode-brain] Session created handler error:", error);
      }
    },
    // Session deleted handler
    "session.deleted": async ({ session }) => {
      try {
        if (config.debug) {
          console.log(`[opencode-brain] Session ${session.id} ending`);
        }
        eventBuffer.stop({ flushRemaining: true });
        storage?.close();
        if (config.debug) {
          console.log("[opencode-brain] Session ended, storage closed");
        }
      } catch (error) {
        console.error("[opencode-brain] Session deleted handler error:", error);
      }
    },
    // File edited handler
    "file.edited": async ({ file }) => {
      try {
        const entry = captureFileEdit({ filePath: file.path, sessionID: file.sessionID || currentSessionId }, currentSessionId);
        if (entry) {
          eventBuffer.add(entry);
          if (config.debug) {
            console.log(`[opencode-brain] Captured file edit: ${file.path}`);
          }
        }
      } catch (error) {
        console.error("[opencode-brain] File edited handler error:", error);
      }
    },
    // Session error handler
    "session.error": async ({ error, sessionID }) => {
      try {
        if (!error) {
          console.warn("[opencode-brain] Received session.error hook with no error object");
          return;
        }
        const entry = captureSessionError(
          {
            error: new Error(error.message || "Unknown error"),
            sessionID: sessionID || currentSessionId
          },
          currentSessionId
        );
        if (entry) {
          eventBuffer.add(entry);
          if (config.debug) {
            console.log("[opencode-brain] Captured session error");
          }
        }
      } catch (err) {
        console.error("[opencode-brain] Session error handler error:", err);
      }
    },
    // Tool execution handler
    "tool.execute.after": async (input, output) => {
      try {
        const entry = captureToolExecution(
          {
            tool: input.tool,
            sessionID: input.sessionID,
            callID: input.callID,
            output: output.output,
            metadata: output.metadata
          },
          currentSessionId
        );
        if (entry) {
          eventBuffer.add(entry);
          if (config.debug) {
            console.log(`[opencode-brain] Captured ${entry.type}: ${entry.content.slice(0, 50)}...`);
          }
        }
      } catch (error) {
        console.error("[opencode-brain] Tool capture error:", error);
      }
    }
  };
  return hooks;
};

// src/index.ts
var index_default = OpencodeBrainPlugin;
export {
  EventBuffer,
  OpencodeBrainPlugin,
  captureFileEdit,
  captureSessionError,
  captureToolExecution,
  createBuffer,
  index_default as default,
  getExclusionReasons,
  isSensitiveContent,
  sanitizeBashCommand,
  sanitizeContent,
  sanitizeObject,
  shouldCaptureFile
};
//# sourceMappingURL=index.js.map