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
import { mkdirSync, readFileSync } from "fs";
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
      mkdirSync(parentDir, { recursive: true });
    }
  } catch (error) {
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
      try {
        const entriesToFlush = [...entries];
        entries = [];
        fullConfig.onFlush(entriesToFlush);
        lastFlush = Date.now();
      } catch (error) {
        console.error(
          "[EventBuffer] Flush error:",
          error instanceof Error ? error.message : String(error)
        );
        entries = [...entries, ...entries];
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
  /password\s*[:=]\s*\S+/gi,
  /[a-zA-Z0-9_]*password[a-zA-Z0-9_]*\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  // API key patterns
  /api[_-]?key\s*[:=]\s*\S+/gi,
  // Token patterns
  /token\s*[:=]\s*\S+/gi,
  // Secret patterns
  /secret\s*[:=]\s*\S+/gi,
  // Private key patterns
  /private[_-]?key\s*[:=]\s*\S+/gi,
  /-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/,
  // URL with embedded credentials
  /:\/\/[^\s:@]+:[^\s:@]+@/g
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
function captureToolExecution(input, buffer) {
  try {
    const observationType = determineObservationType(input.tool);
    const formattedContent = formatToolContent(input.tool, input.args);
    let sanitizedContent;
    if (input.tool === "bash" && input.args?.command) {
      const sanitizedCommand = sanitizeBashCommand(String(input.args.command));
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
    const files = extractFilesFromArgs(input.args || {});
    const entry = {
      id: input.callID || crypto.randomUUID(),
      type: observationType,
      content: sanitizedContent,
      createdAt: Date.now(),
      metadata: {
        sessionId: input.sessionID,
        tool: input.tool,
        summary: `${input.tool} executed`,
        files: files.length > 0 ? files : void 0
      }
    };
    buffer.add(entry);
  } catch (error) {
    console.error(
      "[ToolCapture] Failed to capture tool execution:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

// src/events/file-capture.ts
function captureFileEdit(input, buffer, sessionId) {
  try {
    if (!shouldCaptureFile(input.filePath)) {
      return false;
    }
    const entry = {
      id: crypto.randomUUID(),
      type: "refactor",
      content: `File modified: ${input.filePath}`,
      createdAt: Date.now(),
      metadata: {
        sessionId,
        summary: `Edited ${input.filePath.split("/").pop() || input.filePath}`,
        files: [input.filePath]
      }
    };
    buffer.add(entry);
    return true;
  } catch (error) {
    console.error(
      "[FileCapture] Failed to capture file edit:",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

// src/plugin.ts
var OpencodeBrainPlugin = async ({
  client,
  directory,
  worktree
}) => {
  const config = loadConfig(directory);
  const projectPath = worktree || directory;
  const storagePath = getStoragePath(projectPath, config);
  let currentSessionId = "unknown";
  let storage;
  try {
    storage = createStorage({ filePath: storagePath });
  } catch (error) {
    console.error(
      "[opencode-brain] Failed to initialize storage:",
      error instanceof Error ? error.message : String(error)
    );
    return {
      config: async () => {
      },
      "session.created": async () => {
      },
      "tool.execute.after": async () => {
      },
      "file.edited": async () => {
      },
      "session.deleted": async () => {
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
          console.log(`[opencode-brain] Flushed ${entries.length} entries to storage`);
        }
      } catch (error) {
        console.error(
          "[opencode-brain] Failed to flush entries:",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  });
  eventBuffer.start();
  if (config.debug) {
    try {
      const stats = storage.stats();
      client.app.log({
        body: {
          service: "opencode-brain",
          level: "info",
          message: `[opencode-brain] Storage initialized at ${storagePath} (${stats.count} memories)`
        }
      });
    } catch {
      client.app.log({
        body: {
          service: "opencode-brain",
          level: "info",
          message: `[opencode-brain] Storage initialized at ${storagePath}`
        }
      });
    }
  }
  return {
    /**
     * Config hook - Called when plugin configuration is loaded from opencode.json
     *
     * This allows the plugin to react to configuration changes at runtime.
     */
    config: async (input) => {
      if (config.debug) {
        console.log("[opencode-brain] Config hook called", input);
      }
    },
    /**
     * Session created - Called when a new Opencode session starts
     *
     * This is where context injection would happen in Phase 3.
     * Currently tracks session ID for event metadata.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "session.created": async ({ session }) => {
      currentSessionId = session.id;
      if (config.debug) {
        client.app.log({
          body: {
            service: "opencode-brain",
            level: "info",
            message: `[opencode-brain] Session ${session.id} started`
          }
        });
      }
    },
    /**
     * Tool executed - Called after each tool execution
     *
     * Captures tool usage for memory using EventBuffer for batched writes.
     * Privacy filtering is applied before storage.
     */
    "tool.execute.after": async (input) => {
      if (config.debug) {
        console.log(
          `[opencode-brain] Tool executed: ${input.tool}`,
          input.args ? Object.keys(input.args) : "no args"
        );
      }
      try {
        captureToolExecution(
          {
            tool: input.tool,
            sessionID: input.sessionID,
            callID: input.callID,
            args: input.args
          },
          eventBuffer
        );
      } catch (error) {
        console.error(
          "[opencode-brain] Failed to capture tool execution:",
          error instanceof Error ? error.message : String(error)
        );
      }
    },
    /**
     * File edited - Called when a file is modified
     *
     * Captures file changes for memory using EventBuffer for batched writes.
     */
    "file.edited": async (input) => {
      if (config.debug) {
        console.log(`[opencode-brain] File edited: ${input.filePath}`);
      }
      try {
        captureFileEdit(
          {
            filePath: input.filePath
          },
          eventBuffer,
          currentSessionId
        );
      } catch (error) {
        console.error(
          "[opencode-brain] Failed to capture file edit:",
          error instanceof Error ? error.message : String(error)
        );
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
        console.log("[opencode-brain] Session ended, flushing buffer and closing storage");
      }
      try {
        eventBuffer.stop();
      } catch (error) {
        console.error(
          "[opencode-brain] Error stopping event buffer:",
          error instanceof Error ? error.message : String(error)
        );
      }
      try {
        storage.close();
      } catch (error) {
        console.error(
          "[opencode-brain] Error closing storage:",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  };
};

// src/events/error-capture.ts
function captureSessionError(error, buffer, sessionId) {
  try {
    if (isSensitiveContent(error.message)) {
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
      buffer.add(entry2);
      return;
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
    buffer.add(entry);
  } catch {
  }
}

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