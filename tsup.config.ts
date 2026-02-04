import { defineConfig } from "tsup";

export default defineConfig([
  // Main plugin entry point
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    target: "esnext",
    platform: "node",
    bundle: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    dts: true,
    external: [
      "@opencode-ai/plugin",  // Peer dependency
      "@opencode-ai/sdk",     // Peer dependency
      "bun:sqlite",           // Built-in Bun module
      "bun:test",             // Built-in test module
      "node:*",               // All Node.js built-ins with node: prefix
    ],
    esbuildOptions(options) {
      options.banner = {
        js: "#!/usr/bin/env bun",
      };
      // Prevent esbuild from transforming node: imports
      options.packages = "external";
    }
  },
  // CLI scripts
  {
    entry: [
      "src/scripts/find.ts",
      "src/scripts/ask.ts",
      "src/scripts/stats.ts",
      "src/scripts/timeline.ts",
    ],
    format: ["esm"],
    target: "esnext",
    platform: "node",
    bundle: true,
    splitting: false,
    sourcemap: true,
    clean: false,  // Don't clean, main build already did
    dts: false,
    outDir: "dist/scripts",
    external: [
      "@opencode-ai/plugin",
      "@opencode-ai/sdk",
      "bun:sqlite",
      "bun:test",
      "node:*",
    ],
    esbuildOptions(options) {
      // No shebang for scripts - they're run via node
      options.packages = "external";
    }
  }
]);
