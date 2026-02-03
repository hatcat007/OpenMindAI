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
    "bun:sqlite",           // Built-in Bun module
    "bun:test"              // Built-in test module
  ],
  esbuildOptions(options) {
    options.banner = {
      js: "#!/usr/bin/env bun",
    };
  }
});
