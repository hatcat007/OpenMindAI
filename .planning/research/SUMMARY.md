# Research Summary: Opencode Brain

**Research Date:** 2025-02-03
**Domain:** Opencode AI Coding Agent + Memory Persistence System

## Key Findings

### 1. Opencode Architecture

Opencode is a **96.3k+ star open-source AI coding agent** with a unique architecture:

- **Client/Server model**: Can run remotely and be driven from different clients
- **Terminal-first** (TUI): Built by terminal.shop creators, focuses on keyboard-driven interface
- **TypeScript/Bun**: 87% TypeScript, uses Bun runtime (not Node.js)
- **Provider-agnostic**: Works with Claude, GPT, Gemini, or local models
- **Built-in LSP**: Native language server support

**Critical for porting:**
- Configuration in `.opencode/` directory (not `.claude/`)
- Plugin system uses **event-based hooks** (not stdin/stdout)
- Plugins are native **TypeScript/JavaScript modules**
- Rich event system: `session.created`, `tool.execute.after`, `session.idle`, etc.

### 2. Plugin System (Primary Integration Point)

**Location:** `.opencode/plugins/` or `~/.config/opencode/plugins/`

**Format:** JavaScript/TypeScript modules exporting plugin functions

**Key Events for Memory System:**
```javascript
"session.created"        // Load memory at session start
"tool.execute.after"     // Capture tool usage
"session.idle"          // Save memory at session end
"session.compacting"    // Add context before compaction
"file.edited"           // Track file changes
```

**Advantages over Claude Code hooks:**
- Native TypeScript support (no JSON parsing)
- Direct SDK access for AI operations
- Can add custom tools (`mind` tool)
- Can define custom commands (`/mind stats`)
- Rich context object with project info, shell access

### 3. Technical Stack

**Current (Claude-Brain):**
- Node.js 18+, TypeScript 5.7
- @memvid/sdk for storage
- tsup for bundling
- proper-lockfile for locking

**Target (Opencode-Brain):**
- **Bun runtime** (major change)
- ⚠️ @memvid/sdk **NOT COMPATIBLE** with Bun
- **Alternative storage needed** (SQLite or JSON-based)
- @opencode-ai/plugin for SDK
- Native TypeScript (no separate compilation step)

**Risk Assessment (Updated):**
- @memvid/sdk with Bun: **NOT COMPATIBLE** ⚠️ CRITICAL
- Alternative storage: **MEDIUM** (needs implementation)
- File locking: **MEDIUM** (may need Bun alternative)
- General logic: **LOW** (standard APIs compatible)

**CRITICAL FINDING:**
@memvid/sdk fails with Bun due to Node.js crypto incompatibility in analytics module. Must implement alternative storage solution.

### 4. Recommended Architecture

**Approach:** Native Opencode plugin (not adapter)

**Structure:**
```
opencode-brain/
├── src/
│   ├── index.ts           # Plugin entry point
│   ├── memory.ts          # Core memory logic
│   ├── storage.ts         # Storage adapter
│   ├── capture.ts         # Event capture
│   └── commands.ts        # Command definitions
├── .opencode/
│   └── commands/
│       ├── mind-stats.md
│       ├── mind-search.md
│       └── mind-ask.md
└── package.json
```

**Storage:** `.opencode/mind.mv2` (follows Opencode conventions)

**Distribution:** npm package `opencode-brain`

### 5. Features to Port

**Table Stakes (Must Have):**
1. Automatic memory capture (tool use, file changes, errors)
2. Session start context injection
3. `/mind stats` - Show memory statistics
4. `/mind search` - Search memories
5. `/mind ask` - Query with natural language
6. One-file storage (mind.mv2)
7. 100% local, privacy-first

**Differentiators (Nice to Have):**
1. Custom `mind` tool for AI self-query
2. Smart compression of old sessions
3. Cross-session linking
4. Import from claude-brain

**Anti-Features (Out of Scope):**
- Cloud sync
- Multi-user sharing
- Web interface
- External APIs
- Non-local storage

### 6. Critical Pitfalls

**HIGH RISK:**
1. **Bun compatibility** - @memvid/sdk native bindings need testing
2. **Session injection timing** - Must inject at right moment without overwhelming context

**MEDIUM RISK:**
3. **Event overhead** - Capturing every tool use could slow Opencode
4. **Storage location** - Confusion between global and project-level storage
5. **Multi-agent confusion** - Build vs Plan agents have different needs

**Solutions:**
- Test with Bun early and thoroughly
- Use buffering/batching for writes
- Follow Opencode conventions strictly
- Cache contexts per agent type

## Recommended Implementation Strategy

### Phase 1: Foundation (Week 1)
- Set up Bun development environment
- Test @memvid/sdk compatibility with Bun
- Create basic plugin structure
- Implement storage layer
- Configure build/packaging for npm

### Phase 2: Capture (Week 1-2)
- Implement event handlers
- Capture tool executions
- Capture file changes
- Add in-memory buffering
- Create flush mechanism

### Phase 3: Injection (Week 2)
- Load memory at session start
- Format for injection
- Handle agent types
- Test context availability

### Phase 4: Commands (Week 2-3)
- `/mind stats` command
- `/mind search` command  
- `/mind ask` command
- Custom `mind` tool

### Phase 5: Polish (Week 3-4)
- Compression
- Import from claude-brain
- Documentation
- Testing & bug fixes

## Success Criteria

**Minimum Viable:**
- ✅ Memory persists across sessions
- ✅ Context auto-captured from events
- ✅ `/mind stats` shows memory info
- ✅ Zero config after `npm install`
- ✅ Works with Bun

**Full Success:**
- ✅ All /mind commands work
- ✅ No performance degradation
- ✅ Migration from claude-brain works
- ✅ Multi-project support
- ✅ Published on npm

## Next Steps

1. **Immediate:** Verify @memvid.sdk works with Bun
2. **Day 1:** Create plugin skeleton and test loading
3. **Day 2-3:** Port core memory logic
4. **Week 1:** Full capture and injection working
5. **Week 2-3:** Commands and polish

## Resources

- Opencode GitHub: https://github.com/anomalyco/opencode
- Plugin Docs: https://opencode.ai/docs/plugins/
- Commands Docs: https://opencode.ai/docs/commands/
- Agents Docs: https://opencode.ai/docs/agents/

---

**Research Confidence:** HIGH
- Direct documentation from official sources
- Clear architecture differences identified
- Specific technical requirements documented
- Risk areas highlighted with mitigation strategies
