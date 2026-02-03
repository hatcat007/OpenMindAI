/**
 * File and Error Capture Tests
 *
 * Comprehensive tests for captureFileEdit and captureSessionError functions.
 * Uses bun:test for Bun-native testing.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { captureFileEdit } from "./file-capture.js";
import { captureSessionError } from "./error-capture.js";
import { createEventBuffer } from "./buffer.js";
import type { IEventBuffer } from "./buffer.js";
import type { MemoryEntry } from "../storage/storage-interface.js";

describe("captureFileEdit", () => {
  let buffer: IEventBuffer;
  let flushedEntries: MemoryEntry[][] = [];

  beforeEach(() => {
    flushedEntries = [];
    buffer = createEventBuffer({
      maxSize: 100,
      onFlush: (entries: MemoryEntry[]) => {
        flushedEntries.push(entries);
      },
    });
  });

  it("captures regular file edit", () => {
    const result = captureFileEdit(
      { filePath: "src/index.ts" },
      buffer,
      "test-session-1"
    );

    expect(result).toBe(true);
    expect(buffer.size()).toBe(1);
  });

  it("returns true when captured", () => {
    const result = captureFileEdit(
      { filePath: "src/components/Button.tsx" },
      buffer,
      "test-session-2"
    );

    expect(result).toBe(true);
  });

  it("excludes .env file", () => {
    const result = captureFileEdit({ filePath: ".env" }, buffer, "test-session");

    expect(result).toBe(false);
    expect(buffer.size()).toBe(0);
  });

  it("excludes .env.local", () => {
    const result = captureFileEdit(
      { filePath: ".env.local" },
      buffer,
      "test-session"
    );

    expect(result).toBe(false);
    expect(buffer.size()).toBe(0);
  });

  it("excludes .env.development.local", () => {
    const result = captureFileEdit(
      { filePath: ".env.development.local" },
      buffer,
      "test-session"
    );

    expect(result).toBe(false);
    expect(buffer.size()).toBe(0);
  });

  it("excludes .git directory", () => {
    const result = captureFileEdit(
      { filePath: ".git/config" },
      buffer,
      "test-session"
    );

    expect(result).toBe(false);
    expect(buffer.size()).toBe(0);
  });

  it("excludes secret files", () => {
    const result = captureFileEdit(
      { filePath: "config/secrets.json" },
      buffer,
      "test-session"
    );

    expect(result).toBe(false);
    expect(buffer.size()).toBe(0);
  });

  it("excludes .key files", () => {
    const result = captureFileEdit(
      { filePath: "ssh/id_rsa.key" },
      buffer,
      "test-session"
    );

    expect(result).toBe(false);
    expect(buffer.size()).toBe(0);
  });

  it("excludes .pem files", () => {
    const result = captureFileEdit(
      { filePath: "certs/server.pem" },
      buffer,
      "test-session"
    );

    expect(result).toBe(false);
    expect(buffer.size()).toBe(0);
  });

  it("sets correct type to refactor", () => {
    captureFileEdit({ filePath: "src/index.ts" }, buffer, "test-session");
    buffer.flush();

    expect(flushedEntries.length).toBe(1);
    expect(flushedEntries[0]!.length).toBe(1);
    expect(flushedEntries[0]![0]!.type).toBe("refactor");
  });

  it("includes session ID in metadata", () => {
    captureFileEdit({ filePath: "src/index.ts" }, buffer, "session-abc-123");
    buffer.flush();

    expect(flushedEntries[0]![0]!.metadata.sessionId).toBe("session-abc-123");
  });

  it("includes file path in metadata.files", () => {
    captureFileEdit({ filePath: "src/utils/helper.ts" }, buffer, "test-session");
    buffer.flush();

    expect(flushedEntries[0]![0]!.metadata.files).toEqual(["src/utils/helper.ts"]);
  });

  it("includes file basename in summary", () => {
    captureFileEdit(
      { filePath: "src/components/MyComponent.tsx" },
      buffer,
      "test-session"
    );
    buffer.flush();

    expect(flushedEntries[0]![0]!.metadata.summary).toBe("Edited MyComponent.tsx");
  });

  it("handles missing slashes in path", () => {
    captureFileEdit({ filePath: "file.txt" }, buffer, "test-session");
    buffer.flush();

    expect(flushedEntries[0]![0]!.metadata.summary).toBe("Edited file.txt");
    expect(flushedEntries[0]![0]!.metadata.files).toEqual(["file.txt"]);
  });

  it("handles errors gracefully", () => {
    // Create a buffer that triggers auto-flush and throws during flush
    const badBuffer = createEventBuffer({
      maxSize: 2, // Small to trigger auto-flush on 2nd add
      onFlush: () => {
        throw new Error("Flush failed");
      },
    });

    // Add first entry (won't flush yet)
    captureFileEdit({ filePath: "src/file1.ts" }, badBuffer, "test-session");

    // Second entry triggers flush which throws, but should not crash plugin
    // The error is caught in EventBuffer, not in captureFileEdit
    expect(() => {
      captureFileEdit({ filePath: "src/file2.ts" }, badBuffer, "test-session");
    }).not.toThrow();

    // First entry was still captured (added to buffer)
    // Second entry was also added before flush
    expect(badBuffer.size()).toBe(0); // Buffer cleared before flush error
  });

  it("generates unique IDs for each entry", () => {
    captureFileEdit({ filePath: "src/file1.ts" }, buffer, "test-session");
    captureFileEdit({ filePath: "src/file2.ts" }, buffer, "test-session");
    buffer.flush();

    expect(flushedEntries[0]![0]!.id).not.toBe(flushedEntries[0]![1]!.id);
  });

  it("sets createdAt timestamp", () => {
    const before = Date.now();
    captureFileEdit({ filePath: "src/index.ts" }, buffer, "test-session");
    const after = Date.now();
    buffer.flush();

    expect(flushedEntries[0]![0]!.createdAt).toBeGreaterThanOrEqual(before);
    expect(flushedEntries[0]![0]!.createdAt).toBeLessThanOrEqual(after);
  });
});

describe("captureSessionError", () => {
  let buffer: IEventBuffer;
  let flushedEntries: MemoryEntry[][] = [];

  beforeEach(() => {
    flushedEntries = [];
    buffer = createEventBuffer({
      maxSize: 100,
      onFlush: (entries: MemoryEntry[]) => {
        flushedEntries.push(entries);
      },
    });
  });

  it("captures error to buffer", () => {
    const error = new Error("Test error message");
    captureSessionError(error, buffer, "test-session");

    expect(buffer.size()).toBe(1);
  });

  it("sets type to problem", () => {
    captureSessionError(new Error("Test"), buffer, "test-session");
    buffer.flush();

    expect(flushedEntries[0]![0]!.type).toBe("problem");
  });

  it("includes error name in metadata", () => {
    captureSessionError(new TypeError("Invalid type"), buffer, "test-session");
    buffer.flush();

    expect(flushedEntries[0]![0]!.metadata.error).toBe("TypeError");
  });

  it("includes error message in content", () => {
    captureSessionError(new Error("Something went wrong"), buffer, "test-session");
    buffer.flush();

    expect(flushedEntries[0]![0]!.content).toBe("Session error: Something went wrong");
  });

  it("includes session ID in metadata", () => {
    captureSessionError(new Error("Test"), buffer, "error-session-123");
    buffer.flush();

    expect(flushedEntries[0]![0]!.metadata.sessionId).toBe("error-session-123");
  });

  it("generates unique IDs", () => {
    captureSessionError(new Error("Error 1"), buffer, "session-1");
    captureSessionError(new Error("Error 2"), buffer, "session-1");
    buffer.flush();

    expect(flushedEntries[0]![0]!.id).not.toBe(flushedEntries[0]![1]!.id);
  });

  it("handles errors gracefully", () => {
    // Create a buffer that will throw when adding
    const badBuffer = createEventBuffer({
      maxSize: 100,
      onFlush: () => {
        throw new Error("Flush failed");
      },
    });

    // Should not throw
    expect(() => {
      captureSessionError(new Error("Test"), badBuffer, "test-session");
    }).not.toThrow();
  });

  it("redacts sensitive error messages", () => {
    const sensitiveError = new Error("password: secret123");
    captureSessionError(sensitiveError, buffer, "test-session");
    buffer.flush();

    expect(flushedEntries[0]![0]!.content).toBe("Session error: [REDACTED - contains sensitive data]");
    expect(flushedEntries[0]![0]!.metadata.redacted).toBe(true);
  });

  it("redacts API key errors", () => {
    const sensitiveError = new Error("api_key: sk-1234567890abcdef");
    captureSessionError(sensitiveError, buffer, "test-session");
    buffer.flush();

    expect(flushedEntries[0]![0]!.metadata.redacted).toBe(true);
  });

  it("does not redact safe error messages", () => {
    captureSessionError(new Error("File not found"), buffer, "test-session");
    buffer.flush();

    expect(flushedEntries[0]![0]!.metadata.redacted).toBeUndefined();
    expect(flushedEntries[0]![0]!.content).toBe("Session error: File not found");
  });

  it("includes error summary", () => {
    captureSessionError(new RangeError("Out of bounds"), buffer, "test-session");
    buffer.flush();

    expect(flushedEntries[0]![0]!.metadata.summary).toBe("Error: RangeError");
  });

  it("sets createdAt timestamp", () => {
    const before = Date.now();
    captureSessionError(new Error("Test"), buffer, "test-session");
    const after = Date.now();
    buffer.flush();

    expect(flushedEntries[0]![0]!.createdAt).toBeGreaterThanOrEqual(before);
    expect(flushedEntries[0]![0]!.createdAt).toBeLessThanOrEqual(after);
  });
});

describe("Integration: File and Error Capture with Buffer", () => {
  let buffer: IEventBuffer;
  let flushedEntries: MemoryEntry[][] = [];

  beforeEach(() => {
    flushedEntries = [];
    buffer = createEventBuffer({
      maxSize: 100,
      onFlush: (entries: MemoryEntry[]) => {
        flushedEntries.push(entries);
      },
    });
  });

  it("file edit flows through buffer", () => {
    captureFileEdit({ filePath: "src/app.ts" }, buffer, "session-1");
    captureFileEdit({ filePath: "src/utils.ts" }, buffer, "session-1");
    captureFileEdit({ filePath: ".env" }, buffer, "session-1"); // Should be excluded

    expect(buffer.size()).toBe(2); // Only 2 captured

    buffer.flush();
    expect(flushedEntries.length).toBe(1);
    expect(flushedEntries[0]!.length).toBe(2);
  });

  it("error flows through buffer", () => {
    captureSessionError(new Error("Error 1"), buffer, "session-1");
    captureSessionError(new Error("Error 2"), buffer, "session-1");
    captureSessionError(
      new Error("password: secret"),
      buffer,
      "session-1"
    ); // Redacted

    expect(buffer.size()).toBe(3);

    buffer.flush();
    expect(flushedEntries[0]!.length).toBe(3);

    // Check that redacted error is marked
    const redactedEntry = flushedEntries[0]!.find((e) =>
      e.content.includes("REDACTED")
    );
    expect(redactedEntry).toBeDefined();
    expect(redactedEntry!.metadata.redacted).toBe(true);
  });

  it("mixed events flow through buffer", () => {
    captureFileEdit({ filePath: "src/app.ts" }, buffer, "session-1");
    captureSessionError(new Error("Test error"), buffer, "session-1");
    captureFileEdit({ filePath: "src/lib.ts" }, buffer, "session-1");

    expect(buffer.size()).toBe(3);

    buffer.flush();
    expect(flushedEntries[0]!.length).toBe(3);

    // Check types
    expect(flushedEntries[0]![0]!.type).toBe("refactor");
    expect(flushedEntries[0]![1]!.type).toBe("problem");
    expect(flushedEntries[0]![2]!.type).toBe("refactor");
  });

  it("buffer flush persists all events", () => {
    // Create an array to capture all flushed entries
    const allEntries: MemoryEntry[] = [];
    const persistBuffer = createEventBuffer({
      maxSize: 10,
      onFlush: (entries: MemoryEntry[]) => {
        allEntries.push(...entries);
      },
    });

    // Add events
    for (let i = 0; i < 5; i++) {
      captureFileEdit({ filePath: `src/file${i}.ts` }, persistBuffer, "session-1");
    }
    captureSessionError(new Error("Critical error"), persistBuffer, "session-1");

    persistBuffer.flush();

    expect(allEntries.length).toBe(6);
    expect(allEntries.filter((e) => e.type === "refactor").length).toBe(5);
    expect(allEntries.filter((e) => e.type === "problem").length).toBe(1);
  });
});
