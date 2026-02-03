/**
 * Tool Capture Unit Tests
 *
 * Comprehensive tests for tool event capture functionality.
 * Tests observation type mapping, file extraction, content formatting,
 * and privacy integration.
 *
 * @module events/tool-capture.test
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  captureToolExecution,
  determineObservationType,
  extractFilesFromArgs,
  formatToolContent,
  type ToolExecuteInput,
} from "./tool-capture.js";
import { createEventBuffer } from "./buffer.js";
import type { IEventBuffer } from "./buffer.js";
import type { MemoryEntry } from "../storage/storage-interface.js";

describe("determineObservationType", () => {
  it("maps search to discovery", () => {
    expect(determineObservationType("search")).toBe("discovery");
  });

  it("maps read to discovery", () => {
    expect(determineObservationType("read")).toBe("discovery");
  });

  it("maps glob to discovery", () => {
    expect(determineObservationType("glob")).toBe("discovery");
  });

  it("maps ask to discovery", () => {
    expect(determineObservationType("ask")).toBe("discovery");
  });

  it("maps write to solution", () => {
    expect(determineObservationType("write")).toBe("solution");
  });

  it("maps bash to solution", () => {
    expect(determineObservationType("bash")).toBe("solution");
  });

  it("maps edit to refactor", () => {
    expect(determineObservationType("edit")).toBe("refactor");
  });

  it("maps unknown tools to pattern", () => {
    expect(determineObservationType("unknown")).toBe("pattern");
    expect(determineObservationType("custom")).toBe("pattern");
    expect(determineObservationType("")).toBe("pattern");
  });
});

describe("extractFilesFromArgs", () => {
  it("extracts filePath from args", () => {
    const args = { filePath: "/path/to/file.ts" };
    expect(extractFilesFromArgs(args)).toEqual(["/path/to/file.ts"]);
  });

  it("extracts path from args", () => {
    const args = { path: "/another/path.js" };
    expect(extractFilesFromArgs(args)).toEqual(["/another/path.js"]);
  });

  it("extracts file from args", () => {
    const args = { file: "/some/file.txt" };
    expect(extractFilesFromArgs(args)).toEqual(["/some/file.txt"]);
  });

  it("extracts multiple files from array", () => {
    const args = {
      files: ["/file1.ts", "/file2.ts", "/file3.ts"],
    };
    expect(extractFilesFromArgs(args)).toEqual(["/file1.ts", "/file2.ts", "/file3.ts"]);
  });

  it("returns empty array for no files", () => {
    expect(extractFilesFromArgs({})).toEqual([]);
    expect(extractFilesFromArgs({ foo: "bar" })).toEqual([]);
  });

  it("filters non-string values", () => {
    const args = {
      filePath: "/valid/path.ts",
      path: 123, // non-string
      file: null, // non-string
    };
    expect(extractFilesFromArgs(args)).toEqual(["/valid/path.ts"]);
  });

  it("handles undefined args", () => {
    expect(extractFilesFromArgs(undefined as unknown as Record<string, unknown>)).toEqual([]);
  });

  it("combines single file and files array", () => {
    const args = {
      filePath: "/single.ts",
      files: ["/array1.ts", "/array2.ts"],
    };
    const result = extractFilesFromArgs(args);
    expect(result).toContain("/single.ts");
    expect(result).toContain("/array1.ts");
    expect(result).toContain("/array2.ts");
    expect(result.length).toBe(3);
  });

  it("removes duplicates", () => {
    const args = {
      filePath: "/same.ts",
      path: "/same.ts",
      files: ["/same.ts"],
    };
    expect(extractFilesFromArgs(args)).toEqual(["/same.ts"]);
  });
});

describe("formatToolContent", () => {
  it("formats read tool", () => {
    const args = { filePath: "/src/file.ts" };
    expect(formatToolContent("read", args)).toBe("Read file: /src/file.ts");
  });

  it("formats read tool with path alias", () => {
    const args = { path: "/src/file.ts" };
    expect(formatToolContent("read", args)).toBe("Read file: /src/file.ts");
  });

  it("formats read tool with file alias", () => {
    const args = { file: "/src/file.ts" };
    expect(formatToolContent("read", args)).toBe("Read file: /src/file.ts");
  });

  it("formats read tool with missing args", () => {
    expect(formatToolContent("read", {})).toBe("Read file");
    expect(formatToolContent("read", undefined)).toBe("Read file");
  });

  it("formats write tool", () => {
    const args = { filePath: "/output.txt" };
    expect(formatToolContent("write", args)).toBe("Wrote file: /output.txt");
  });

  it("formats edit tool", () => {
    const args = { filePath: "/src/code.ts" };
    expect(formatToolContent("edit", args)).toBe("Edited file: /src/code.ts");
  });

  it("formats bash tool", () => {
    const args = { command: "npm install" };
    expect(formatToolContent("bash", args)).toBe("Executed: npm install");
  });

  it("formats bash tool with missing command", () => {
    expect(formatToolContent("bash", {})).toBe("Executed bash command");
  });

  it("formats search tool", () => {
    const args = { pattern: "TODO" };
    expect(formatToolContent("search", args)).toBe("Searched: TODO");
  });

  it("formats search tool with query alias", () => {
    const args = { query: "function" };
    expect(formatToolContent("search", args)).toBe("Searched: function");
  });

  it("formats glob tool", () => {
    const args = { pattern: "**/*.ts" };
    expect(formatToolContent("glob", args)).toBe("Glob search: **/*.ts");
  });

  it("formats ask tool", () => {
    const args = { question: "What is TypeScript?" };
    expect(formatToolContent("ask", args)).toBe("Asked: What is TypeScript?");
  });

  it("truncates long ask questions", () => {
    const longQuestion = "a".repeat(150);
    const args = { question: longQuestion };
    const result = formatToolContent("ask", args);
    expect(result.length).toBeLessThan(longQuestion.length);
    expect(result.endsWith("...")).toBe(true);
  });

  it("formats unknown tools", () => {
    expect(formatToolContent("custom", {})).toBe("Used custom tool");
    expect(formatToolContent("xyz", { foo: "bar" })).toBe("Used xyz tool");
  });
});

