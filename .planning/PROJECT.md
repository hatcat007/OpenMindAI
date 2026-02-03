# Opencode Brain

## What This Is

A memory persistence plugin for Opencode that gives it photographic memory across sessions. Just like claude-brain does for Claude Code, opencode-brain remembers context, decisions, bugs, and solutions from previous sessions.

Opencode currently starts each session with no memory of past work. This plugin captures session context automatically and injects it into new sessions, allowing Opencode to answer questions like "What did we decide about authentication?" or "Why did we choose this architecture?"

## Core Value

**Make Opencode remember everything across sessions without user effort.**

Everything else can be sacrificed, but this must work: users should be able to resume work days later and Opencode immediately knows the full context.

## Requirements

### Validated

(Existing claude-brain capabilities to port — existing)

### Active

- [ ] Core memory storage using @memvid/sdk with Bun compatibility
- [ ] Opencode plugin architecture with event-based hooks
- [ ] Automatic capture of tool executions, file changes, and session events
- [ ] Context injection at session start via session.created hook
- [ ] `/mind stats` command for memory statistics
- [ ] `/mind search <query>` command for searching memories
- [ ] `/mind ask <question>` command for natural language queries
- [ ] Privacy-first local storage in `.opencode/mind.mv2`
- [ ] Multi-project support (separate memory per project)
- [ ] Zero-configuration installation via npm

### Out of Scope

- **Cloud sync** — Violates privacy-first principle, keep everything local
- **Multi-user collaboration** — Single user per memory file, use git for sharing
- **Web interface** — Terminal-first philosophy, all interaction via Opencode TUI
- **External APIs** — No calling out to external services
- **Real-time sync** — Session-end persistence is sufficient
- **Memory editing UI** — Commands are sufficient, no need for interactive editor
- **Mobile app** — Out of scope for initial version

## Context

### Origin

This is a port of claude-brain (a successful Claude Code plugin) to Opencode. The existing codebase uses:
- Node.js hooks with stdin/stdout communication
- @memvid/sdk for memory storage
- `.claude/mind.mv2` storage location
- Session hooks: session_start, post_tool_use, stop

### Target Platform

Opencode is a 96.3k+ star open-source AI coding agent that:
- Uses Bun runtime (not Node.js)
- Has a client/server architecture
- Supports TypeScript plugins natively
- Uses event-based hooks instead of stdin/stdout
- Stores config in `.opencode/` directory
- Has built-in Build and Plan agents

### Technical Environment

**Critical differences from Claude Code:**
- Runtime: Bun instead of Node.js
- Plugin system: Native TS modules with event hooks
- Storage location: `.opencode/mind.mv2` instead of `.claude/mind.mv2`
- Commands: Custom slash commands defined in `.opencode/commands/`
- Hooks: Rich event system (session.created, tool.execute.after, session.idle, etc.)

### Prior Work

Claude-brain has been successful with:
- ~70KB base size, grows ~1KB per memory
- Sub-millisecond search via Rust core
- One-file portability
- Git version control friendly

We should match or exceed these characteristics.

## Constraints

- **Runtime**: Must work with Bun (not Node.js) — Opencode's JavaScript runtime
- **Storage**: Single `.opencode/mind.mv2` file — follows Opencode conventions
- **Privacy**: 100% local, no network calls — core value proposition
- **Compatibility**: Must support @memvid/sdk — core dependency
- **Performance**: No noticeable Opencode slowdown — user experience critical
- **Installation**: One-command install (`npm install opencode-brain`) — ease of use

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Native plugin vs adapter | Event-based system is richer than stdin/stdout hooks | — Pending |
| Bun runtime | Opencode uses Bun, must be compatible | — Pending |
| .opencode/mind.mv2 | Follows Opencode conventions | — Pending |
| npm distribution | Standard JavaScript package distribution | — Pending |
| Separate memory per project | Opencode worktree structure | — Pending |
| Batch event writes | Prevent I/O overhead on every tool use | — Pending |

---

*Last updated: 2025-02-03 after project initialization and domain research*
