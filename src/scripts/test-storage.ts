#!/usr/bin/env bun
/**
 * Storage System Integration Test
 *
 * Comprehensive test to verify storage is working correctly.
 * Tests database creation, write operations, read operations,
 * search functionality, and error handling.
 */

import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { BrainStorage } from "../storage/sqlite-storage.js";
import type { MemoryEntry } from "../storage/storage-interface.js";

// Color output helpers
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✓ ${message}`, "green");
}

function error(message: string) {
  log(`✗ ${message}`, "red");
}

function info(message: string) {
  log(`ℹ ${message}`, "blue");
}

function warn(message: string) {
  log(`⚠ ${message}`, "yellow");
}

// Test configuration
const TEST_DB_PATH = process.argv[2] || "./.opencode/test-storage.mv2";

async function runTests() {
  log("\n=== Storage System Integration Test ===\n", "cyan");

  let storage: BrainStorage | null = null;
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Test 1: Directory creation
    info("Test 1: Ensuring storage directory exists...");
    try {
      const dir = dirname(TEST_DB_PATH);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        success(`Created directory: ${dir}`);
      } else {
        success(`Directory exists: ${dir}`);
      }
      testsPassed++;
    } catch (err) {
      error(`Failed to create directory: ${err}`);
      testsFailed++;
      throw err; // Can't continue without directory
    }

    // Test 2: Storage initialization
    info("\nTest 2: Initializing storage...");
    try {
      storage = new BrainStorage(TEST_DB_PATH);
      success(`Storage initialized at: ${TEST_DB_PATH}`);
      testsPassed++;
    } catch (err) {
      error(`Storage initialization failed: ${err}`);
      testsFailed++;
      throw err;
    }

    // Test 3: WAL mode check
    info("\nTest 3: Checking WAL mode...");
    try {
      const walEnabled = storage.isWALModeEnabled();
      if (walEnabled) {
        success("WAL mode is enabled");
        testsPassed++;
      } else {
        warn("WAL mode is not enabled (may impact concurrent access)");
        testsPassed++;
      }
    } catch (err) {
      error(`WAL mode check failed: ${err}`);
      testsFailed++;
    }

    // Test 4: FTS5 availability
    info("\nTest 4: Checking FTS5 availability...");
    try {
      const fts5Available = storage.isFTS5Available();
      if (fts5Available) {
        success("FTS5 full-text search is available");
      } else {
        warn("FTS5 not available (using LIKE fallback - this is normal on macOS)");
      }
      testsPassed++;
    } catch (err) {
      error(`FTS5 check failed: ${err}`);
      testsFailed++;
    }

    // Test 5: Write operation
    info("\nTest 5: Writing test memory entry...");
    try {
      const testEntry: MemoryEntry = {
        id: "test-write-1",
        type: "discovery",
        content: "This is a test memory entry for storage validation",
        createdAt: Date.now(),
        metadata: {
          sessionId: "test-session-123",
          projectPath: "/test/project",
          summary: "Test write operation",
        },
      };

      storage.write(testEntry.id, testEntry);
      success(`Written entry with ID: ${testEntry.id}`);
      testsPassed++;
    } catch (err) {
      error(`Write operation failed: ${err}`);
      testsFailed++;
    }

    // Test 6: Read operation
    info("\nTest 6: Reading test memory entry...");
    try {
      const readEntry = storage.read("test-write-1");
      if (readEntry) {
        success(`Read entry successfully: "${readEntry.content.substring(0, 50)}..."`);
        info(`  - Type: ${readEntry.type}`);
        info(`  - Created: ${new Date(readEntry.createdAt).toISOString()}`);
        info(`  - Session: ${readEntry.metadata?.sessionId}`);
        testsPassed++;
      } else {
        error("Entry not found after write");
        testsFailed++;
      }
    } catch (err) {
      error(`Read operation failed: ${err}`);
      testsFailed++;
    }

    // Test 7: Multiple writes
    info("\nTest 7: Writing multiple entries...");
    try {
      const entries: MemoryEntry[] = [
        {
          id: "test-multi-1",
          type: "decision",
          content: "Decided to use SQLite for storage backend",
          createdAt: Date.now(),
          metadata: { sessionId: "test-session-123" },
        },
        {
          id: "test-multi-2",
          type: "feature",
          content: "Implemented full-text search functionality",
          createdAt: Date.now() + 1000,
          metadata: { sessionId: "test-session-123" },
        },
        {
          id: "test-multi-3",
          type: "refactor",
          content: "Refactored storage layer for better performance",
          createdAt: Date.now() + 2000,
          metadata: { sessionId: "test-session-123" },
        },
      ];

      for (const entry of entries) {
        storage.write(entry.id, entry);
      }
      success(`Written ${entries.length} entries successfully`);
      testsPassed++;
    } catch (err) {
      error(`Multiple write operation failed: ${err}`);
      testsFailed++;
    }

    // Test 8: Search operation
    info("\nTest 8: Testing search functionality...");
    try {
      const searchResults = storage.search("storage", 10);
      success(`Search found ${searchResults.length} matching entries`);
      for (const result of searchResults) {
        info(`  - ${result.type}: ${result.content.substring(0, 60)}...`);
      }
      testsPassed++;
    } catch (err) {
      error(`Search operation failed: ${err}`);
      testsFailed++;
    }

    // Test 9: Statistics
    info("\nTest 9: Checking storage statistics...");
    try {
      const stats = storage.stats();
      success(`Storage statistics:`);
      info(`  - Total memories: ${stats.count}`);
      info(`  - Storage size: ${(stats.sizeBytes / 1024).toFixed(2)} KB`);
      info(`  - By type: ${JSON.stringify(stats.byType, null, 2)}`);
      if (stats.oldestEntry) {
        info(`  - Oldest: ${new Date(stats.oldestEntry).toISOString()}`);
      }
      if (stats.newestEntry) {
        info(`  - Newest: ${new Date(stats.newestEntry).toISOString()}`);
      }
      testsPassed++;
    } catch (err) {
      error(`Stats operation failed: ${err}`);
      testsFailed++;
    }

    // Test 10: Update/Replace
    info("\nTest 10: Testing entry replacement...");
    try {
      const originalEntry = storage.read("test-write-1");
      const updatedEntry: MemoryEntry = {
        id: "test-write-1",
        type: "decision",
        content: "Updated content for test entry",
        createdAt: Date.now(),
        metadata: {
          sessionId: "test-session-123",
          updated: true,
        },
      };

      storage.write(updatedEntry.id, updatedEntry);
      const readUpdated = storage.read("test-write-1");

      if (readUpdated && readUpdated.content === updatedEntry.content) {
        success("Entry replacement successful");
        testsPassed++;
      } else {
        error("Entry replacement failed - content mismatch");
        testsFailed++;
      }
    } catch (err) {
      error(`Replacement operation failed: ${err}`);
      testsFailed++;
    }

    // Test 11: Large content
    info("\nTest 11: Testing large content storage...");
    try {
      const largeContent = "A".repeat(10000); // 10KB of content
      const largeEntry: MemoryEntry = {
        id: "test-large-1",
        type: "discovery",
        content: largeContent,
        createdAt: Date.now(),
        metadata: { sessionId: "test-session-123" },
      };

      storage.write(largeEntry.id, largeEntry);
      const readLarge = storage.read("test-large-1");

      if (readLarge && readLarge.content.length === largeContent.length) {
        success(`Large content stored successfully (${largeContent.length} chars)`);
        testsPassed++;
      } else {
        error("Large content storage failed");
        testsFailed++;
      }
    } catch (err) {
      error(`Large content operation failed: ${err}`);
      testsFailed++;
    }

  } catch (err) {
    error(`\nCritical error during tests: ${err}`);
  } finally {
    // Cleanup
    if (storage) {
      try {
        storage.close();
        success("\nStorage connection closed successfully");
      } catch (err) {
        warn(`Failed to close storage: ${err}`);
      }
    }
  }

  // Summary
  log("\n=== Test Summary ===\n", "cyan");
  log(`Total tests: ${testsPassed + testsFailed}`, "cyan");
  success(`Passed: ${testsPassed}`);
  if (testsFailed > 0) {
    error(`Failed: ${testsFailed}`);
  } else {
    log(`Failed: ${testsFailed}`, "green");
  }

  const successRate = ((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1);
  log(`\nSuccess rate: ${successRate}%\n`, successRate === "100.0" ? "green" : "yellow");

  // Exit with appropriate code
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((err) => {
  error(`\nUnhandled error: ${err}`);
  process.exit(1);
});
