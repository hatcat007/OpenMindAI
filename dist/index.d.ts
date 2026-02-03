import { Plugin } from '@opencode-ai/plugin';

/**
 * Opencode Brain Plugin Implementation
 *
 * Core plugin logic using @opencode-ai/plugin SDK.
 * Handles session lifecycle, event capture, and storage management.
 *
 * **CRITICAL IMPLEMENTATION NOTES:**
 *
 * 1. **Context Destructuring Pattern**
 *    The plugin receives a context object with destructured params.
 *    CORRECT: `async ({ client, directory, worktree }) => { ... }`
 *
 * 2. **Synchronous Storage**
 *    bun:sqlite uses SYNCHRONOUS API. No await needed for storage.
 *    CORRECT: `const storage = createStorage({ filePath }); storage.write(...)`
 *    WRONG: `await createStorage(...)` or `await storage.write(...)`
 *
 * 3. **Event Handler Patterns**
 *    - Use `session.created` for session start
 *    - Use `session.deleted` for cleanup (NOT session.idle)
 *    - Use `tool.execute.after` for post-tool capture
 *    - Always handle errors gracefully (never throw)
 *
 * 4. **Error Handling**
 *    Never throw from event handlers - log and continue gracefully.
 *
 * @module plugin
 */

/**
 * Opencode Brain Plugin - Makes Opencode remember everything
 *
 * This plugin captures session context and makes it available across sessions.
 * It initializes storage on load, captures events during the session, and
 * cleans up gracefully when the session ends.
 *
 * @example
 * ```typescript
 * // In opencode.json:
 * {
 *   "plugin": ["opencode-brain"],
 *   "opencode-brain": {
 *     "storagePath": ".opencode/mind.mv2",
 *     "debug": false
 *   }
 * }
 * ```
 */
declare const OpencodeBrainPlugin: Plugin;

/**
 * Plugin Configuration Module
 *
 * Configuration management for the Opencode Brain plugin.
 * Handles user config loading, defaults merging, and path resolution.
 *
 * @module config
 */
/**
 * Plugin configuration options
 */
interface PluginConfig {
    /** Storage file path (relative to worktree or absolute) */
    storagePath?: string;
    /** Auto-initialize storage on first run (default: true) */
    autoInitialize?: boolean;
    /** Enable debug logging (default: false) */
    debug?: boolean;
}

/**
 * Sanitizes content by redacting sensitive patterns.
 *
 * @param content - The content to sanitize
 * @returns Sanitized content with sensitive data replaced by [REDACTED]
 */
declare function sanitizeContent(content: string): string;
/**
 * Determines whether a file should be captured based on its path.
 *
 * @param filePath - The file path to check
 * @returns true if the file should be captured, false if it should be excluded
 */
declare function shouldCaptureFile(filePath: string): boolean;
/**
 * Sanitizes a bash command, redacting it if it contains sensitive patterns.
 *
 * @param command - The bash command to sanitize
 * @returns The sanitized command, [REDACTED BASH COMMAND] if sensitive, or null if empty
 */
declare function sanitizeBashCommand(command: string): string | null;
/**
 * Quickly checks if content contains sensitive patterns.
 * Useful for early exit optimization.
 *
 * @param content - The content to check
 * @returns true if content contains sensitive patterns
 */
declare function isSensitiveContent(content: string): boolean;
/**
 * Sanitizes an object recursively, redacting sensitive values.
 * Preserves object structure but replaces sensitive string values.
 *
 * @param obj - The object to sanitize
 * @returns A new object with sensitive values redacted
 */
declare function sanitizeObject<T>(obj: T): T;
/**
 * Gets a list of exclusion reasons for a file path.
 * Useful for debugging why a file was excluded.
 *
 * @param filePath - The file path to check
 * @returns Array of pattern descriptions that matched, or empty array if file should be captured
 */
declare function getExclusionReasons(filePath: string): string[];

/** Types of observations */
type ObservationType = "discovery" | "decision" | "problem" | "solution" | "pattern" | "warning" | "success" | "refactor" | "bugfix" | "feature";
/** Metadata attached to observations */
interface ObservationMetadata {
    files?: string[];
    functions?: string[];
    error?: string;
    confidence?: number;
    tags?: string[];
    sessionId?: string;
    [key: string]: unknown;
}

/**
 * Storage Interface - Bun-compatible SQLite storage layer
 *
 * Abstract storage interface matching @memvid/sdk API surface for future migration.
 * Designed for Bun runtime with synchronous API (bun:sqlite is synchronous).
 */

/**
 * Memory entry for storage - matches @memvid/sdk surface
 */
interface MemoryEntry {
    /** Unique identifier (UUID) */
    id: string;
    /** Observation type */
    type: ObservationType;
    /** Content text */
    content: string;
    /** Associated metadata */
    metadata: MemoryMetadata;
    /** Creation timestamp (Unix epoch in milliseconds) */
    createdAt: number;
}
/**
 * Extended metadata for storage entries
 */
interface MemoryMetadata extends ObservationMetadata {
    /** Session identifier */
    sessionId?: string;
    /** Project path */
    projectPath?: string;
    /** Source tool name */
    tool?: string;
    /** Observation summary */
    summary?: string;
}

/**
 * Event Buffer - In-memory buffering for batched writes
 *
 * Buffers MemoryEntry objects in memory and flushes to storage in batches.
 * Reduces I/O overhead by 10-100x compared to per-event writes.
 *
 * Bun-specific: Uses synchronous patterns throughout.
 */

/**
 * Configuration for event buffer
 */
