/**
 * Tool Event Capture Module
 *
 * Captures tool.execute.after events and converts them to MemoryEntry objects.
 * Integrates with EventBuffer for batched writes and PrivacyFilter for data sanitization.
 *
 * @module events/tool-capture
 */

import type { MemoryEntry } from "../storage/storage-interface.js";
import type { EventBuffer } from "./buffer.js";
import { sanitizeContent, sanitizeBashCommand } from "../privacy/filter.js";
import type { ObservationType } from "../types.js";

/**
 * Input data from tool.execute.after event
 */
export interface ToolExecuteInput {
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
 * Maps tool names to observation types.
 * Different tools represent different kinds of cognitive activity:
 * - discovery: Information gathering (search, read, glob)
 * - solution: Problem solving (write, bash for setup)
 * - refactor: Code changes (edit)
 * - pattern: Default/fallback
 *
 * @param tool - The tool name from Opencode
 * @returns The corresponding ObservationType
 */
export function determineObservationType(tool: string): ObservationType {
  const typeMap: Record<string, ObservationType> = {
    search: "discovery",
    read: "discovery",
    glob: "discovery",
    ask: "discovery",
    write: "solution",
    bash: "solution",
    edit: "refactor",
  };

  return typeMap[tool] || "pattern";
}

/**
 * Extracts file paths from tool arguments.
 * Different tools have different argument patterns for file references.
 *
 * @param args - Tool arguments from the event
 * @returns Array of file paths found in arguments
 */
export function extractFilesFromArgs(args: Record<string, unknown>): string[] {
  const files: string[] = [];

  if (!args || typeof args !== "object") {
    return files;
  }

  // Common file path argument names
  const filePathKeys = ["filePath", "path", "file"];
  for (const key of filePathKeys) {
    const value = args[key];
    if (typeof value === "string" && value.length > 0) {
      files.push(value);
    }
  }

  // Handle array of files
  if (Array.isArray(args.files)) {
    for (const file of args.files) {
      if (typeof file === "string" && file.length > 0) {
        files.push(file);
      }
    }
  }

  // For edit tool, try to infer file from context
  if (args.oldString || args.newString) {
    // If we have filePath already, it's already captured above
    // If not, this might be an edit without explicit file path
    // which is unusual but we handle gracefully
    if (files.length === 0 && args.filePath) {
      files.push(String(args.filePath));
    }
  }

  // Filter out non-string values and duplicates
  return [...new Set(files.filter((f) => typeof f === "string" && f.length > 0))];
}

/**
 * Creates a human-readable summary of tool execution.
 * Includes relevant arguments while respecting privacy.
 *
 * @param tool - The tool name
 * @param args - Tool arguments
 * @returns Formatted description of the tool execution
 */
export function formatToolContent(
  tool: string,
  args: Record<string, unknown> | undefined
): string {
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
        // Truncate very long questions
        const truncated =
          question.length > 100 ? question.substring(0, 100) + "..." : question;
        return `Asked: ${truncated}`;
      }
      return "Asked question";
    }

    default:
      return `Used ${tool} tool`;
  }
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
export function captureToolExecution(
  input: ToolExecuteInput,
  buffer: EventBuffer
): void {
  try {
    // Determine observation type
    const observationType = determineObservationType(input.tool);

    // Format content based on tool type
    const formattedContent = formatToolContent(input.tool, input.args);

    // Apply privacy filtering based on tool type
    let sanitizedContent: string;
    if (input.tool === "bash" && input.args?.command) {
      const sanitizedCommand = sanitizeBashCommand(String(input.args.command));
      sanitizedContent =
        sanitizedCommand === null
          ? "[REDACTED BASH COMMAND]"
          : `Executed: ${sanitizedCommand}`;
    } else {
      sanitizedContent = sanitizeContent(formattedContent);
    }

    // Extract file references
    const files = extractFilesFromArgs(input.args || {});

    // Create memory entry
    const entry: MemoryEntry = {
      id: input.callID || crypto.randomUUID(),
      type: observationType,
      content: sanitizedContent,
      createdAt: Date.now(),
      metadata: {
        sessionId: input.sessionID,
        tool: input.tool,
        summary: `${input.tool} executed`,
        files: files.length > 0 ? files : undefined,
      },
    };

    // Add to buffer for batched write
    buffer.add(entry);

    // Debug logging would happen in caller (plugin.ts)
  } catch (error) {
    // Never throw - graceful degradation
    console.error(
      "[ToolCapture] Failed to capture tool execution:",
      error instanceof Error ? error.message : String(error)
    );
    // Continue without crashing Opencode
  }
}
