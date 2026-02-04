#!/usr/bin/env bun
/**
 * Timeline Script
 *
 * Shows recent memories in reverse chronological order.
 * Usage: node timeline.js [count]
 */

import { Database } from "bun:sqlite";
import { getStoragePath, loadConfig } from "../config.js";
import { resolve } from "node:path";

interface MemoryRow {
  id: string;
  type: string;
  content: string;
  metadata: string;
  created_at: number;
}

function main() {
  const args = process.argv.slice(2);
  const count = args[0] ? parseInt(args[0], 10) : 20;

  // Find project root
  let projectPath = process.cwd();
  const config = loadConfig(projectPath);
  const storagePath = getStoragePath(projectPath, config);

  // Ensure absolute path
  const absoluteStoragePath = resolve(storagePath);

  // Open database directly for custom query (readwrite mode required)
  const db = new Database(absoluteStoragePath, { create: false, readwrite: true });

  try {
    const stmt = db.prepare(`
      SELECT id, type, content, metadata, created_at
      FROM memories
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(count) as MemoryRow[];
    stmt.finalize();

    if (rows.length === 0) {
      console.log("No memories found.");
      return;
    }

    console.log(`📜 Recent Memories (showing ${rows.length})`);
    console.log("=====================================");
    console.log("");

    for (const row of rows) {
      const date = new Date(row.created_at).toLocaleString();
      const type = row.type;
      const content = row.content.length > 150
        ? row.content.slice(0, 150) + "..."
        : row.content;

      console.log(`[${date}] ${type}`);
      console.log(content);
      console.log("");
    }
  } finally {
    db.close();
  }
}

main();
