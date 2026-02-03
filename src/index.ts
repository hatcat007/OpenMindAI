/**
 * Opencode Brain Plugin
 *
 * Memory persistence for Opencode - remember everything across sessions.
 *
 * @packageDocumentation
 */

import { OpencodeBrainPlugin } from "./plugin.js";
import type { PluginConfig } from "./config.js";

// Privacy filtering functions
export {
  sanitizeContent,
  shouldCaptureFile,
  sanitizeBashCommand,
  isSensitiveContent,
  sanitizeObject,
  getExclusionReasons,
} from "./privacy/filter.js";

export { OpencodeBrainPlugin };
export type { PluginConfig };
export default OpencodeBrainPlugin;
