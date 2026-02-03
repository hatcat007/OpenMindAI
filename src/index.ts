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

// Event capture modules
export { EventBuffer, createBuffer } from "./events/buffer.js";
export { captureToolExecution } from "./events/tool-capture.js";
export { captureFileEdit } from "./events/file-capture.js";
export { captureSessionError } from "./events/error-capture.js";

export { OpencodeBrainPlugin };
export type { PluginConfig };
export default OpencodeBrainPlugin;
