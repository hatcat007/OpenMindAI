/**
 * File Capture Module
 *
 * Captures file edit events with privacy filtering.
 * Excludes sensitive files like .env, secrets, certificates.
 *
 * @module events/file-capture
 */

import type { MemoryEntry } from "../storage/storage-interface.js";
import { shouldCaptureFile } from "../privacy/filter.js";

/**
 * File edited event from OpenCode SDK
 */
export interface FileEditedEvent {
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
export function captureFileEdit(
  event: FileEditedEvent,
  sessionId: string
): MemoryEntry | null {
  try {
    // Check if file should be captured (privacy filtering)
    if (!shouldCaptureFile(event.filePath)) {
      return null; // Silently skip - no need to log for privacy
    }

    // Create memory entry
    const entry: MemoryEntry = {
      id: crypto.randomUUID(),
      type: "refactor",
      content: `File modified: ${event.filePath}`,
      createdAt: Date.now(),
      metadata: {
        sessionId,
        summary: `Edited ${event.filePath.split("/").pop() || event.filePath}`,
        files: [event.filePath],
      },
    };

    return entry;
  } catch (error) {
    // Silent error handling - don't crash the plugin
    console.error(
      "[FileCapture] Failed to capture file edit:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}
