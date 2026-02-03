# Opencode Architecture Research

## Overview

Opencode is an **open source AI coding agent** (96.3k+ GitHub stars) that serves as an alternative to Claude Code. It's built by the creators of terminal.shop and focuses on terminal-first UI (TUI) with a client/server architecture.

## System Architecture

### Core Components

**Client/Server Architecture:**
- Opencode can run on a server while being driven remotely from different clients
- TUI frontend is just one possible client (mobile app, web interface possible)
- Built primarily in **TypeScript (87%)** with some Rust (0.5%)
- Uses Bun as the JavaScript runtime

**Key Directories:**
```
~/.config/opencode/          # Global config
├── opencode.json            # Main config file
├── plugins/                 # Global plugins
├── commands/                # Global custom commands
├── agents/                  # Global custom agents
├── skills/                  # Global skills
└── package.json             # Plugin dependencies

./                           # Project-level config
├── .opencode/               # Per-project config
│   ├── opencode.json       # Project config
│   ├── plugins/            # Project plugins
│   ├── commands/           # Project commands
│   ├── agents/            # Project agents
│   ├── skills/            # Project skills
│   └── package.json       # Plugin dependencies
├── AGENTS.md              # Project context (created by /init)
└── opencode.json          # Alternative project config location
```

## Key Differences from Claude Code

| Feature | Claude Code | Opencode |
|---------|-------------|----------|
| **License** | Proprietary | 100% MIT open source |
| **Architecture** | Monolithic | Client/server |
| **Providers** | Anthropic only | Provider-agnostic (Claude, GPT, Gemini, local) |
| **LSP** | None | Built-in LSP support |
| **UI** | Custom TUI | Terminal-first (by neovim users) |
| **Configuration** | `.claude/`, hooks.json | `.opencode/`, opencode.json |
| **Plugin System** | Hooks (stdin/stdout) | Event-based JS/TS plugins |
| **Extension Points** | Session hooks, post-tool | Rich event system + commands + agents |
| **Installation** | Via Claude marketplace | npm, brew, curl, scoop |

## Session/Context Model

### Built-in Agents

Opencode has 4 built-in agents:

1. **Build** (primary) - Full access agent for development work
2. **Plan** (primary) - Read-only agent for analysis and planning
3. **General** (subagent) - Multi-step task execution, research
4. **Explore** (subagent) - Fast read-only codebase exploration

**Agent Switching:** Use `Tab` key to cycle between primary agents

### Context Persistence

- Sessions can be shared via `/share` command
- Context compaction happens automatically (configurable)
- No native "memory" persistence between sessions (this is where claude-brain fits)

## Integration Points for Memory System

### 1. Plugin System (RECOMMENDED)

**Location:** `.opencode/plugins/` or `~/.config/opencode/plugins/`

**Format:** JavaScript/TypeScript modules that export plugin functions

**Key Hooks for Memory:**
```javascript
// Available plugin events
"session.created"           // When session starts - INJECT MEMORY HERE
"session.updated"          // During session - capture context
"session.compacted"        // Before context window fills - capture summary
"session.idle"            // When session ends - SAVE MEMORY
"tool.execute.after"       // After each tool use - capture actions
"message.updated"          // When messages change
"command.executed"         // When commands run
```

**Plugin Context Available:**
- `project` - Current project info
- `directory` - Current working directory
- `worktree` - Git worktree path
- `client` - Opencode SDK client for AI interaction
- `$` - Bun shell API for commands

### 2. Commands System

**Location:** `.opencode/commands/` or `~/.config/opencode/commands/`

**Format:** Markdown files with frontmatter

**Use Case:** Create `/mind` commands for users to interact with memory

Example:
```markdown
---
description: Search memory for context
agent: build
---

Search the memory system for information about: $ARGUMENTS
```

### 3. Skills System

**Location:** `.opencode/skills/` or `~/.config/opencode/skills/`

**Format:** SKILL.md files with YAML frontmatter

**Use Case:** Define reusable behaviors for memory operations

### 4. Custom Tools

Plugins can add **custom tools** that Opencode can call via the `tool` API.

**Key Differences from Claude Code Hooks:**

| Claude Code | Opencode Equivalent |
|-------------|---------------------|
| `hooks.json` + scripts | `plugins/*.ts` with event handlers |
| `session_start` hook | `session.created` event |
| `stop` hook | `session.idle` event |
| `post_tool_use` hook | `tool.execute.after` event |
| Stdin/stdout JSON | Direct function calls with context |
| Hooks in `dist/hooks/` | Plugins in `.opencode/plugins/` |

## Architecture Recommendations

### Port Strategy: Native Plugin

The best approach is to create an **Opencode native plugin** rather than trying to adapt the hook system:

**Advantages:**
1. Native TypeScript support (no stdin/stdout parsing)
2. Rich event system (more hooks than Claude Code)
3. Direct SDK access for AI operations
4. Can add custom tools (`mind` tool for memory access)
5. Can define custom commands (`/mind stats`, `/mind search`)
6. Can define custom agents (memory-aware agent)

**File Structure:**
```
opencode-brain/
├── package.json              # Plugin package
├── tsconfig.json
├── src/
│   ├── index.ts             # Main plugin entry
│   ├── memory.ts            # Core memory logic (from claude-brain)
│   ├── storage.ts           # Storage adapter
│   ├── hooks.ts             # Event handlers
│   └── commands.ts          # Command definitions
├── .opencode/
│   └── plugins/
│       └── opencode-brain.ts  # Plugin file (installed here)
└── commands/
    ├── mind-stats.md
    ├── mind-search.md
    └── mind-ask.md
```

### Session Flow

```
Session Start
    ↓
session.created event fired
    ↓
Plugin loads memory from .opencode/mind.mv2
    ↓
Plugin injects context via compaction hook OR
Plugin adds system message with memory context
    ↓
User interacts with Opencode
    ↓
tool.execute.after captures tool usage
message.updated captures decisions
    ↓
Session End (session.idle)
    ↓
Plugin saves accumulated context to .opencode/mind.mv2
```

## Sources

- GitHub: https://github.com/anomalyco/opencode
- Website: https://opencode.ai
- Docs: https://opencode.ai/docs
- Plugin Docs: https://opencode.ai/docs/plugins/
- Commands Docs: https://opencode.ai/docs/commands/
- Agents Docs: https://opencode.ai/docs/agents/
- Skills Docs: https://opencode.ai/docs/skills/
