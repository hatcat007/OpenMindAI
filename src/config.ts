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
import { mkdirSync, readFileSync, accessSync, constants, statSync } from "node:fs";

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
 * Throws detailed error if creation fails (not just EEXIST).
 *
 * @param filePath - Path to file (directories will be created)
 * @throws Error if directory creation fails due to permissions or other issues
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
      console.log(`[opencode-brain] Creating directory: ${parentDir}`);
      mkdirSync(parentDir, { recursive: true });
      console.log(`[opencode-brain] Directory ready: ${parentDir}`);
    }
  } catch (error) {
    // Only silently ignore EEXIST (directory already exists)
    // Re-throw all other errors (permissions, disk full, etc.)
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code?: string }).code;
      if (code === 'EEXIST') {
        console.log(`[opencode-brain] Directory already exists: ${filePath.slice(0, filePath.lastIndexOf("/"))}`);
        return;
      }
    }

    // Log detailed error information
    console.error(`[opencode-brain] CRITICAL: Failed to create directory for ${filePath}`);
    console.error(`[opencode-brain] Error details:`, error);

    // Re-throw with helpful context
    throw new Error(
      `Cannot create storage directory: ${error instanceof Error ? error.message : String(error)}. ` +
      `Path: ${filePath}. Check permissions and disk space.`
    );
  }
}

/**
 * Validation result for storage path pre-flight check
 */
export interface StorageValidation {
  /** Whether the storage path is valid and ready */
  valid: boolean;
  /** Detailed validation messages */
  messages: string[];
  /** Error message if validation failed */
  error?: string;
}

/**
 * Pre-flight validation for storage path
 *
 * Checks that:
 * 1. Parent directory exists or can be created
 * 2. Parent directory is writable
 * 3. Storage file doesn't exist as a directory
 * 4. Path doesn't contain problematic characters
 *
 * @param filePath - Absolute path to storage file
 * @returns Validation result with detailed messages
 *
 * @example
 * ```typescript
 * const validation = validateStoragePath('/path/to/mind.mv2');
 * if (!validation.valid) {
 *   console.error('Storage path invalid:', validation.error);
 *   for (const msg of validation.messages) {
 *     console.log(msg);
 *   }
 * }
 * ```
 */
export function validateStoragePath(filePath: string): StorageValidation {
  const messages: string[] = [];

  try {
    // Check 1: Path shouldn't be empty
    if (!filePath || filePath.trim() === "") {
      return {
        valid: false,
        messages: ["Storage path is empty"],
        error: "Empty storage path provided"
      };
    }

    messages.push(`✓ Storage path specified: ${filePath}`);

    // Check 2: Warn about spaces in path (can cause issues)
    if (filePath.includes(" ")) {
      messages.push(`⚠ Warning: Path contains spaces, which may cause issues: ${filePath}`);
    }

    // Check 3: Extract parent directory
    const parentDir = filePath.slice(0, filePath.lastIndexOf("/"));
    if (!parentDir || parentDir === "") {
      return {
        valid: false,
        messages: [...messages, "Cannot determine parent directory"],
        error: "Invalid file path format"
      };
    }

    messages.push(`✓ Parent directory: ${parentDir}`);

    // Check 4: Ensure parent directory exists
    try {
      mkdirSync(parentDir, { recursive: true });
      messages.push(`✓ Parent directory exists/created: ${parentDir}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        messages: [...messages, `✗ Cannot create parent directory: ${errorMsg}`],
        error: `Failed to create directory: ${errorMsg}`
      };
    }

    // Check 5: Verify directory is writable
    try {
      accessSync(parentDir, constants.W_OK | constants.R_OK);
      messages.push(`✓ Parent directory is readable and writable`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        messages: [...messages, `✗ Parent directory not writable: ${errorMsg}`],
        error: `Permission denied: ${errorMsg}`
      };
    }

    // Check 6: If file exists, ensure it's not a directory
    try {
      const stats = statSync(filePath);
      if (stats.isDirectory()) {
        return {
          valid: false,
          messages: [...messages, `✗ Storage path is a directory, not a file: ${filePath}`],
          error: "Storage path points to a directory"
        };
      }
      messages.push(`✓ Storage file exists (${(stats.size / 1024).toFixed(2)} KB)`);
    } catch (error) {
      // File doesn't exist - this is OK
      if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as { code?: string }).code;
        if (code === 'ENOENT') {
          messages.push(`✓ Storage file will be created (doesn't exist yet)`);
        } else {
          messages.push(`⚠ Cannot stat file: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // All checks passed
    return {
      valid: true,
      messages
    };

  } catch (error) {
    return {
      valid: false,
      messages: [...messages, `✗ Unexpected error: ${error instanceof Error ? error.message : String(error)}`],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
