import { Plugin } from '@opencode-ai/plugin';

/**
 * Opencode Brain Plugin Implementation
 *
 * Core plugin logic using @opencode-ai/plugin SDK.
 * Handles session lifecycle, event capture, and storage management.
 *
 * @module plugin
 */

/**
 * Opencode Brain Plugin - Makes Opencode remember everything
 */
declare const OpencodeBrainPlugin: Plugin;

/**
 * Plugin Configuration Module
 *
 * Configuration management for the Opencode Brain plugin.
 * Handles user config loading, defaults merging, and path resolution.
 *
 * Hybrid approach:
 * 1. Reads from opencode.json file directly (not via SDK)
 * 2. Environment variables override file config
 * 3. Sensible defaults for everything else
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
 * Event buffer interface
 */
interface IEventBuffer {
    add(entry: MemoryEntry): void;
    flush(): void;
    clear(): void;
    start(): void;
    stop(options?: {
        flushRemaining?: boolean;
    }): void;
    size(): number;
    getLastFlushTime(): number;
    isFlushInProgress(): boolean;
}
/**
 * Create an in-memory event buffer with automatic batch flushing
 *
 * Features:
 * - Configurable size and time-based flush thresholds
 * - Prevents concurrent flushes with isFlushing flag
 * - Graceful error handling (never throws)
 * - Synchronous API for Bun compatibility
 *
 * @param config - Buffer configuration (partial, defaults applied)
 * @returns Event buffer instance
 *
 * @example
 * ```typescript
 * const buffer = createEventBuffer({
 *   maxSize: 50,
 *   flushIntervalMs: 5000,
 *   onFlush: (entries) => {
 *     entries.forEach(entry => storage.write(entry.id, entry));
 *   }
 * });
 * buffer.start();
 * ```
 */
declare function createEventBuffer(config?: Partial<BufferConfig>): IEventBuffer;
/**
 * Factory function to create a configured event buffer
 * @param onFlush - Callback for flushed entries
 * @param options - Optional configuration overrides
 * @returns Configured EventBuffer instance
 * @deprecated Use createEventBuffer instead
 */
declare function createBuffer(onFlush: (entries: MemoryEntry[]) => void, options?: Partial<Omit<BufferConfig, "onFlush">>): IEventBuffer;
/**
 * @deprecated Use createEventBuffer instead. This export is kept for backward compatibility.
 * The EventBuffer class has been converted to a factory function to avoid ESM interop issues.
 */
declare const EventBuffer: typeof createEventBuffer;

/**
 * Tool Event Capture Module
 *
 * Captures tool.execute.after events and converts them to MemoryEntry objects.
 * Integrates with EventBuffer for batched writes and PrivacyFilter for data sanitization.
 *
 * @module events/tool-capture
 */

/**
 * Input data from tool.execute.after event (OpenCode SDK format)
 */
interface ToolExecuteAfterInput {
    /** Tool name (e.g., "read", "write", "bash") */
    tool: string;
    /** Session identifier */
    sessionID: string;
    /** Unique call identifier */
    callID: string;
    /** Tool output */
    output: string;
    /** Tool metadata */
    metadata?: any;
}
/**
 * Captures a tool execution event and returns a MemoryEntry.
 * This is the main entry point for tool event capture.
 *
 * Features:
 * - Determines observation type from tool name
 * - Extracts file references from arguments
 * - Sanitizes content using privacy filters
 * - Creates MemoryEntry for storage
 *
 * @param input - Tool execution input from Opencode SDK
 * @param sessionId - Current session ID for metadata
 * @returns MemoryEntry or null if capture fails
 */
declare function captureToolExecution(input: ToolExecuteAfterInput, sessionId: string): MemoryEntry | null;

/**
 * File Capture Module
 *
 * Captures file edit events with privacy filtering.
 * Excludes sensitive files like .env, secrets, certificates.
 *
 * @module events/file-capture
 */

/**
 * File edited event from OpenCode SDK
 */
interface FileEditedEvent {
    /** Path of the file that was edited */
    filePath: string;
    /** Session identifier */
    sessionID?: string;
}
/**
 * Captures a file edit event and returns a MemoryEntry.
 *
 * Checks if the file should be captured using privacy filtering,
 * then creates a MemoryEntry.
 *
 * @param event - File edited event from OpenCode SDK
 * @param sessionId - Current session ID for metadata
 * @returns MemoryEntry or null if skipped/failed
 */
declare function captureFileEdit(event: FileEditedEvent, sessionId: string): MemoryEntry | null;

/**
 * Error Capture Module
 *
 * Captures session error events for debugging.
 * Filters sensitive error messages to prevent secrets from being stored.
 *
 * @module events/error-capture
 */

/**
 * Session error event from OpenCode SDK
 */
interface SessionErrorEvent {
    /** Error that occurred */
    error: Error;
    /** Session identifier */
    sessionID?: string;
}
/**
 * Captures a session error and returns a MemoryEntry.
 *
 * Checks if the error message contains sensitive patterns,
 * then creates a MemoryEntry.
 *
 * Note: This captures plugin-level errors, not tool errors
 * (tool errors are handled in tool-capture.ts).
 *
 * @param event - Session error event from OpenCode SDK
 * @param sessionId - Current session ID for metadata
 * @returns MemoryEntry or null if capture fails
 */
declare function captureSessionError(event: SessionErrorEvent, sessionId: string): MemoryEntry | null;

/**
 * Opencode Brain Plugin
 *
 * Memory persistence for Opencode - remember everything across sessions.
 *
 * @packageDocumentation
 */

export { EventBuffer, OpencodeBrainPlugin, type PluginConfig, captureFileEdit, captureSessionError, captureToolExecution, createBuffer, OpencodeBrainPlugin as default, getExclusionReasons, isSensitiveContent, sanitizeBashCommand, sanitizeContent, sanitizeObject, shouldCaptureFile };
