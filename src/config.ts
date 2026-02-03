/**
 * Plugin Configuration Module
 *
 * Configuration management for the Opencode Brain plugin.
 * Handles user config loading, defaults merging, and path resolution.
 *
 * @module config
 */

import { join } from "node:path";
import { mkdirSync } from "node:fs";

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
 * Plugin context passed by Opencode
 */
export interface PluginContext {
  /** Project directory */
  directory: string;
  /** Worktree path (if in a git repo) */
  worktree?: string;
  /** Plugin-specific config from opencode.json */
  config?: Record<string, unknown>;
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
 * Load plugin configuration with defaults
 *
 * Merges user-provided config with defaults. Uses this precedence:
 * 1. User-provided config from opencode.json (via ctx.config)
 * 2. Environment variables (OPENCODE_BRAIN_*)
 * 3. Hardcoded defaults
 *
 * @param ctx - Plugin context from Opencode
 * @returns Merged configuration with all values populated
 *
 * @example
 * ```typescript
 * const config = loadConfig({ directory: '/project', config: { debug: true } });
 * // config.debug === true (from user)
 * // config.autoInitialize === true (from defaults)
 * ```
 */
export function loadConfig(ctx: PluginContext): Required<PluginConfig> {
  const userConfig = (ctx.config || {}) as PluginConfig;

  // Environment variable overrides
  const envConfig: Partial<PluginConfig> = {};

  if (process.env.OPENCODE_BRAIN_STORAGE_PATH) {
    envConfig.storagePath = process.env.OPENCODE_BRAIN_STORAGE_PATH;
  }

  if (process.env.OPENCODE_BRAIN_DEBUG) {
    envConfig.debug = process.env.OPENCODE_BRAIN_DEBUG === "true";
  }

  if (process.env.OPENCODE_BRAIN_AUTO_INIT) {
    envConfig.autoInitialize = process.env.OPENCODE_BRAIN_AUTO_INIT !== "false";
  }

  // Merge: defaults < user config < environment
  return {
    storagePath: envConfig.storagePath ?? userConfig.storagePath ?? DEFAULT_CONFIG.storagePath,
    autoInitialize: envConfig.autoInitialize ?? userConfig.autoInitialize ?? DEFAULT_CONFIG.autoInitialize,
    debug: envConfig.debug ?? userConfig.debug ?? DEFAULT_CONFIG.debug,
  };
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
