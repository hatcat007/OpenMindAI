import { defineConfig } from "tsup";

export default defineConfig({
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
});
