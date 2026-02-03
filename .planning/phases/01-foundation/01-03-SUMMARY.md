---
phase: 01-foundation
plan: 03
depends_on: []
wave: 1
files_modified:
  - package.json
  - tsconfig.json
  - tsup.config.ts
  - .gitignore
  - README.md
  - bunfig.toml
autonomous: true
status: complete
started: 2025-02-03
completed: 2025-02-03
---

# Plan 01-03 Summary: NPM Package Structure

## Delivered

### Package Configuration (`package.json`)
- Name: `opencode-brain`
- Version: `0.1.0`
- ESM-only (`"type": "module"`)
- Exports: `dist/index.js` + types
- Scripts: build, dev, test, typecheck, lint
- Bun engine requirement (`>=1.0.0`)
- Peer dependency: `@opencode-ai/plugin >=1.0.0`
- No @memvid/sdk (replaced with bun:sqlite)

### TypeScript Configuration (`tsconfig.json`)
- Bun-optimized settings:
  - `module: "Preserve"` - Let Bun handle resolution
  - `allowImportingTsExtensions: true` - Import .ts directly
  - `verbatimModuleSyntax: true` - ESM unchanged
  - `types: ["bun-types"]` - Bun type definitions
- Strict mode enabled
- Source maps and declarations

### Build Configuration (`tsup.config.ts`)
- Entry: `src/index.ts`
- Format: ESM only
- External: @opencode-ai/plugin, bun:sqlite, bun:test
- Source maps, declarations, bundling
- Banner: `#!/usr/bin/env bun`

### Git Ignore (`.gitignore`)
- node_modules/, dist/, .DS_Store
- SQLite files: mind.mv2, .lock, .shm, .wal
- Environment files: .env, .env.local
- Coverage, logs, tmp files

### Bun Configuration (`bunfig.toml`)
- Text-based lockfile: `bun.lock`
- Human-readable dependency locking

### Documentation (`README.md`)
- Features list with emoji indicators
- Installation instructions (npm + opencode.json)
- Quick start guide
- Commands documentation (/mind stats, search, ask, etc.)
- Configuration options table
- Storage location and .gitignore instructions
- Privacy & security section
- Architecture overview
- Development setup
- Migration from claude-brain
- Troubleshooting guide

## Key Design Decisions

1. **Bun-First**: Bun as primary engine, not Node.js
2. **ESM-Only**: No CommonJS support needed (Bun has excellent ESM)
3. **bun:test**: Built-in test runner (no Jest/Vitest dependency)
4. **Peer Dependency**: @opencode-ai/plugin provided by Opencode
5. **bun:sqlite**: Built-in SQLite (zero npm dependencies for storage)

## Package Exports

```typescript
// Default export (for Opencode)
export default OpencodeBrainPlugin;

// Named exports (for advanced users)
export { OpencodeBrainPlugin, PluginConfig };
```

## Verification

✅ Package structure complete:
- package.json valid
- tsconfig.json uses Bun-optimized settings
- tsup.config.ts externalizes peer dependencies
- .gitignore excludes SQLite files
- README.md comprehensive (226 lines)

## Deviations
- Removed proper-lockfile from dependencies (not needed with WAL mode)
- Simplified bunfig.toml (removed test section causing parse errors)

## Next Steps
- Phase 2: Add event capture implementation
- Phase 3: Add context injection
- Phase 4: Implement /mind commands
- Phase 5: Add compression and optimization
- Ready for npm publish after Phase 5
