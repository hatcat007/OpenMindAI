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
// import { captureToolExecution } from "./events/tool-capture.js";
// import { captureFileEdit } from "./events/file-capture.js";

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
  console.log("[opencode-brain] Plugin starting...");
  
  // Load configuration with defaults (reads from file directly)
  const config = loadConfig(directory);
  console.log("[opencode-brain] Config loaded:", { debug: config.debug, storagePath: config.storagePath });

  // Determine storage path based on worktree (or directory as fallback)
  const projectPath = worktree || directory;
  const storagePath = getStoragePath(projectPath, config);

  // Track current session ID for event metadata
  // let currentSessionId: string = "unknown";

  // Initialize storage SYNCHRONOUSLY (bun:sqlite design)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let storage: any;
  try {
    storage = createStorage({ filePath: storagePath });
    console.log("[opencode-brain] Storage initialized at", storagePath);
  } catch (error) {
    console.error(
      "[opencode-brain] Failed to initialize storage:",
      error instanceof Error ? error.message : String(error)
    );
    // Return minimal hooks so Opencode doesn't get undefined
    return {
      config: async () => {},
      event: async () => {},
      "tool.execute.after": async () => {},
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
  console.log("[opencode-brain] Event buffer created");

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

  console.log("[opencode-brain] Returning hooks...");

  // Return minimal hooks to test if opencode loads without error
  return {
    config: async () => {},
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
