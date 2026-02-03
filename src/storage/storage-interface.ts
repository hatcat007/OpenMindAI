/**
 * Storage Interface - Bun-compatible SQLite storage layer
 *
 * Abstract storage interface matching @memvid/sdk API surface for future migration.
 * Designed for Bun runtime with synchronous API (bun:sqlite is synchronous).
 */

import type { Observation, ObservationType, ObservationMetadata } from "../types.js";

/**
 * Memory entry for storage - matches @memvid/sdk surface
 */
export interface MemoryEntry {
  /** Unique identifier (UUID) */
  id: string;
  /** Observation type */
  type: ObservationType;
  /** Content text */
  content: string;
  /** Associated metadata */
  metadata: MemoryMetadata;
  /** Creation timestamp (Unix epoch in milliseconds) */
  createdAt: number;
}

/**
 * Extended metadata for storage entries
 */
export interface MemoryMetadata extends ObservationMetadata {
  /** Session identifier */
  sessionId?: string;
  /** Project path */
  projectPath?: string;
  /** Source tool name */
  tool?: string;
  /** Observation summary */
  summary?: string;
}

/**
 * Storage initialization options
 */
export interface StorageOptions {
  /** Path to storage file (e.g., ".opencode/mind.mv2") */
  filePath: string;
  /** Auto-create storage if missing (default: true) */
  create?: boolean;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  /** Total number of entries */
  count: number;
  /** Estimated storage size in bytes */
  sizeBytes: number;
  /** Oldest entry timestamp */
  oldestEntry?: number;
  /** Newest entry timestamp */
  newestEntry?: number;
  /** Count by type */
  byType: Record<string, number>;
}

/**
 * Abstract storage interface
 *
 * CRITICAL: All methods are SYNCHRONOUS - bun:sqlite uses synchronous API.
 * Do NOT use async/await with these methods.
 */
export interface StorageInterface {
  /**
   * Store a memory entry
   * @param id - Unique identifier
   * @param data - Memory entry data
   */
  write(id: string, data: MemoryEntry): void;

  /**
   * Retrieve a memory entry by ID
   * @param id - Unique identifier
   * @returns Memory entry or null if not found
   */
  read(id: string): MemoryEntry | null;

  /**
   * Search memory entries
   * @param query - Search query string
   * @param limit - Maximum results (default: 10)
   * @returns Array of matching entries
   */
  search(query: string, limit?: number): MemoryEntry[];

  /**
   * Get storage statistics
   * @returns Storage statistics
   */
  stats(): StorageStats;

  /**
   * Close storage connection
   */
  close(): void;
}

/**
 * Factory function type for creating storage instances
 */
export type StorageFactory = (options: StorageOptions) => StorageInterface;

/**
 * Convert Observation to MemoryEntry
 */
export function observationToMemoryEntry(
  observation: Observation,
  projectPath?: string
): MemoryEntry {
  return {
    id: observation.id,
    type: observation.type,
    content: observation.content,
    createdAt: observation.timestamp,
    metadata: {
      ...observation.metadata,
      tool: observation.tool,
      summary: observation.summary,
      sessionId: observation.metadata?.sessionId,
      projectPath,
    },
  };
}

/**
 * Convert MemoryEntry to Observation
 */
export function memoryEntryToObservation(entry: MemoryEntry): Observation {
  const { tool, summary, sessionId, projectPath, ...restMetadata } = entry.metadata;

  return {
    id: entry.id,
    timestamp: entry.createdAt,
    type: entry.type,
    tool,
    summary: summary || "",
    content: entry.content,
    metadata: {
      ...restMetadata,
      sessionId,
    },
  };
}
