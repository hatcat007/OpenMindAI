#!/usr/bin/env bun
/**
 * Ask Questions Script
 *
 * Searches memories and provides contextual answers.
 * Usage: node ask.js "<question>"
 */

import { createStorage } from "../storage/sqlite-storage.js";
import { getStoragePath, loadConfig } from "../config.js";
import { resolve } from "node:path";

function printUsage() {
  console.log("Usage: ask <question>");
  console.log("");
  console.log("Examples:");
  console.log('  ask "Why did we choose React?"');
  console.log('  ask "What was the CORS solution?"');
  process.exit(1);
}

function extractKeywords(question: string): string[] {
  // Simple keyword extraction - remove common words and split
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "must", "shall",
    "can", "need", "dare", "ought", "used", "to", "of", "in",
    "for", "on", "with", "at", "by", "from", "as", "into",
    "through", "during", "before", "after", "above", "below",
    "between", "under", "again", "further", "then", "once",
    "here", "there", "when", "where", "why", "how", "all",
    "each", "few", "more", "most", "other", "some", "such",
    "no", "nor", "not", "only", "own", "same", "so", "than",
    "too", "very", "just", "and", "but", "if", "or", "because",
    "until", "while", "what", "which", "who", "whom", "this",
    "that", "these", "those", "am", "it", "its", "we", "our",
    "you", "your", "they", "them", "their", "he", "him", "his",
    "she", "her", "didnt", "doesnt", "dont", "wasnt", "werent",
    "wont", "wouldnt", "couldnt", "shouldnt", "isnt", "arent",
    "hasnt", "havent", "hadnt"
  ]);

  return question
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    printUsage();
  }

  const question = args.join(" ");

  if (!question) {
    printUsage();
  }

  // Find project root
  let projectPath = process.cwd();
  const config = loadConfig(projectPath);
  const storagePath = getStoragePath(projectPath, config);

  // Ensure absolute path
  const absoluteStoragePath = resolve(storagePath);

  // Open storage
  const storage = createStorage({ filePath: absoluteStoragePath });

  try {
    // Extract keywords and search
    const keywords = extractKeywords(question);
    const searchQuery = keywords.join(" ");

    if (!searchQuery) {
      console.log("Please ask a more specific question.");
      return;
    }

    const results = storage.search(searchQuery, 10);

    if (results.length === 0) {
      console.log(`No relevant memories found for: "${question}"`);
      console.log("");
      console.log("Try rephrasing your question or using different keywords.");
      return;
    }

    console.log(`💭 Question: "${question}"`);
    console.log("");
    console.log(`Found ${results.length} relevant memory(s):`);
    console.log("");

    for (let i = 0; i < results.length; i++) {
      const entry = results[i];
      const date = new Date(entry.createdAt).toLocaleString();
      const type = entry.type;
      const content = entry.content;

      console.log(`${i + 1}. [${date}] ${type}`);
      console.log(`   ${content.split("\n").join("\n   ")}`);
      console.log("");
    }
  } finally {
    storage.close();
  }
}

main();
