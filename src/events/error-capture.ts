/**
 * Error Capture Module
 *
 * Captures session error events for debugging.
 * Filters sensitive error messages to prevent secrets from being stored.
 *
 * @module events/error-capture
 */

import type { MemoryEntry } from "../storage/storage-interface.js";
import type { EventBuffer } from "./buffer.js";
import { isSensitiveContent } from "../privacy/filter.js";

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
export function captureSessionError(
  error: Error,
  buffer: EventBuffer,
  sessionId: string
): void {
  try {
    // Skip if error message contains sensitive content
    if (isSensitiveContent(error.message)) {
      // Create sanitized entry without the sensitive message
      const entry: MemoryEntry = {
        id: crypto.randomUUID(),
        type: "problem",
        content: "Session error: [REDACTED - contains sensitive data]",
        createdAt: Date.now(),
        metadata: {
          sessionId,
          summary: `Error: ${error.name}`,
          error: error.name,
          redacted: true,
        },
      };

      buffer.add(entry);
      return;
    }

    // Create memory entry with error details
    const entry: MemoryEntry = {
      id: crypto.randomUUID(),
      type: "problem",
      content: `Session error: ${error.message}`,
      createdAt: Date.now(),
      metadata: {
        sessionId,
        summary: `Error: ${error.name}`,
        error: error.name,
      },
    };

    // Add to buffer
    buffer.add(entry);
  } catch {
    // Silent fail - don't create infinite error loop
    // If capturing the error fails, we just move on
  }
}
