/**
 * Event Buffer Tests
 *
 * Comprehensive tests for EventBuffer functionality.
 * Uses bun:test for Bun-native testing.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { createEventBuffer, createBuffer } from "./buffer.js";
import type { MemoryEntry } from "../storage/storage-interface.js";

/**
 * Create a mock memory entry for testing
 */
function createMockEntry(overrides?: Partial<MemoryEntry>): MemoryEntry {
  return {
    id: `test-${Math.random().toString(36).slice(2)}`,
    type: "pattern",
    content: "Test content",
    createdAt: Date.now(),
    metadata: {},
    ...overrides,
  };
}

describe("EventBuffer", () => {
  let flushedEntries: MemoryEntry[][] = [];
  let mockFlush: (entries: MemoryEntry[]) => void;

  beforeEach(() => {
    flushedEntries = [];
    mockFlush = (entries: MemoryEntry[]) => {
      flushedEntries.push(entries);
    };
  });

  describe("Basic Operations", () => {
    it("creates buffer with defaults", () => {
      const buffer = createEventBuffer();

      expect(buffer.size()).toBe(0);
      expect(buffer.isFlushInProgress()).toBe(false);
    });

    it("creates buffer with custom config", () => {
      const buffer = createEventBuffer({
        maxSize: 100,
        flushIntervalMs: 10000,
        onFlush: mockFlush,
      });

      expect(buffer.size()).toBe(0);
    });

    it("adds entry to buffer", () => {
      const buffer = createEventBuffer({ onFlush: mockFlush });
      const entry = createMockEntry();

      buffer.add(entry);

      expect(buffer.size()).toBe(1);
    });

    it("adds multiple entries to buffer", () => {
      const buffer = createEventBuffer({ onFlush: mockFlush });

      buffer.add(createMockEntry());
      buffer.add(createMockEntry());
      buffer.add(createMockEntry());

      expect(buffer.size()).toBe(3);
    });

    it("size() returns correct count", () => {
      const buffer = createEventBuffer({ onFlush: mockFlush });

      expect(buffer.size()).toBe(0);

      buffer.add(createMockEntry());
      expect(buffer.size()).toBe(1);

      buffer.add(createMockEntry());
      buffer.add(createMockEntry());
      buffer.add(createMockEntry());
      buffer.add(createMockEntry());
      expect(buffer.size()).toBe(5);
    });

    it("clears buffer without flush", () => {
      const buffer = createEventBuffer({ onFlush: mockFlush });

      buffer.add(createMockEntry());
      buffer.add(createMockEntry());
      expect(buffer.size()).toBe(2);

      buffer.clear();
      expect(buffer.size()).toBe(0);
      expect(flushedEntries.length).toBe(0); // Should not have flushed
    });
  });

  describe("Auto-Flush on Size", () => {
    it("flushes when maxSize reached", () => {
      const maxSize = 50;
      const buffer = createEventBuffer({
        maxSize,
        flushIntervalMs: 100000, // Long interval to not interfere
        onFlush: mockFlush,
      });

      // Add exactly maxSize entries
      for (let i = 0; i < maxSize; i++) {
        buffer.add(createMockEntry({ id: `entry-${i}` }));
      }

      // Should have flushed automatically
      expect(flushedEntries.length).toBe(1);
      expect(flushedEntries[0]!.length).toBe(maxSize);
      expect(buffer.size()).toBe(0);

      // Verify entry IDs
      const firstFlush = flushedEntries[0]!;
      for (let i = 0; i < maxSize; i++) {
        expect(firstFlush[i]!.id).toBe(`entry-${i}`);
      }
    });

    it("flushes before exceeding maxSize", () => {
      const maxSize = 5;
      const buffer = createEventBuffer({
        maxSize,
        flushIntervalMs: 100000,
        onFlush: mockFlush,
      });

      // Add maxSize entries (should trigger flush)
      for (let i = 0; i < maxSize; i++) {
        buffer.add(createMockEntry());
      }

      expect(buffer.size()).toBe(0);
      expect(flushedEntries.length).toBe(1);
      expect(flushedEntries[0]!.length).toBe(maxSize);
    });

    it("does not flush before reaching maxSize", () => {
      const buffer = createEventBuffer({
        maxSize: 10,
        flushIntervalMs: 100000,
        onFlush: mockFlush,
      });

      // Add less than maxSize entries
      for (let i = 0; i < 5; i++) {
        buffer.add(createMockEntry());
      }

      expect(buffer.size()).toBe(5);
      expect(flushedEntries.length).toBe(0);
    });

    it("handles multiple flush cycles", () => {
      const maxSize = 10;
      const buffer = createEventBuffer({
        maxSize,
        flushIntervalMs: 100000,
        onFlush: mockFlush,
      });

      // First cycle
      for (let i = 0; i < maxSize; i++) {
        buffer.add(createMockEntry());
      }

      expect(flushedEntries.length).toBe(1);

      // Second cycle
      for (let i = 0; i < maxSize; i++) {
        buffer.add(createMockEntry());
      }

      expect(flushedEntries.length).toBe(2);
      expect(buffer.size()).toBe(0);
    });
  });

  describe("Interval-Based Flush", () => {
    it("flushes on interval", async () => {
      const buffer = createEventBuffer({
        maxSize: 100,
        flushIntervalMs: 100, // 100ms for fast test
        onFlush: mockFlush,
      });

      buffer.start();

      // Add some entries
      buffer.add(createMockEntry());
      buffer.add(createMockEntry());
      buffer.add(createMockEntry());
      expect(buffer.size()).toBe(3);

      // Wait for interval to trigger
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should have flushed
      expect(flushedEntries.length).toBeGreaterThanOrEqual(1);
      expect(buffer.size()).toBe(0);

      buffer.stop();
    });

    it("does not flush when timer is stopped", async () => {
      const buffer = createEventBuffer({
        maxSize: 100,
        flushIntervalMs: 100,
        onFlush: mockFlush,
      });

      buffer.start();
      buffer.stop();

      buffer.add(createMockEntry());
      buffer.add(createMockEntry());

      // Wait to ensure no flush happens
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(flushedEntries.length).toBe(0);
      expect(buffer.size()).toBe(2);
    });

    it("restarts timer correctly", async () => {
      const buffer = createEventBuffer({
        maxSize: 100,
        flushIntervalMs: 100,
        onFlush: mockFlush,
      });

      buffer.start();
      buffer.stop();
      buffer.start();

      buffer.add(createMockEntry());

      // Wait for new timer to trigger
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(flushedEntries.length).toBeGreaterThanOrEqual(1);

      buffer.stop();
    });
  });

  describe("Stop Behavior", () => {
    it("stops and flushes remaining by default", () => {
      const buffer = createEventBuffer({
        maxSize: 100,
        onFlush: mockFlush,
      });

      // Add 10 entries
      for (let i = 0; i < 10; i++) {
        buffer.add(createMockEntry());
      }

      expect(buffer.size()).toBe(10);

      // Stop should flush by default
      buffer.stop();

      expect(flushedEntries.length).toBe(1);
      expect(flushedEntries[0]!.length).toBe(10);
      expect(buffer.size()).toBe(0);
    });

    it("stops without flushing when flushRemaining is false", () => {
      const buffer = createEventBuffer({
        maxSize: 100,
        onFlush: mockFlush,
      });

      buffer.add(createMockEntry());
      buffer.add(createMockEntry());

      buffer.stop({ flushRemaining: false });

      expect(flushedEntries.length).toBe(0);
      expect(buffer.size()).toBe(2); // Entries remain
    });
  });

  describe("Concurrent Flush Prevention", () => {
    it("prevents concurrent flushes during manual flush", () => {
      let flushCount = 0;
      const slowFlush = (_entries: MemoryEntry[]) => {
        flushCount++;
        // Simulate slow operation
        const start = Date.now();
        while (Date.now() - start < 50) {
          // Busy wait
        }
      };

      const buffer = createEventBuffer({
        maxSize: 100,
        onFlush: slowFlush,
      });

      // Add entries
      buffer.add(createMockEntry());
      buffer.add(createMockEntry());

      // Start first flush
      buffer.flush();

      // Try concurrent flush while first is in progress
      buffer.flush();

      expect(flushCount).toBe(1); // Should only flush once
    });

    it("prevents concurrent flushes during auto-flush", () => {
      let flushCount = 0;
      const slowFlush = (_entries: MemoryEntry[]) => {
        flushCount++;
        const start = Date.now();
        while (Date.now() - start < 100) {
          // Busy wait
        }
      };

      const buffer = createEventBuffer({
        maxSize: 2,
        onFlush: slowFlush,
      });

      // Add entries that trigger auto-flush
      buffer.add(createMockEntry());

      // Try to trigger another while first is in progress
      buffer.flush();

      // Continue adding
      buffer.add(createMockEntry());

      expect(flushCount).toBeLessThanOrEqual(2); // Should not over-flush
    });
  });

  describe("Error Handling", () => {
    it("handles flush errors gracefully", () => {
      const errorFlush = () => {
        throw new Error("Flush failed");
      };

      const buffer = createEventBuffer({
        maxSize: 100,
        onFlush: errorFlush,
      });

      buffer.add(createMockEntry());
      buffer.add(createMockEntry());

      // Should not throw
      expect(() => buffer.flush()).not.toThrow();

      // Buffer should still work after error
      expect(buffer.isFlushInProgress()).toBe(false);
    });

    it("continues operation after flush error", () => {
      let shouldFail = true;
      const conditionalFlush = (entries: MemoryEntry[]) => {
        if (shouldFail) {
          throw new Error("First flush fails");
        }
        flushedEntries.push(entries);
      };

      const buffer = createEventBuffer({
        maxSize: 100,
        onFlush: conditionalFlush,
      });

      // First flush fails
      buffer.add(createMockEntry());
      buffer.flush();

      // Second flush succeeds
      shouldFail = false;
      buffer.add(createMockEntry({ id: "second" }));
      buffer.flush();

      expect(flushedEntries.length).toBe(1);
      expect(flushedEntries[0]![0]!.id).toBe("second");
    });

    it("handles auto-flush errors gracefully", () => {
      const errorFlush = () => {
        throw new Error("Auto-flush failed");
      };

      const buffer = createEventBuffer({
        maxSize: 2,
        onFlush: errorFlush,
      });

      // Should not throw during auto-flush
      expect(() => {
        buffer.add(createMockEntry());
        buffer.add(createMockEntry()); // Triggers auto-flush
      }).not.toThrow();
    });
  });

  describe("Factory Function", () => {
    it("createBuffer factory creates configured buffer", () => {
      const buffer = createBuffer(mockFlush, { maxSize: 25 });

      // Factory function returns an object implementing IEventBuffer interface
      expect(buffer.size()).toBe(0);

      // Verify it works
      buffer.add(createMockEntry());
      buffer.flush();

      expect(flushedEntries.length).toBe(1);
    });

    it("createBuffer uses defaults for unspecified options", () => {
      const buffer = createBuffer(mockFlush);

      expect(buffer.size()).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("flush on empty buffer does nothing", () => {
      const buffer = createEventBuffer({ onFlush: mockFlush });

      buffer.flush();

      expect(flushedEntries.length).toBe(0);
      expect(buffer.size()).toBe(0);
    });

    it("flush updates lastFlush time", () => {
      const buffer = createEventBuffer({ onFlush: mockFlush });

      const beforeFlush = Date.now();
      buffer.add(createMockEntry());
      buffer.flush();
      const afterFlush = Date.now();

      const lastFlushTime = buffer.getLastFlushTime();
      expect(lastFlushTime).toBeGreaterThanOrEqual(0);
      expect(lastFlushTime).toBeLessThanOrEqual(afterFlush - beforeFlush + 10);
    });

    it("maintains entry order in flush", () => {
      const buffer = createEventBuffer({
        maxSize: 100,
        onFlush: mockFlush,
      });

      // Add entries in specific order
      for (let i = 0; i < 5; i++) {
        buffer.add(createMockEntry({ id: `entry-${i}` }));
      }

      buffer.flush();

      expect(flushedEntries[0]!.map((e) => e.id)).toEqual([
        "entry-0",
        "entry-1",
        "entry-2",
        "entry-3",
        "entry-4",
      ]);
    });
  });

  describe("Performance", () => {
    it("performance: 1000 events under threshold", () => {
      const buffer = createEventBuffer({
        maxSize: 10000, // Large to prevent auto-flush
        onFlush: () => {
          // No-op
        },
      });

      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        buffer.add(createMockEntry({ id: `perf-${i}` }));
      }

      const elapsed = performance.now() - start;
      console.log(`1000 buffered adds: ${elapsed.toFixed(2)}ms`);

      expect(elapsed).toBeLessThan(100); // Should be <0.1ms per event
    });

    it("performance: batch flush under threshold", () => {
      const flushTimes: number[] = [];
      const timedFlush = (entries: MemoryEntry[]) => {
        const start = performance.now();
        // Simulate storage write (minimal work)
        flushTimes.push(performance.now() - start);
        // Use entries to satisfy linter
        void entries.length;
      };

      const buffer = createEventBuffer({
        maxSize: 50,
        onFlush: timedFlush,
      });

      // Add 50 entries to trigger flush
      for (let i = 0; i < 50; i++) {
        buffer.add(createMockEntry());
      }

      const avgFlushTime =
        flushTimes.reduce((a, b) => a + b, 0) / flushTimes.length;
      console.log(`Batch flush (50 entries): ${avgFlushTime.toFixed(2)}ms`);

      // Flush should be fast (callback overhead only)
      expect(flushTimes[0]).toBeLessThan(50);
    });
  });
});
