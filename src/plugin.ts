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

import type { Plugin } from "@opencode-ai/plugin";
import { createStorage } from "./storage/sqlite-storage.js";
import { loadConfig, getStoragePath } from "./config.js";
import { createEventBuffer } from "./events/buffer.js";
import type { MemoryEntry } from "./storage/storage-interface.js";
import { captureToolExecution } from "./events/tool-capture.js";
import { captureFileEdit } from "./events/file-capture.js";
import { captureSessionError } from "./events/error-capture.js";

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
export const OpencodeBrainPlugin: Plugin = async ({
  client,
  directory,
  worktree,
}) => {
  // Load configuration with defaults (reads from file directly)
  const config = loadConfig(directory);

  // Determine storage path based on worktree (or directory as fallback)
  const projectPath = worktree || directory;
  const storagePath = getStoragePath(projectPath, config);

  // Track current session ID for event metadata
  let currentSessionId: string = "unknown";

  // Initialize storage SYNCHRONOUSLY (bun:sqlite design)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let storage: any;
  try {
    storage = createStorage({ filePath: storagePath });
  } catch (error) {
    console.error(
      "[opencode-brain] Failed to initialize storage:",
      error instanceof Error ? error.message : String(error)
    );
    // Return all hooks with no-op implementations so Opencode doesn't get undefined
    return {
      "session.created": async () => {},
      "tool.execute.after": async () => {},
      "file.edited": async () => {},
      "session.deleted": async () => {},
      onError: (err: Error) => {
        console.error("[opencode-brain] Error:", err.message);
      },
    };
  }

  // Create event buffer for batched writes
  const eventBuffer = createEventBuffer({
    maxSize: 50,
    flushIntervalMs: 5000,
    onFlush: (entries: MemoryEntry[]) => {
      try {
        // Write all buffered entries to storage synchronously
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
    },
  });

  // Start periodic flush timer
  eventBuffer.start();

  // Log initialization if debug mode enabled
  if (config.debug) {
    try {
      const stats = storage.stats();
      client.app.log({
        body: {
          service: "opencode-brain",
          level: "info",
          message: `[opencode-brain] Storage initialized at ${storagePath} (${stats.count} memories)`,
        },
      });
    } catch {
      client.app.log({
        body: {
          service: "opencode-brain",
          level: "info",
          message: `[opencode-brain] Storage initialized at ${storagePath}`,
        },
      });
    }
  }

  // Return event handlers
  return {
    /**
     * Session created - Called when a new Opencode session starts
     *
     * This is where context injection would happen in Phase 3.
     * Currently tracks session ID for event metadata.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "session.created": async ({ session }: { session: { id: string } }) => {
      // Track session ID for all event capture
      currentSessionId = session.id;

      if (config.debug) {
        client.app.log({
          body: {
            service: "opencode-brain",
            level: "info",
            message: `[opencode-brain] Session ${session.id} started`,
          },
        });
      }

      // Stub for Phase 3: Context injection
      // TODO: Load relevant memories and inject into session context
    },

    /**
     * Tool executed - Called after each tool execution
     *
     * Captures tool usage for memory using EventBuffer for batched writes.
     * Privacy filtering is applied before storage.
     */
    "tool.execute.after": async (input: {
      tool: string;
      sessionID: string;
      callID: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      args?: Record<string, any>;
    }) => {
      if (config.debug) {
        console.log(
          `[opencode-brain] Tool executed: ${input.tool}`,
          input.args ? Object.keys(input.args) : "no args"
        );
      }

      try {
        // Capture tool execution with privacy filtering and buffering
        captureToolExecution(
          {
            tool: input.tool,
            sessionID: input.sessionID,
            callID: input.callID,
            args: input.args,
          },
          eventBuffer
        );
      } catch (error) {
        // Never throw - graceful degradation
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
    "file.edited": async (input: { filePath: string }) => {
      if (config.debug) {
        console.log(`[opencode-brain] File edited: ${input.filePath}`);
      }

      try {
        // Capture file edit with privacy filtering and buffering
        captureFileEdit(
          {
            filePath: input.filePath,
          },
          eventBuffer,
          currentSessionId
        );
      } catch (error) {
        // Never throw - graceful degradation
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

      // Stop buffer and flush remaining entries
      try {
        eventBuffer.stop();
      } catch (error) {
        console.error(
          "[opencode-brain] Error stopping event buffer:",
          error instanceof Error ? error.message : String(error)
        );
        // Silent fail - don't crash Opencode during shutdown
      }

      // Close storage connection (SYNCHRONOUS)
      try {
        storage.close();
      } catch (error) {
        console.error(
          "[opencode-brain] Error closing storage:",
          error instanceof Error ? error.message : String(error)
        );
        // Silent fail - don't crash Opencode during shutdown
      }
    },

    /**
     * Error handler - Called when plugin encounters an error
     *
     * Captures error to memory for debugging, then logs and continues.
     * Never throw from here - always graceful degradation.
     */
    onError: (error: Error) => {
      console.error("[opencode-brain] Plugin error:", error.message);

      try {
        captureSessionError(error, eventBuffer, currentSessionId);
      } catch {
        // Silent fail - don't create infinite error loop
      }

      // Don't re-throw - keep Opencode running
    },
  };
};

/**
 * Factory function for creating the plugin
 *
 * This is the primary export used by Opencode's plugin system.
 *
 * @example
 * ```typescript
 * import { createPlugin } from "./plugin.js";
 *
 * export default createPlugin();
 * ```
 */
export function createPlugin(): Plugin {
  return OpencodeBrainPlugin;
}
