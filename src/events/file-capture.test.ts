/**
 * File and Error Capture Tests
 *
 * Comprehensive tests for captureFileEdit and captureSessionError functions.
 * Uses bun:test for Bun-native testing.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { captureFileEdit, type FileEditedEvent } from "./file-capture.js";
import { captureSessionError, type SessionErrorEvent } from "./error-capture.js";
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

  // Helper to capture and add to buffer
  const captureAndAdd = (event: FileEditedEvent, sessionId: string, buf: IEventBuffer) => {
    const entry = captureFileEdit(event, sessionId);
    if (entry) {
      buf.add(entry);
    }
  };

  it("captures regular file edit", () => {
    const result = captureFileEdit(
      { filePath: "src/index.ts" },
      "test-session-1"
    );

    expect(result).not.toBeNull();
    expect(result!.type).toBe("refactor");
    buffer.add(result!);
    expect(buffer.size()).toBe(1);
  });

  it("returns entry when captured", () => {
    const result = captureFileEdit(
      { filePath: "src/components/Button.tsx" },
      "test-session-2"
    );

    expect(result).not.toBeNull();
    expect(result!.type).toBe("refactor");
  });

  it("excludes .env file", () => {
    const result = captureFileEdit({ filePath: ".env" }, "test-session");

    expect(result).toBeNull();
    expect(buffer.size()).toBe(0);
  });

  it("excludes .env.local", () => {
    const result = captureFileEdit(
      { filePath: ".env.local" },
      "test-session"
    );

    expect(result).toBeNull();
    expect(buffer.size()).toBe(0);
  });

  it("excludes .env.development.local", () => {
    const result = captureFileEdit(
      { filePath: ".env.development.local" },
      "test-session"
    );

    expect(result).toBeNull();
    expect(buffer.size()).toBe(0);
  });

  it("excludes .git directory", () => {
    const result = captureFileEdit(
      { filePath: ".git/config" },
      "test-session"
    );

    expect(result).toBeNull();
    expect(buffer.size()).toBe(0);
  });

  it("excludes secret files", () => {
    const result = captureFileEdit(
      { filePath: "config/secrets.json" },
      "test-session"
    );

    expect(result).toBeNull();
    expect(buffer.size()).toBe(0);
  });

  it("excludes .key files", () => {
    const result = captureFileEdit(
      { filePath: "ssh/id_rsa.key" },
      "test-session"
    );

    expect(result).toBeNull();
    expect(buffer.size()).toBe(0);
  });

  it("excludes .pem files", () => {
    const result = captureFileEdit(
      { filePath: "certs/server.pem" },
      "test-session"
    );

    expect(result).toBeNull();
    expect(buffer.size()).toBe(0);
  });

  it("sets correct type to refactor", () => {
    captureAndAdd({ filePath: "src/index.ts" }, "test-session", buffer);
    buffer.flush();

    expect(flushedEntries.length).toBe(1);
    expect(flushedEntries[0]!.length).toBe(1);
    expect(flushedEntries[0]![0]!.type).toBe("refactor");
  });

  it("includes session ID in metadata", () => {
    captureAndAdd({ filePath: "src/index.ts" }, "session-abc-123", buffer);
    buffer.flush();

    expect(flushedEntries[0]![0]!.metadata.sessionId).toBe("session-abc-123");
  });

  it("includes file path in metadata.files", () => {
    captureAndAdd({ filePath: "src/utils/helper.ts" }, "test-session", buffer);
    buffer.flush();

    expect(flushedEntries[0]![0]!.metadata.files).toEqual(["src/utils/helper.ts"]);
  });

  it("includes file basename in summary", () => {
    captureAndAdd(
      { filePath: "src/components/MyComponent.tsx" },
      "test-session",
      buffer
    );
    buffer.flush();

    expect(flushedEntries[0]![0]!.metadata.summary).toBe("Edited MyComponent.tsx");
  });

  it("handles missing slashes in path", () => {
    captureAndAdd({ filePath: "file.txt" }, "test-session", buffer);
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
    const entry1 = captureFileEdit({ filePath: "src/file1.ts" }, "test-session");
    if (entry1) badBuffer.add(entry1);

    // Second entry triggers flush which throws, but should not crash plugin
    // The error is caught in EventBuffer, not in captureFileEdit
    const entry2 = captureFileEdit({ filePath: "src/file2.ts" }, "test-session");
    expect(() => {
      if (entry2) badBuffer.add(entry2);
    }).not.toThrow();

    // Buffer restores entries on flush failure to prevent data loss
    // Both entries should still be in the buffer for retry
    expect(badBuffer.size()).toBe(2);
  });

  it("generates unique IDs for each entry", () => {
    captureAndAdd({ filePath: "src/file1.ts" }, "test-session", buffer);
    captureAndAdd({ filePath: "src/file2.ts" }, "test-session", buffer);
    buffer.flush();

    expect(flushedEntries[0]![0]!.id).not.toBe(flushedEntries[0]![1]!.id);
  });

  it("sets createdAt timestamp", () => {
    const before = Date.now();
    captureAndAdd({ filePath: "src/index.ts" }, "test-session", buffer);
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

  // Helper to capture and add to buffer
  const captureAndAdd = (event: SessionErrorEvent, sessionId: string, buf: IEventBuffer) => {
    const entry = captureSessionError(event, sessionId);
    if (entry) {
      buf.add(entry);
    }
  };

  it("captures error to buffer", () => {
    const error = new Error("Test error message");
    const entry = captureSessionError({ error }, "test-session");

    expect(entry).not.toBeNull();
    buffer.add(entry!);
    expect(buffer.size()).toBe(1);
  });

  it("sets type to problem", () => {
    captureAndAdd({ error: new Error("Test") }, "test-session", buffer);
    buffer.flush();

    expect(flushedEntries[0]![0]!.type).toBe("problem");
  });

  it("includes error name in metadata", () => {
    captureAndAdd({ error: new TypeError("Invalid type") }, "test-session", buffer);
    buffer.flush();

    expect(flushedEntries[0]![0]!.metadata.error).toBe("TypeError");
  });

  it("includes error message in content", () => {
    captureAndAdd({ error: new Error("Something went wrong") }, "test-session", buffer);
    buffer.flush();

    expect(flushedEntries[0]![0]!.content).toBe("Session error: Something went wrong");
  });

  it("includes session ID in metadata", () => {
    captureAndAdd({ error: new Error("Test") }, "error-session-123", buffer);
    buffer.flush();

    expect(flushedEntries[0]![0]!.metadata.sessionId).toBe("error-session-123");
  });

  it("generates unique IDs", () => {
    captureAndAdd({ error: new Error("Error 1") }, "session-1", buffer);
    captureAndAdd({ error: new Error("Error 2") }, "session-1", buffer);
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

    // captureSessionError returns entry, adding to buffer is separate
    const entry = captureSessionError({ error: new Error("Test") }, "test-session");
    expect(entry).not.toBeNull();

    // Should not throw when adding
    expect(() => {
      if (entry) badBuffer.add(entry);
    }).not.toThrow();
  });

  it("redacts sensitive error messages", () => {
    const sensitiveError = new Error("password: secret123");
    captureAndAdd({ error: sensitiveError }, "test-session", buffer);
    buffer.flush();

    expect(flushedEntries[0]![0]!.content).toBe("Session error: [REDACTED - contains sensitive data]");
    expect(flushedEntries[0]![0]!.metadata.redacted).toBe(true);
  });

  it("redacts API key errors", () => {
    const sensitiveError = new Error("api_key: sk-1234567890abcdef");
    captureAndAdd({ error: sensitiveError }, "test-session", buffer);
    buffer.flush();

    expect(flushedEntries[0]![0]!.metadata.redacted).toBe(true);
  });

  it("does not redact safe error messages", () => {
    captureAndAdd({ error: new Error("File not found") }, "test-session", buffer);
    buffer.flush();

    expect(flushedEntries[0]![0]!.metadata.redacted).toBeUndefined();
    expect(flushedEntries[0]![0]!.content).toBe("Session error: File not found");
  });

  it("includes error summary", () => {
    captureAndAdd({ error: new RangeError("Out of bounds") }, "test-session", buffer);
    buffer.flush();

    expect(flushedEntries[0]![0]!.metadata.summary).toBe("Error: RangeError");
  });

  it("sets createdAt timestamp", () => {
    const before = Date.now();
    captureAndAdd({ error: new Error("Test") }, "test-session", buffer);
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

  // Helpers to capture and add to buffer
  const captureFileAndAdd = (event: FileEditedEvent, sessionId: string, buf: IEventBuffer) => {
    const entry = captureFileEdit(event, sessionId);
    if (entry) buf.add(entry);
  };

  const captureErrorAndAdd = (event: SessionErrorEvent, sessionId: string, buf: IEventBuffer) => {
    const entry = captureSessionError(event, sessionId);
    if (entry) buf.add(entry);
  };

  it("file edit flows through buffer", () => {
    captureFileAndAdd({ filePath: "src/app.ts" }, "session-1", buffer);
    captureFileAndAdd({ filePath: "src/utils.ts" }, "session-1", buffer);
    // .env should be excluded (returns null)
    const envEntry = captureFileEdit({ filePath: ".env" }, "session-1");
    expect(envEntry).toBeNull();

    expect(buffer.size()).toBe(2); // Only 2 captured

    buffer.flush();
    expect(flushedEntries.length).toBe(1);
    expect(flushedEntries[0]!.length).toBe(2);
  });

  it("error flows through buffer", () => {
    captureErrorAndAdd({ error: new Error("Error 1") }, "session-1", buffer);
    captureErrorAndAdd({ error: new Error("Error 2") }, "session-1", buffer);
    captureErrorAndAdd(
      { error: new Error("password: secret") },
      "session-1",
      buffer
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
    captureFileAndAdd({ filePath: "src/app.ts" }, "session-1", buffer);
    captureErrorAndAdd({ error: new Error("Test error") }, "session-1", buffer);
    captureFileAndAdd({ filePath: "src/lib.ts" }, "session-1", buffer);

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
      const entry = captureFileEdit({ filePath: `src/file${i}.ts` }, "session-1");
      if (entry) persistBuffer.add(entry);
    }
    const errorEntry = captureSessionError({ error: new Error("Critical error") }, "session-1");
    if (errorEntry) persistBuffer.add(errorEntry);

    persistBuffer.flush();

    expect(allEntries.length).toBe(6);
    expect(allEntries.filter((e) => e.type === "refactor").length).toBe(5);
    expect(allEntries.filter((e) => e.type === "problem").length).toBe(1);
  });
});
