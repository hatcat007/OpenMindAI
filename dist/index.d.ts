import { Plugin } from '@opencode-ai/plugin';

/**
 * Opencode Brain Plugin Implementation
 *
 * Core plugin logic using @opencode-ai/plugin SDK.
 * Handles session lifecycle, event capture, and storage management.
 *
 * **CRITICAL IMPLEMENTATION NOTES:**
 *
 * 1. **Context Destructuring Pattern**
 *    The plugin receives a context object with destructured params.
 *    CORRECT: `async ({ client, directory, worktree }) => { ... }`
 *
 * 2. **Synchronous Storage**
 *    bun:sqlite uses SYNCHRONOUS API. No await needed for storage.
 *    CORRECT: `const storage = createStorage({ filePath }); storage.write(...)`
 *    WRONG: `await createStorage(...)` or `await storage.write(...)`
 *
 * 3. **Event Handler Patterns**
 *    - Use `session.created` for session start
 *    - Use `session.deleted` for cleanup (NOT session.idle)
 *    - Use `tool.execute.after` for post-tool capture
 *    - Always handle errors gracefully (never throw)
 *
 * 4. **Error Handling**
 *    Never throw from event handlers - log and continue gracefully.
 *
 * @module plugin
 */

/**
 * Opencode Brain Plugin - Makes Opencode remember everything
 *
 * This plugin captures session context and makes it available across sessions.
 * It initializes storage on load, captures events during the session, and
 * cleans up gracefully when the session ends.
 *
 * @example
 * ```typescript
 * // In opencode.json:
 * {
 *   "plugin": ["opencode-brain"],
 *   "opencode-brain": {
 *     "storagePath": ".opencode/mind.mv2",
 *     "debug": false
 *   }
 * }
 * ```
 */
declare const OpencodeBrainPlugin: Plugin;

/**
 * Plugin Configuration Module
 *
 * Configuration management for the Opencode Brain plugin.
 * Handles user config loading, defaults merging, and path resolution.
 *
 * @module config
 */
/**
 * Plugin configuration options
 */
interface PluginConfig {
    /** Storage file path (relative to worktree or absolute) */
    storagePath?: string;
    /** Auto-initialize storage on first run (default: true) */
    autoInitialize?: boolean;
    /** Enable debug logging (default: false) */
    debug?: boolean;
}

/**
 * Opencode Brain Plugin
 *
 * Memory persistence for Opencode - remember everything across sessions.
 *
 * @packageDocumentation
 */

export { OpencodeBrainPlugin, type PluginConfig, OpencodeBrainPlugin as default };
