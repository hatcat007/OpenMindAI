#!/usr/bin/env bun
/**
 * Statistics Script
 *
 * Shows memory storage statistics.
 * Usage: node stats.js
 */

import { createStorage } from "../storage/sqlite-storage.js";
import { getStoragePath, loadConfig } from "../config.js";
import { resolve } from "node:path";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function main() {
  // Find project root
  let projectPath = process.cwd();
  const config = loadConfig(projectPath);
  const storagePath = getStoragePath(projectPath, config);

  // Ensure absolute path
  const absoluteStoragePath = resolve(storagePath);

  // Open storage
  const storage = createStorage({ filePath: absoluteStoragePath });

  try {
    const stats = storage.stats();

    console.log("📊 Memory Statistics");
    console.log("===================");
    console.log("");
    console.log(`Total memories: ${stats.count}`);
    console.log(`Storage size: ${formatBytes(stats.sizeBytes)}`);
    console.log(`Storage path: ${absoluteStoragePath}`);
    console.log("");

    if (stats.oldestEntry) {
      console.log(`Oldest entry: ${new Date(stats.oldestEntry).toLocaleString()}`);
    }
    if (stats.newestEntry) {
      console.log(`Newest entry: ${new Date(stats.newestEntry).toLocaleString()}`);
    }

    if (Object.keys(stats.byType).length > 0) {
      console.log("");
      console.log("By type:");
      for (const [type, count] of Object.entries(stats.byType)) {
        console.log(`  ${type}: ${count}`);
      }
    }
  } finally {
    storage.close();
  }
}

main();
