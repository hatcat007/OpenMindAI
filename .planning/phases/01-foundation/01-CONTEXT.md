# Phase 1: Foundation — Context

**Created:** 2025-02-03  
**Phase:** 1 — Foundation  
**Goal:** Establish core storage and plugin architecture

---

## Decisions (LOCKED — Do Not Revisit)

These decisions were made during project initialization and must be implemented as specified.

### Storage
1. **SQLite-based storage layer** — MUST implement due to @memvid/sdk Bun incompatibility
2. **Storage location:** `.opencode/mind.mv2` (follows Opencode conventions)
3. **Single-file storage** — All data in one SQLite file, not multiple files
4. **Bun-compatible file locking** — Must work with Bun runtime, not Node.js-specific

### Plugin Architecture
1. **Native Opencode plugin** — NOT an adapter from Claude Code hooks
2. **@opencode-ai/plugin SDK** — Use official Opencode plugin API
3. **TypeScript/Bun** — Bun runtime with native TypeScript support
4. **NPM distribution** — Package name: `opencode-brain`

### Installation
1. **One-command install:** `npm install opencode-brain`
2. **Zero configuration** — Works out of the box after adding to `opencode.json`
3. **Auto-initialization** — Creates `mind.mv2` on first run if missing

---

## Claude's Discretion (Implementation Freedom)

Within the locked decisions above, you have freedom to choose:

### Storage Implementation
- SQLite schema design (tables, indices)
- File locking mechanism (Bun.lock or custom implementation)
- Write buffering strategy (in-memory, periodic flush)
- Compression approach (zlib, brotli, etc.)

### Plugin Structure
- Event handler organization (single file vs split by event type)
- Error handling patterns (silent fail vs logging)
- Configuration options (minimal vs feature-rich)

### NPM Package
- Build toolchain (tsup, rollup, or Bun.build)
- Test framework (Vitest, Bun.test, or other)
- Package structure (flat vs nested)

---

## Deferred Ideas (Out of Scope)

These features are explicitly out of scope for Phase 1:

- Migration from claude-brain (Phase 4)
- Advanced compression (Phase 5)
- Memory reset command (Phase 4)
- Context injection (Phase 3)
- Event capture (Phase 2)
- Custom commands/tools (Phase 4)

---

## Critical Constraint

**@memvid/sdk is NOT compatible with Bun.** Do NOT attempt to use it. The storage layer must be implemented from scratch using SQLite with Bun APIs.

**Required API Surface:** The storage layer should provide these methods for future migration compatibility:
- `create(options)` — Initialize storage
- `write(id, data)` — Store memory entry
- `read(id)` — Retrieve memory entry
- `search(query)` — Full-text search
- `close()` — Clean shutdown

---

## Success Criteria

Phase 1 is complete when:
1. ✓ Plugin loads without errors in Opencode
2. ✓ `mind.mv2` created automatically on first run
3. ✓ Can write and read from storage layer
4. ✓ Works with Bun runtime
5. ✓ Storage API matches @memvid/sdk surface (for future migration)

---

*Context created for /gsd-plan-phase workflow*
