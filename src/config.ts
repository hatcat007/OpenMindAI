/**
 * Plugin Configuration Module
 *
 * Configuration management for the Opencode Brain plugin.
 * Handles user config loading, defaults merging, and path resolution.
 *
 * Hybrid approach:
 * 1. Reads from opencode.json file directly (not via SDK)
 * 2. Environment variables override file config
 * 3. Sensible defaults for everything else
 *
 * @module config
 */

import { join } from "node:path";
import { mkdirSync, readFileSync } from "node:fs";

/**
 * Plugin configuration options
 */
export interface PluginConfig {
  /** Storage file path (relative to worktree or absolute) */
  storagePath?: string;
  /** Auto-initialize storage on first run (default: true) */
  autoInitialize?: boolean;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<PluginConfig> = {
  storagePath: ".opencode/mind.mv2",
  autoInitialize: true,
  debug: false,
};

/**
 * Load plugin configuration from opencode.json file
 *
 * Merges: defaults < opencode.json < environment variables
 *
 * @param directory - Project directory path
 * @returns Merged configuration with all values populated
 */
export function loadConfig(directory: string): Required<PluginConfig> {
  // 1. Start with defaults
  let config: Required<PluginConfig> = { ...DEFAULT_CONFIG };

  // 2. Override from opencode.json if it exists
  try {
    const configPath = join(directory, "opencode.json");
    const fileContent = readFileSync(configPath, "utf-8");
    const opencodeConfig = JSON.parse(fileContent) as Record<string, unknown>;
    
    // Extract opencode-brain specific config
    const pluginConfig = opencodeConfig["opencode-brain"] as PluginConfig | undefined;
    if (pluginConfig) {
      config = {
        ...config,
        ...pluginConfig,
      };
    }
  } catch {
    // File doesn't exist or is invalid JSON - use defaults
  }

  // 3. Environment variable overrides
  if (process.env.OPENCODE_BRAIN_STORAGE_PATH) {
    config.storagePath = process.env.OPENCODE_BRAIN_STORAGE_PATH;
  }

  if (process.env.OPENCODE_BRAIN_DEBUG) {
    config.debug = process.env.OPENCODE_BRAIN_DEBUG === "true";
  }

  if (process.env.OPENCODE_BRAIN_AUTO_INIT) {
    config.autoInitialize = process.env.OPENCODE_BRAIN_AUTO_INIT !== "false";
  }

  return config;
}

/**
 * Resolve storage path to absolute path
 *
 * If relative path provided, resolves relative to worktree or directory.
 * Ensures parent directory exists.
 *
 * @param worktree - Project worktree path (from Opencode)
 * @param config - Plugin configuration
 * @returns Absolute path to storage file
 *
 * @example
 * ```typescript
 * const path = getStoragePath('/my/project', { storagePath: '.opencode/mind.mv2' });
 * // Returns: '/my/project/.opencode/mind.mv2'
 * ```
 */
export function getStoragePath(worktree: string, config: PluginConfig): string {
  const storagePath = config.storagePath || DEFAULT_CONFIG.storagePath;

  // If already absolute, use as-is
  if (storagePath.startsWith("/")) {
    ensureDirectory(storagePath);
    return storagePath;
  }

  // Resolve relative to worktree
  const absolutePath = join(worktree, storagePath);
  ensureDirectory(absolutePath);

  return absolutePath;
}

/**
 * Ensure parent directory exists for a file path
 *
 * Creates parent directories recursively if missing.
 * Silent fail if directory already exists or can't be created.
 *
 * @param filePath - Path to file (directories will be created)
 *
 * @example
 * ```typescript
 * ensureDirectory('/path/to/file.txt');
 * // Creates /path/to/ if it doesn't exist
 * ```
 */
export function ensureDirectory(filePath: string): void {
  try {
    const parentDir = filePath.includes("/")
      ? filePath.slice(0, filePath.lastIndexOf("/"))
      : ".";

    if (parentDir && parentDir !== ".") {
      mkdirSync(parentDir, { recursive: true });
    }
  } catch (error) {
    // Silent fail - directory may already exist or be created by another process
    // This is non-critical, the database creation will fail later if truly broken
  }
}
