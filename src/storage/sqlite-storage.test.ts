/**
 * SQLite Storage Tests
 *
 * Tests for Bun-compatible SQLite storage layer.
 * Run with: bun test src/storage/sqlite-storage.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BrainStorage, createStorage } from "./sqlite-storage.js";
import type { MemoryEntry } from "./storage-interface.js";

describe("BrainStorage", () => {
  let tempDir: string;
  let storage: BrainStorage;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "brain-storage-test-"));
    const filePath = join(tempDir, "test.mv2");
    storage = new BrainStorage(filePath);
  });

  afterEach(() => {
    try {
      storage.close();
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Silent cleanup
    }
  });

  describe("Initialization", () => {
    it("should create storage with WAL mode enabled", () => {
      expect(storage.isWALModeEnabled()).toBe(true);
    });

    it("should detect FTS5 availability", () => {
      // FTS5 availability depends on the platform
      const hasFTS5 = storage.isFTS5Available();
      expect(typeof hasFTS5).toBe("boolean");
    });

    it("should store file path correctly", () => {
      expect(storage.getFilePath()).toContain("test.mv2");
    });
  });

  describe("Write and Read", () => {
    it("should write and read a memory entry synchronously", () => {
      const entry: MemoryEntry = {
        id: "test-1",
        type: "discovery",
        content: "Test content for storage",
        createdAt: Date.now(),
        metadata: {
          sessionId: "session-123",
          projectPath: "/test/project",
        },
      };

      // Write (synchronous)
      storage.write(entry.id, entry);

      // Read (synchronous)
      const result = storage.read(entry.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(entry.id);
      expect(result?.type).toBe(entry.type);
      expect(result?.content).toBe(entry.content);
      expect(result?.metadata.sessionId).toBe("session-123");
    });

    it("should return null for non-existent entry", () => {
      const result = storage.read("non-existent-id");
      expect(result).toBeNull();
    });

    it("should overwrite existing entries", () => {
      const id = "overwrite-test";
      const entry1: MemoryEntry = {
        id,
        type: "discovery",
        content: "Original content",
        createdAt: 1000,
        metadata: {},
      };

      const entry2: MemoryEntry = {
        id,
        type: "decision",
        content: "Updated content",
        createdAt: 2000,
        metadata: {},
      };

      storage.write(id, entry1);
      storage.write(id, entry2);

      const result = storage.read(id);
      expect(result?.content).toBe("Updated content");
      expect(result?.type).toBe("decision");
    });
  });

  describe("Search", () => {
    it("should search and find matching entries", () => {
      // Create test entries
      const entries: MemoryEntry[] = [
        {
          id: "search-1",
          type: "discovery",
          content: "Authentication implementation details",
          createdAt: Date.now(),
          metadata: {},
        },
        {
          id: "search-2",
          type: "decision",
          content: "Database schema design choices",
          createdAt: Date.now(),
          metadata: {},
        },
        {
          id: "search-3",
          type: "feature",
          content: "User login flow with JWT tokens",
          createdAt: Date.now(),
          metadata: {},
        },
      ];

      // Write all entries
      for (const entry of entries) {
        storage.write(entry.id, entry);
      }

      // Search (synchronous)
      const results = storage.search("authentication");

      expect(results.length).toBeGreaterThan(0);
      // Should find the authentication-related entry
      const found = results.some((r) => r.id === "search-1");
      expect(found).toBe(true);
    });

    it("should return empty array for no matches", () => {
      const results = storage.search("xyz-nonexistent-query");
      expect(results).toEqual([]);
    });

    it("should respect limit parameter", () => {
      // Create multiple entries
      for (let i = 0; i < 20; i++) {
        storage.write(`limit-test-${i}`, {
          id: `limit-test-${i}`,
          type: "discovery",
          content: `Test content with keyword searchable`,
          createdAt: Date.now(),
          metadata: {},
        });
      }

      const results = storage.search("searchable", 5);
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe("Stats", () => {
    it("should return zero stats for empty storage", () => {
      const stats = storage.stats();
      expect(stats.count).toBe(0);
      // Empty database still has file size (SQLite headers/metadata)
      expect(stats.sizeBytes).toBeGreaterThanOrEqual(0);
      expect(stats.byType).toEqual({});
    });

    it("should return correct stats after writes", () => {
      // Write entries of different types
      const types = ["discovery", "discovery", "decision", "feature"] as const;
      for (let i = 0; i < 4; i++) {
        storage.write(`stats-test-${i}`, {
          id: `stats-test-${i}`,
          type: types[i],
          content: `Test content ${i}`,
          createdAt: Date.now() + i * 1000,
          metadata: {},
        });
      }

      const stats = storage.stats();
      expect(stats.count).toBe(4);
      expect(stats.sizeBytes).toBeGreaterThan(0);
      expect(stats.byType.discovery).toBe(2);
      expect(stats.byType.decision).toBe(1);
      expect(stats.byType.feature).toBe(1);
    });
  });

  describe("Factory function", () => {
    it("should create storage via factory function", () => {
      const tempFile = join(tempDir, "factory-test.mv2");
      const factoryStorage = createStorage({ filePath: tempFile });

      expect(factoryStorage).toBeDefined();

      // Verify it works
      factoryStorage.write("factory-1", {
        id: "factory-1",
        type: "success",
        content: "Factory created storage",
        createdAt: Date.now(),
        metadata: {},
      });

      const result = factoryStorage.read("factory-1");
      expect(result?.content).toBe("Factory created storage");

      factoryStorage.close();
    });
  });

  describe("Error handling", () => {
    it("should handle close gracefully even when called twice", () => {
      expect(() => {
        storage.close();
        storage.close(); // Should not throw
      }).not.toThrow();
    });
  });
});

describe("StorageInterface compliance", () => {
  it("should expose all required methods", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "interface-test-"));
    const filePath = join(tempDir, "interface.mv2");

    const store = createStorage({ filePath });

    // Verify all interface methods exist
    expect(typeof store.write).toBe("function");
    expect(typeof store.read).toBe("function");
    expect(typeof store.search).toBe("function");
    expect(typeof store.stats).toBe("function");
    expect(typeof store.close).toBe("function");

    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });
});
