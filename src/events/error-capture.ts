/**
 * Error Capture Module
 *
 * Captures session error events for debugging.
 * Filters sensitive error messages to prevent secrets from being stored.
 *
 * @module events/error-capture
 */

import type { MemoryEntry } from "../storage/storage-interface.js";
import { isSensitiveContent } from "../privacy/filter.js";

/**
 * Session error event from OpenCode SDK
 */
export interface SessionErrorEvent {
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
export function captureSessionError(
  event: SessionErrorEvent,
  sessionId: string
): MemoryEntry | null {
  try {
    // Validate error object exists
    if (!event || !event.error) {
      return null;
    }

    const error = event.error;

    // Skip if error message contains sensitive content
    if (error.message && isSensitiveContent(error.message)) {
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

      return entry;
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

    return entry;
  } catch (error) {
    // Silent fail - don't create infinite error loop
    // If capturing the error fails, we just move on
    console.error(
      "[ErrorCapture] Failed to capture session error:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}