describe("captureToolExecution", () => {
  let capturedEntries: MemoryEntry[];
  let mockBuffer: IEventBuffer;

  beforeEach(() => {
    capturedEntries = [];
    mockBuffer = createEventBuffer({
      maxSize: 50,
      flushIntervalMs: 5000,
      onFlush: (entries) => {
        capturedEntries.push(...entries);
      },
    });
  });

  it("adds entry to buffer for read tool", () => {
    const input: ToolExecuteInput = {
      tool: "read",
      sessionID: "session-123",
      callID: "call-456",
      args: { filePath: "/test.ts" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries.length).toBe(1);
    expect(capturedEntries[0]!.type).toBe("discovery");
    expect(capturedEntries[0]!.content).toContain("Read file");
    expect(capturedEntries[0]!.metadata.sessionId).toBe("session-123");
    expect(capturedEntries[0]!.metadata.tool).toBe("read");
  });

  it("sanitizes bash commands", () => {
    const input: ToolExecuteInput = {
      tool: "bash",
      sessionID: "session-123",
      callID: "call-789",
      args: { command: "curl -u user:password https://api.example.com" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries.length).toBe(1);
    expect(capturedEntries[0]!.content).toContain("REDACTED");
  });

  it("preserves safe bash commands", () => {
    const input: ToolExecuteInput = {
      tool: "bash",
      sessionID: "session-123",
      callID: "call-abc",
      args: { command: "ls -la" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries.length).toBe(1);
    expect(capturedEntries[0]!.content).toBe("Executed: ls -la");
  });

  it("sets correct observation type for write", () => {
    const input: ToolExecuteInput = {
      tool: "write",
      sessionID: "session-123",
      callID: "call-def",
      args: { filePath: "/output.txt" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries[0]!.type).toBe("solution");
  });

  it("sets correct observation type for edit", () => {
    const input: ToolExecuteInput = {
      tool: "edit",
      sessionID: "session-123",
      callID: "call-ghi",
      args: { filePath: "/src/code.ts" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries[0]!.type).toBe("refactor");
  });

  it("includes session ID in metadata", () => {
    const input: ToolExecuteInput = {
      tool: "read",
      sessionID: "my-session-abc",
      callID: "call-xyz",
      args: { filePath: "/test.ts" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries[0]!.metadata.sessionId).toBe("my-session-abc");
  });

  it("includes tool name in metadata", () => {
    const input: ToolExecuteInput = {
      tool: "search",
      sessionID: "session-123",
      callID: "call-123",
      args: { pattern: "TODO" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries[0]!.metadata.tool).toBe("search");
    expect(capturedEntries[0]!.metadata.summary).toBe("search executed");
  });

  it("includes files in metadata", () => {
    const input: ToolExecuteInput = {
      tool: "write",
      sessionID: "session-123",
      callID: "call-files",
      args: { filePath: "/src/app.ts" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries[0]!.metadata.files).toEqual(["/src/app.ts"]);
  });

  it("handles undefined args gracefully", () => {
    const input: ToolExecuteInput = {
      tool: "read",
      sessionID: "session-123",
      callID: "call-noargs",
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries.length).toBe(1);
    expect(capturedEntries[0]!.content).toBe("Read file");
    expect(capturedEntries[0]!.metadata.files).toBeUndefined();
  });

  it("handles errors gracefully", () => {
    // Create a buffer that throws on add
    const badBuffer = {
      add: () => {
        throw new Error("Buffer error");
      },
    } as unknown as IEventBuffer;

    const input: ToolExecuteInput = {
      tool: "read",
      sessionID: "session-123",
      callID: "call-error",
      args: { filePath: "/test.ts" },
    };

    // Should not throw
    expect(() => captureToolExecution(input, badBuffer)).not.toThrow();
  });

  it("redacts passwords in content", () => {
    const input: ToolExecuteInput = {
      tool: "bash",
      sessionID: "session-123",
      callID: "call-pass",
      args: { command: "mysql -u root -p secretpassword123" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries.length).toBe(1);
    expect(capturedEntries[0]!.content).toContain("REDACTED");
    expect(capturedEntries[0]!.content).not.toContain("secretpassword123");
  });

  it("redacts API keys in bash content", () => {
    const input: ToolExecuteInput = {
      tool: "bash",
      sessionID: "session-123",
      callID: "call-api",
      args: {
        command: "export API_KEY=sk-abc123xyz789 && run.sh",
      },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    const entryContent = capturedEntries[0]!.content;
    expect(entryContent).toContain("REDACTED");
    expect(entryContent).not.toContain("sk-abc123xyz789");
  });

  it("skips sensitive bash commands entirely", () => {
    const input: ToolExecuteInput = {
      tool: "bash",
      sessionID: "session-123",
      callID: "call-skip",
      args: { command: "ssh user@host" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    // Safe commands should be preserved
    expect(capturedEntries[0]!.content).toBe("Executed: ssh user@host");
  });

  it("uses callID as entry ID", () => {
    const input: ToolExecuteInput = {
      tool: "read",
      sessionID: "session-123",
      callID: "custom-id-456",
      args: { filePath: "/test.ts" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries[0]!.id).toBe("custom-id-456");
  });

  it("handles null sessionID gracefully", () => {
    const input = {
      tool: "read",
      sessionID: null as unknown as string,
      callID: "call-null",
      args: { filePath: "/test.ts" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries.length).toBe(1);
    expect(capturedEntries[0]!.metadata.sessionId).toBeNull();
  });

  it("handles very long content gracefully", () => {
    const longContent = "a".repeat(10000);
    const input: ToolExecuteInput = {
      tool: "write",
      sessionID: "session-123",
      callID: "call-long",
      args: {
        filePath: "/bigfile.txt",
        content: longContent,
      },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    // Entry should exist but not contain the full content
    expect(capturedEntries.length).toBe(1);
    expect(capturedEntries[0]!.content.length).toBeLessThan(longContent.length);
  });

  it("captures glob tool with pattern", () => {
    const input: ToolExecuteInput = {
      tool: "glob",
      sessionID: "session-123",
      callID: "call-glob",
      args: { pattern: "**/*.test.ts" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries[0]!.type).toBe("discovery");
    expect(capturedEntries[0]!.content).toBe("Glob search: **/*.test.ts");
  });

  it("captures ask tool with question", () => {
    const input: ToolExecuteInput = {
      tool: "ask",
      sessionID: "session-123",
      callID: "call-ask",
      args: { question: "How do I use TypeScript?" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries[0]!.type).toBe("discovery");
    expect(capturedEntries[0]!.content).toContain("Asked");
    expect(capturedEntries[0]!.content).toContain("How do I use TypeScript?");
  });

  it("handles empty callID gracefully", () => {
    const input = {
      tool: "read",
      sessionID: "session-123",
      callID: "",
      args: { filePath: "/test.ts" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries.length).toBe(1);
    // Empty string is falsy, so crypto.randomUUID() is used instead
    // Result should be a valid UUID format (36 chars with dashes)
    expect(capturedEntries[0]!.id.length).toBe(36);
    expect(capturedEntries[0]!.id).toContain("-");
  });
});

describe("Privacy Integration", () => {
  let capturedEntries: MemoryEntry[];
  let mockBuffer: IEventBuffer;

  beforeEach(() => {
    capturedEntries = [];
    mockBuffer = createEventBuffer({
      maxSize: 50,
      flushIntervalMs: 5000,
      onFlush: (entries: MemoryEntry[]) => {
        capturedEntries.push(...entries);
      },
    });
  });

  it("redacts curl commands with credentials", () => {
    const input: ToolExecuteInput = {
      tool: "bash",
      sessionID: "session-123",
      callID: "call-curl",
      args: { command: "curl -u admin:secret123 https://api.example.com" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries[0]!.content).toBe("[REDACTED BASH COMMAND]");
  });

  it("preserves curl without credentials", () => {
    const input: ToolExecuteInput = {
      tool: "bash",
      sessionID: "session-123",
      callID: "call-curl-safe",
      args: { command: "curl https://api.example.com/data" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries[0]!.content).toBe("Executed: curl https://api.example.com/data");
  });

  it("redacts mysql commands with passwords", () => {
    const input: ToolExecuteInput = {
      tool: "bash",
      sessionID: "session-123",
      callID: "call-mysql",
      args: { command: "mysql -u root -p mypassword database" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries[0]!.content).toContain("REDACTED");
  });

  it("redacts URLs with embedded credentials", () => {
    const input: ToolExecuteInput = {
      tool: "bash",
      sessionID: "session-123",
      callID: "call-url",
      args: { command: "git clone https://user:pass@github.com/repo.git" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries[0]!.content).toContain("REDACTED");
  });

  it("redacts environment variable exports with secrets", () => {
    const input: ToolExecuteInput = {
      tool: "bash",
      sessionID: "session-123",
      callID: "call-env",
      args: { command: "export API_KEY=sk-123456789" },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries[0]!.content).toContain("REDACTED");
  });
});

describe("Edge Cases", () => {
  let capturedEntries: MemoryEntry[];
  let mockBuffer: IEventBuffer;

  beforeEach(() => {
    capturedEntries = [];
    mockBuffer = createEventBuffer({
      maxSize: 50,
      flushIntervalMs: 5000,
      onFlush: (entries: MemoryEntry[]) => {
        capturedEntries.push(...entries);
      },
    });
  });

  it("handles tool with no args property", () => {
    const input = {
      tool: "read",
      sessionID: "session-123",
      callID: "call-noargs",
    } as ToolExecuteInput;

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries.length).toBe(1);
    expect(capturedEntries[0]!.content).toBe("Read file");
  });

  it("handles tool with null args", () => {
    const input = {
      tool: "read",
      sessionID: "session-123",
      callID: "call-null",
      args: null,
    } as unknown as ToolExecuteInput;

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries.length).toBe(1);
  });

  it("handles files array with mixed types", () => {
    const input: ToolExecuteInput = {
      tool: "read",
      sessionID: "session-123",
      callID: "call-mixed",
      args: {
        files: ["/valid.ts", 123, null, "/also-valid.ts", undefined],
      },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries[0]!.metadata.files).toEqual(["/valid.ts", "/also-valid.ts"]);
  });

  it("handles tool names with special characters", () => {
    const input = {
      tool: "custom-tool_v2",
      sessionID: "session-123",
      callID: "call-special",
      args: {},
    } as ToolExecuteInput;

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries[0]!.type).toBe("pattern");
    expect(capturedEntries[0]!.content).toBe("Used custom-tool_v2 tool");
  });

  it("handles whitespace in bash commands", () => {
    const input: ToolExecuteInput = {
      tool: "bash",
      sessionID: "session-123",
      callID: "call-ws",
      args: { command: "   ls -la   " },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries[0]!.content).toBe("Executed: ls -la");
  });

  it("handles emoji and unicode in content", () => {
    const input: ToolExecuteInput = {
      tool: "write",
      sessionID: "session-123",
      callID: "call-emoji",
      args: {
        filePath: "/readme.md",
        content: "Hello 🎉 World! こんにちは",
      },
    };

    captureToolExecution(input, mockBuffer);
    mockBuffer.flush();

    expect(capturedEntries.length).toBe(1);
  });
});
