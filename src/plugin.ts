/**
 * Opencode Brain Plugin Implementation
 *
 * Core plugin logic using @opencode-ai/plugin SDK.
 * Handles session lifecycle, event capture, and storage management.
 *
 * @module plugin
 */

import type { Plugin, Hooks } from "@opencode-ai/plugin";
import { createStorage } from "./storage/sqlite-storage.js";
import { loadConfig, getStoragePath, validateStoragePath } from "./config.js";
import { createEventBuffer } from "./events/buffer.js";
import type { MemoryEntry, StorageInterface } from "./storage/storage-interface.js";
import { captureToolExecution } from "./events/tool-capture.js";
import { captureFileEdit } from "./events/file-capture.js";
import { captureSessionError } from "./events/error-capture.js";

/**
 * Opencode Brain Plugin - Makes Opencode remember everything
 */
export const OpencodeBrainPlugin: Plugin = async ({
  client,
  directory,
  worktree,
}) => {
  console.log("[opencode-brain] Plugin starting...");

  // Load configuration with defaults
  const config = loadConfig(directory);
  console.log("[opencode-brain] Config loaded:", { debug: config.debug, storagePath: config.storagePath });

  // Determine storage path - use directory if worktree is root or not available
  const projectPath = (worktree && worktree !== "/") ? worktree : directory;
  const storagePath = getStoragePath(projectPath, config);
  console.log("[opencode-brain] Storage path:", storagePath);

  // PRE-FLIGHT VALIDATION: Validate storage path before attempting to create database
  console.log("[opencode-brain] Running pre-flight storage validation...");
  const validation = validateStoragePath(storagePath);

  // Log all validation messages
  for (const message of validation.messages) {
    console.log(`[opencode-brain] ${message}`);
  }

  if (!validation.valid) {
    console.error("[opencode-brain] ❌ STORAGE VALIDATION FAILED!");
    console.error(`[opencode-brain] Error: ${validation.error}`);
    console.error("[opencode-brain] Cannot initialize storage - plugin will run in read-only mode");

    // Return minimal hooks so Opencode doesn't get undefined
    return {
      config: async () => {},
      "session.created": async () => {},
      "session.deleted": async () => {},
      "file.edited": async () => {},
      "session.error": async () => {},
      "tool.execute.after": async () => {},
    };
  }

  console.log("[opencode-brain] ✓ Pre-flight validation passed");

  // Track current session ID
  let currentSessionId: string = "unknown";

  // Initialize storage
  let storage: StorageInterface | undefined;
  try {
    console.log("[opencode-brain] Creating storage instance...");
    storage = createStorage({ filePath: storagePath });
    console.log("[opencode-brain] ✓ Storage initialized successfully at", storagePath);

    // Verify storage is working by checking stats
    try {
      const stats = storage.stats();
      console.log(`[opencode-brain] ✓ Storage ready: ${stats.count} memories, ${(stats.sizeBytes / 1024).toFixed(2)} KB`);
    } catch (statsError) {
      console.warn("[opencode-brain] ⚠ Storage created but stats check failed:", statsError);
    }
  } catch (error) {
    console.error("[opencode-brain] ❌ CRITICAL: Failed to initialize storage!");
    console.error("[opencode-brain] Error type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("[opencode-brain] Error message:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error("[opencode-brain] Stack trace:", error.stack);
    }
    console.error("[opencode-brain] Storage path was:", storagePath);

    // Return minimal hooks so Opencode doesn't get undefined
    return {
      config: async () => {},
      "session.created": async () => {},
      "session.deleted": async () => {},
      "file.edited": async () => {},
      "session.error": async () => {},
      "tool.execute.after": async () => {},
    };
  }

  // Create event buffer
  const eventBuffer = createEventBuffer({
    maxSize: 50,
    flushIntervalMs: 5000,
    onFlush: (entries: MemoryEntry[]) => {
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
    },
  });

  eventBuffer.start();
  console.log("[opencode-brain] Event buffer created");

  // Log initialization
  if (config.debug) {
    try {
      const stats = storage.stats();
      client.app.log({
        body: {
          service: "opencode-brain",
          level: "info",
          message: `[opencode-brain] Storage at ${storagePath} (${stats.count} memories)`,
        },
      });
    } catch {
      client.app.log({
        body: {
          service: "opencode-brain",
          level: "info",
          message: `[opencode-brain] Storage at ${storagePath}`,
        },
      });
    }
  }

  console.log("[opencode-brain] Returning hooks...");

  // Return hooks using named hooks compatible with stable SDK
  const hooks: Hooks = {
    // Config hook (required by SDK v1.x)
    config: async () => {},

    // Session created handler
    "session.created": async ({ session }: { session: { id: string; slug: string; title: string } }) => {
      try {
        currentSessionId = session.id;
        if (config.debug) {
          const stats = storage.stats();
          client.app.log({
            body: {
              service: "opencode-brain",
              level: "info",
              message: `Session ${session.id} started (${stats.count} memories)`,
            },
          });
        }
      } catch (error) {
        console.error("[opencode-brain] Session created handler error:", error);
      }
    },

    // Session deleted handler
    "session.deleted": async ({ session }: { session: { id: string } }) => {
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
    "file.edited": async ({ file }: { file: { path: string; sessionID?: string } }) => {
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
    "session.error": async ({ error, sessionID }: { error: { message: string; stack?: string }; sessionID?: string }) => {
      try {
        // Validate error object exists
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
            metadata: output.metadata,
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
    },
  };

  return hooks;
};

/**
 * Factory function for creating the plugin
 */
export function createPlugin(): Plugin {
  return OpencodeBrainPlugin;
}
