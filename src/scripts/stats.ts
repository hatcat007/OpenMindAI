#!/usr/bin/env node
/**
 * Memvid Mind - Stats Script
 *
 * Get memory statistics using the SDK (no CLI dependency)
 */

import { statSync } from "node:fs";
import { resolve } from "node:path";
import { openMemorySafely } from "./utils";

// Dynamic import for SDK
async function loadSDK() {
  return await import("@memvid/sdk");
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

async function main() {
  // Get memory file path
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const memoryPath = resolve(projectDir, ".claude/mind.mv2");

  // Load SDK dynamically
  const { use, create } = await loadSDK();

  // Open memory safely (handles corrupted files)
  const { memvid, isNew } = await openMemorySafely(memoryPath, use, create);

  if (isNew) {
    console.log("✅ Memory initialized! Stats will appear as you work.\n");
  }

  if (!memvid) {
    // Memory was just created, open it to get stats
    const newMemvid = await use("basic", memoryPath);
    await showStats(newMemvid as any, memoryPath);
    return;
  }

  await showStats(memvid as any, memoryPath);
}

async function showStats(memvid: any, memoryPath: string) {
  try {
    const stats = await memvid.stats();
    const fileStats = statSync(memoryPath);

    console.log("═══════════════════════════════════════");
    console.log("        MEMVID MIND STATISTICS         ");
    console.log("═══════════════════════════════════════\n");

    console.log(`📁 Memory File: ${memoryPath}`);
    console.log(`📊 Total Frames: ${stats.frame_count || 0}`);
    console.log(`💾 File Size: ${formatBytes(fileStats.size)}`);

    if (stats.capacity_bytes && typeof stats.capacity_bytes === "number") {
      const usagePercent = ((fileStats.size / stats.capacity_bytes) * 100).toFixed(1);
      console.log(`📈 Capacity Used: ${usagePercent}%`);
    }

    // Get timeline for recent activity
    try {
      const timeline = await memvid.timeline({ limit: 1, reverse: true });
      const frames = Array.isArray(timeline) ? timeline : timeline.frames || [];
      if (frames.length > 0) {
        const latest = frames[0];
        const latestDate = latest.timestamp
          ? new Date(latest.timestamp * 1000).toLocaleString()
          : "Unknown";
        console.log(`🕐 Latest Memory: ${latestDate}`);
      }
    } catch {
      // Timeline might not be available
    }

    console.log("\n═══════════════════════════════════════");
  } catch (error) {
    console.error("Error getting stats:", error);
    process.exit(1);
  }
}

main();