interface BufferConfig {
    /** Maximum buffer size before auto-flush (default: 50) */
    maxSize: number;
    /** Flush interval in milliseconds (default: 5000) */
    flushIntervalMs: number;
    /** Callback function called when buffer flushes */
    onFlush: (entries: MemoryEntry[]) => void;
}
/**
 * In-memory event buffer with automatic batch flushing
 *
 * Features:
 * - Configurable size and time-based flush thresholds
 * - Prevents concurrent flushes with isFlushing flag
 * - Graceful error handling (never throws)
 * - Synchronous API for Bun compatibility
 */
declare class EventBuffer {
    private entries;
    private config;
    private lastFlush;
    private timer;
    private isFlushing;
    /**
     * Create a new event buffer
     * @param config - Buffer configuration (partial, defaults applied)
     */
    constructor(config?: Partial<BufferConfig>);
    /**
     * Add an entry to the buffer
     * Triggers flush if buffer reaches maxSize
     * @param entry - Memory entry to buffer
     */
    add(entry: MemoryEntry): void;
    /**
     * Flush all buffered entries to storage
     * Clears buffer after successful flush
     * Never throws - errors are logged to console.error
     */
    flush(): void;
    /**
     * Clear the buffer without flushing
     * Use with caution - may cause data loss
     */
    clear(): void;
    /**
     * Start the periodic flush timer
     * Flushes buffer at flushIntervalMs intervals
     */
    start(): void;
    /**
     * Stop the periodic flush timer
     * Optionally flushes remaining entries
     * @param options - Stop options
     * @param options.flushRemaining - Whether to flush before stopping (default: true)
     */
    stop(options?: {
        flushRemaining?: boolean;
    }): void;
    /**
     * Get current buffer size
     * @returns Number of entries in buffer
     */
    size(): number;
    /**
     * Get time since last flush
     * @returns Milliseconds since last flush
     */
    getLastFlushTime(): number;
    /**
     * Check if buffer is currently flushing
     * @returns True if flush is in progress
     */
    isFlushInProgress(): boolean;
}
/**
 * Factory function to create a configured event buffer
 * @param onFlush - Callback for flushed entries
 * @param options - Optional configuration overrides
 * @returns Configured EventBuffer instance
 */
declare function createBuffer(onFlush: (entries: MemoryEntry[]) => void, options?: Partial<Omit<BufferConfig, "onFlush">>): EventBuffer;

/**
 * Tool Event Capture Module
 *
 * Captures tool.execute.after events and converts them to MemoryEntry objects.
 * Integrates with EventBuffer for batched writes and PrivacyFilter for data sanitization.
 *
 * @module events/tool-capture
 */

/**
 * Input data from tool.execute.after event
 */
interface ToolExecuteInput {
    /** Tool name (e.g., "read", "write", "bash") */
    tool: string;
    /** Session identifier */
    sessionID: string;
    /** Unique call identifier */
    callID: string;
    /** Tool arguments */
    args?: Record<string, unknown>;
}
/**
 * Captures a tool execution event and adds it to the event buffer.
 * This is the main entry point for tool event capture.
 *
 * Features:
 * - Determines observation type from tool name
 * - Extracts file references from arguments
 * - Sanitizes content using privacy filters
 * - Creates MemoryEntry for storage
 * - Adds to buffer for batched writes
 *
 * @param input - Tool execution input from Opencode
 * @param buffer - EventBuffer for batched writes
 * @throws Never - all errors are caught and logged
 */
declare function captureToolExecution(input: ToolExecuteInput, buffer: EventBuffer): void;

/**
 * File Capture Module
 *
 * Captures file edit events with privacy filtering.
 * Excludes sensitive files like .env, secrets, certificates.
 *
 * @module events/file-capture
 */

/**
 * Input for file edit capture
 */
interface FileEditInput {
    /** Path of the file that was edited */
    filePath: string;
}
/**
 * Captures a file edit event to the event buffer.
 *
 * Checks if the file should be captured using privacy filtering,
 * then creates a MemoryEntry and adds it to the buffer.
 *
 * @param input - File edit input containing filePath
 * @param buffer - Event buffer to add the entry to
 * @param sessionId - Current session ID for metadata
 * @returns true if captured, false if skipped due to exclusion
 */
declare function captureFileEdit(input: FileEditInput, buffer: EventBuffer, sessionId: string): boolean;

/**
 * Error Capture Module
 *
 * Captures session error events for debugging.
 * Filters sensitive error messages to prevent secrets from being stored.
 *
 * @module events/error-capture
 */

/**
 * Captures a session error to the event buffer.
 *
 * Checks if the error message contains sensitive patterns,
 * then creates a MemoryEntry and adds it to the buffer.
 *
 * Note: This captures plugin-level errors, not tool errors
 * (tool errors are handled in tool-capture.ts).
 *
 * @param error - The error to capture
 * @param buffer - Event buffer to add the entry to
 * @param sessionId - Current session ID for metadata
 */
declare function captureSessionError(error: Error, buffer: EventBuffer, sessionId: string): void;

/**
 * Opencode Brain Plugin
 *
 * Memory persistence for Opencode - remember everything across sessions.
 *
 * @packageDocumentation
 */

export { EventBuffer, OpencodeBrainPlugin, type PluginConfig, captureFileEdit, captureSessionError, captureToolExecution, createBuffer, OpencodeBrainPlugin as default, getExclusionReasons, isSensitiveContent, sanitizeBashCommand, sanitizeContent, sanitizeObject, shouldCaptureFile };
