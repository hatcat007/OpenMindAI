#!/usr/bin/env node
/**
 * Memvid Mind - Ask Script
 *
 * Ask questions about memories using the SDK (no CLI dependency)
 */

import { resolve } from "node:path";
import { openMemorySafely } from "./utils";

// Dynamic import for SDK
async function loadSDK() {
  return await import("@memvid/sdk");
}

async function main() {
  const args = process.argv.slice(2);
  const question = args.join(" ");

  if (!question) {
    console.error("Usage: ask.js <question>");
    process.exit(1);
  }

  // Get memory file path
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const memoryPath = resolve(projectDir, ".claude/mind.mv2");

  // Load SDK dynamically
  const { use, create } = await loadSDK();

  // Open memory safely (handles corrupted files)
  const { memvid, isNew } = await openMemorySafely(memoryPath, use, create);

  if (isNew || !memvid) {
    console.log("✅ Memory initialized! No memories to ask about yet.\n");
    process.exit(0);
  }

  try {
    const mv = memvid as any;
    const result = await mv.ask(question, { k: 5, mode: "lex" });

    if (result.answer) {
      console.log("Answer:", result.answer);
    } else {
      // Fall back to search if ask doesn't return answer
      const searchResults = await mv.find(question, { k: 5, mode: "lex" });

      if (!searchResults.hits || searchResults.hits.length === 0) {
        console.log("No relevant memories found for your question.");
        process.exit(0);
      }

      console.log("Relevant memories:\n");
      for (const hit of searchResults.hits) {
        const title = hit.title || "Untitled";
        const snippet = (hit.snippet || "").slice(0, 300).replace(/\n/g, " ");
        console.log(`• ${title}`);
        console.log(`  ${snippet}${snippet.length >= 300 ? "..." : ""}\n`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
