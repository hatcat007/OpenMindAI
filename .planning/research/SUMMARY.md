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

### 4. Recommended Architecture

**Approach:** Native Opencode plugin (not adapter)

**Structure:**
```
opencode-brain/
├── src/
│   ├── index.ts           # Plugin entry point
│   ├── memory.ts          # Core memory logic
│   ├── storage.ts         # Storage adapter (Bun-compatible)
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

## Critical Update: Bun Compatibility Test Results

**Test Date:** 2025-02-03
**Bun Version:** 1.3.8
**@memvid/sdk Version:** 2.0.149

### ⚠️ CRITICAL ISSUE CONFIRMED

**@memvid/sdk is NOT compatible with Bun**

**Issues Found:**
1. **Node.js crypto incompatibility**: SDK analytics uses `crypto.createHash()` which fails in Bun
   - Error: `TypeError: The "data" argument must be of type string...`
   - File: `analytics.js:105` in `generateAnonId()`
2. **API returns Promises**: `create()` and `use()` return Promises, requiring await

**Test Results:**
```
Bun v1.3.8
✗ crypto.createHash() fails in Bun
✗ Cannot create memory instance
✗ Cannot write or read data
```

### Recommended Solutions (in order)

**Option A: Alternative Storage (RECOMMENDED)**
- Implement Bun-compatible storage layer
- Use SQLite or JSON-based storage
- Reimplement core features (search, compression, etc.)
- Maintain same API surface for future migration

**Option B: Vendor Fix**
- Contact memvid team about Bun compatibility
- Request analytics bypass flag
- Timeline uncertain, SDK is closed-source

**Option C: Skip Bun**
- Create Node.js-only version
- Users must run Opencode in Node mode
- Loses compatibility with standard Opencode

### Impact on Project

- **Phase 1 scope increases**: Must implement storage layer instead of using SDK
- **Timeline impact**: Additional 1-2 weeks for storage implementation
- **Feature parity**: Need to reimplement vector search, compression, etc.
- **Risk level**: Elevated from MEDIUM-HIGH to CRITICAL

### Immediate Actions Required

1. **Design storage interface** that matches @memvid/sdk API
2. **Implement SQLite-based storage** with Bun compatibility
3. **Create feature parity matrix** comparing implementations
4. **Document the limitation** in README
5. **Contact memvid team** about Bun support for future migration

## Recommended Implementation Strategy

### Phase 1: Foundation (Week 1-2) - UPDATED
**Goal:** Establish core storage and plugin architecture

**New Tasks:**
- Design storage interface matching @memvid/sdk API
- Implement Bun-compatible storage (SQLite or JSON)
- Create file locking mechanism for Bun
- Build plugin structure with @opencode-ai/plugin
- Test storage read/write operations

**Requirements:** CORE-01, CORE-02 (NEW), CORE-03, CORE-04, PLUG-01..06, INST-01..02

### Phase 2: Event Capture (Week 2-3)
- Capture tool executions, file changes, errors
- Batch writes to disk (async)
- Filter sensitive data

### Phase 3: Context Injection (Week 3-4)
- Load memory at session start
- Inject context into prompts
- Compress intelligently

### Phase 4: Commands & Tools (Week 4-5)
- `/mind stats`, `/mind search`, `/mind ask`
- Custom `mind` tool for AI

### Phase 5: Polish & Migration (Week 5-6)
- Compression
- Import from claude-brain
- Documentation

**Timeline Impact:** +1-2 weeks due to storage layer implementation

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

## Critical Risks Summary

| Risk | Level | Status | Mitigation |
|------|-------|--------|------------|
| @memvid/sdk Bun incompatibility | **CRITICAL** | Confirmed | Implement alternative storage |
| Session injection timing | HIGH | - | Test with real sessions |
| Event overhead | MEDIUM | - | Batch writes, async processing |
| File locking in Bun | MEDIUM | - | Use Bun-compatible locks |
| Multi-agent confusion | MEDIUM | - | Agent-specific contexts |

## Next Steps

### Immediate (Today):
1. ✅ Research complete - all findings documented
2. ✅ Bun compatibility tested - issue confirmed
3. ✅ Roadmap updated with alternative storage
4. ⏭️ Begin Phase 1 planning with storage implementation

### This Week:
1. Design storage interface
2. Implement SQLite-based storage layer
3. Create plugin skeleton
4. Test with Bun

### Resources

- Opencode GitHub: https://github.com/anomalyco/opencode
- Plugin Docs: https://opencode.ai/docs/plugins/
- Commands Docs: https://opencode.ai/docs/commands/
- Agents Docs: https://opencode.ai/docs/agents/

---

**Research Confidence:** HIGH
- Direct documentation from official sources
- Clear architecture differences identified
- Bun compatibility tested and confirmed issues
- Risk areas highlighted with mitigation strategies
- **CRITICAL UPDATE:** Bun incompatibility confirmed, alternative storage required
