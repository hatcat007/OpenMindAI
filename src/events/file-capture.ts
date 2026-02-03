/**
 * File Capture Module
 *
 * Captures file edit events with privacy filtering.
 * Excludes sensitive files like .env, secrets, certificates.
 *
 * @module events/file-capture
 */

import type { MemoryEntry } from "../storage/storage-interface.js";
import type { IEventBuffer } from "./buffer.js";
import { shouldCaptureFile } from "../privacy/filter.js";

/**
 * Input for file edit capture
 */
export interface FileEditInput {
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
export function captureFileEdit(
  input: FileEditInput,
  buffer: IEventBuffer,
  sessionId: string
): boolean {
  try {
    // Check if file should be captured (privacy filtering)
    if (!shouldCaptureFile(input.filePath)) {
      return false; // Silently skip - no need to log for privacy
    }

    // Create memory entry
    const entry: MemoryEntry = {
      id: crypto.randomUUID(),
      type: "refactor",
      content: `File modified: ${input.filePath}`,
      createdAt: Date.now(),
      metadata: {
        sessionId,
        summary: `Edited ${input.filePath.split("/").pop() || input.filePath}`,
        files: [input.filePath],
      },
    };

    // Add to buffer
    buffer.add(entry);

    return true;
  } catch (error) {
    // Silent error handling - don't crash the plugin
    console.error(
      "[FileCapture] Failed to capture file edit:",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}
