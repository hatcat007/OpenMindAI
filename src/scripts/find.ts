#!/usr/bin/env bun
/**
 * Find/Search Memories Script
 *
 * Searches through stored memories using full-text search.
 * Usage: node find.js "<query>" [limit]
 */

import { createStorage } from "../storage/sqlite-storage.js";
import { getStoragePath, loadConfig } from "../config.js";
import { resolve } from "node:path";

function printUsage() {
  console.log("Usage: find <query> [limit]");
  console.log("");
  console.log("Examples:");
  console.log('  find "authentication" 5');
  console.log('  find "database schema" 10');
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    printUsage();
  }

  const query = args[0];
  const limit = args[1] ? parseInt(args[1], 10) : 10;

  if (!query) {
    printUsage();
  }

  // Find project root (look for .opencode directory or .git)
  let projectPath = process.cwd();
  const config = loadConfig(projectPath);
  const storagePath = getStoragePath(projectPath, config);

  // Ensure absolute path
  const absoluteStoragePath = resolve(storagePath);

  // Open storage
  const storage = createStorage({ filePath: absoluteStoragePath });

  try {
    const results = storage.search(query, limit);

    if (results.length === 0) {
      console.log(`No memories found for: "${query}"`);
      return;
    }

    console.log(`Found ${results.length} memory(s) for: "${query}"`);
    console.log("");

    for (const entry of results) {
      const date = new Date(entry.createdAt).toLocaleString();
      const type = entry.type;
      const content = entry.content.length > 200
        ? entry.content.slice(0, 200) + "..."
        : entry.content;

      console.log(`[${date}] ${type}`);
      console.log(content);
      console.log("");
    }
  } finally {
    storage.close();
  }
}

main();
