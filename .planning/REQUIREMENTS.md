# Requirements: Opencode Brain

**Defined:** 2025-02-03
**Core Value:** Make Opencode remember everything across sessions without user effort

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Core Storage (CORE)

- [ ] **CORE-01**: Store memories in single `.opencode/mind.mv2` file
- [ ] **CORE-02**: Implement Bun-compatible storage layer (⚠️ @memvid/sdk NOT compatible with Bun)
- [ ] **CORE-03**: Support multi-project (separate memory per project directory)
- [ ] **CORE-04**: Handle file locking to prevent corruption during concurrent access (Bun-compatible)
- [ ] **CORE-05**: Compress old sessions to manage file size
- [ ] **CORE-06**: Provide memory reset command with confirmation

### Plugin Architecture (PLUG)

- [ ] **PLUG-01**: Create native Opencode plugin structure (TypeScript/Bun)
- [ ] **PLUG-02**: Use @opencode-ai/plugin SDK for integration
- [ ] **PLUG-03**: Install via npm as `opencode-brain` package
- [ ] **PLUG-04**: Auto-initialize on first run (create mind.mv2 if missing)
- [ ] **PLUG-05**: Configure via `opencode.json` plugin array
- [ ] **PLUG-06**: Handle plugin lifecycle (load, events, unload)

### Event Capture (CAPT)

- [ ] **CAPT-01**: Capture `tool.execute.after` events (file reads, writes, bash commands)
- [ ] **CAPT-02**: Capture `file.edited` events with change summaries
- [ ] **CAPT-03**: Capture `session.error` events for bug tracking
- [ ] **CAPT-04**: Batch writes to disk (don't write on every event)
- [ ] **CAPT-05**: Implement in-memory buffering with periodic flush
- [ ] **CAPT-06**: Filter sensitive data (passwords, API keys, .env files)

### Context Injection (INJ)

- [ ] **INJ-01**: Load memory at `session.created` event
- [ ] **INJ-02**: Inject relevant context into system prompt or user message
- [ ] **INJ-03**: Compress context intelligently (keep only relevant history)
- [ ] **INJ-04**: Handle Build agent differently from Plan agent if needed
- [ ] **INJ-05**: Ensure context is available for first user message
- [ ] **INJ-06**: Support `session.compacting` hook for custom compaction context

### Commands (CMD)

- [ ] **CMD-01**: `/mind stats` - Show total memories, storage size, session count
- [ ] **CMD-02**: `/mind search <query>` - Full-text search across all memories
- [ ] **CMD-03**: `/mind ask <question>` - Natural language query with RAG-style retrieval
- [ ] **CMD-04**: `/mind recent` - Show last N sessions and activities
- [ ] **CMD-05**: `/mind timeline` - View chronological history of sessions
- [ ] **CMD-06**: `/mind import` - Import memories from claude-brain (migration)

### Custom Tool (TOOL)

- [ ] **TOOL-01**: Create `mind` tool for AI to query its own memory
- [ ] **TOOL-02**: Tool accepts query parameter for searching
- [ ] **TOOL-03**: Tool returns formatted results for AI consumption
- [ ] **TOOL-04**: Tool is available to all Opencode agents

### Privacy & Security (PRIV)

- [ ] **PRIV-01**: 100% local storage (no cloud, no external APIs)
- [ ] **PRIV-02**: Never capture .env files or files with secrets
- [ ] **PRIV-03**: Filter bash commands that might contain passwords
- [ ] **PRIV-04**: User controls what gets captured (opt-out per session if needed)
- [ ] **PRIV-05**: Clear documentation of what is stored

### Installation & Setup (INST)

- [ ] **INST-01**: One-command install: `npm install opencode-brain`
- [ ] **INST-02**: Zero configuration (works out of the box)
- [ ] **INST-03**: Compatible with Bun runtime
- [ ] **INST-04**: Works on macOS, Linux, Windows (WSL)
- [ ] **INST-05**: No performance degradation of Opencode

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Memory (ADV)

- **ADV-01**: Smart compression with importance scoring
- **ADV-02**: Cross-session linking (connect related work)
- **ADV-03**: Auto-categorization of memories (bug, decision, convention)
- **ADV-04**: Conflict detection (alert if contradicting previous decisions)
- **ADV-05**: Memory visualization (timeline UI)

### Multi-Agent Support (AGT)

- **AGT-01**: Agent-specific memory layers
- **AGT-02**: Shared core memory across all agents
- **AGT-03**: Per-agent context extensions

### Team Features (TEAM)

- **TEAM-01**: Export memory subset for sharing
- **TEAM-02**: Memory merge when pulling from git
- **TEAM-03**: Conflict resolution for divergent memories

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Cloud sync | Violates privacy-first principle |
| Multi-user real-time collaboration | Use git for sharing, single-user per memory file |
| Web interface | Terminal-first philosophy, TUI is sufficient |
| Mobile app companion | Out of scope for v1 |
| External API integrations | Keep 100% local, no external dependencies |
| Auto-correct based on memory | Don't auto-modify user code |
| Non-local database storage | Single file (.mv2) is core value prop |
| Real-time session streaming | Session-end persistence is sufficient |
| Memory editing UI | Commands (/mind ...) are sufficient |
| AI-powered memory suggestions | Too complex for v1, focus on core persistence |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Pending |
| CORE-02 | Phase 1 | Pending |
| CORE-03 | Phase 1 | Pending |
| CORE-04 | Phase 1 | Pending |
| CORE-05 | Phase 5 | Pending |
| CORE-06 | Phase 4 | Pending |
| PLUG-01 | Phase 1 | Pending |
| PLUG-02 | Phase 1 | Pending |
| PLUG-03 | Phase 1 | Pending |
| PLUG-04 | Phase 1 | Pending |
| PLUG-05 | Phase 1 | Pending |
| PLUG-06 | Phase 1 | Pending |
| CAPT-01 | Phase 2 | Pending |
| CAPT-02 | Phase 2 | Pending |
| CAPT-03 | Phase 2 | Pending |
| CAPT-04 | Phase 2 | Pending |
| CAPT-05 | Phase 2 | Pending |
| CAPT-06 | Phase 2 | Pending |
| INJ-01 | Phase 3 | Pending |
| INJ-02 | Phase 3 | Pending |
| INJ-03 | Phase 3 | Pending |
| INJ-04 | Phase 3 | Pending |
| INJ-05 | Phase 3 | Pending |
| INJ-06 | Phase 3 | Pending |
| CMD-01 | Phase 4 | Pending |
| CMD-02 | Phase 4 | Pending |
| CMD-03 | Phase 4 | Pending |
| CMD-04 | Phase 4 | Pending |
| CMD-05 | Phase 4 | Pending |
| CMD-06 | Phase 4 | Pending |
| TOOL-01 | Phase 4 | Pending |
| TOOL-02 | Phase 4 | Pending |
| TOOL-03 | Phase 4 | Pending |
| TOOL-04 | Phase 4 | Pending |
| PRIV-01 | Phase 2 | Pending |
| PRIV-02 | Phase 2 | Pending |
| PRIV-03 | Phase 2 | Pending |
| PRIV-04 | Phase 2 | Pending |
| PRIV-05 | Phase 1 | Pending |
| INST-01 | Phase 1 | Pending |
| INST-02 | Phase 1 | Pending |
| INST-03 | Phase 1 | Pending |
| INST-04 | Phase 1 | Pending |
| INST-05 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0 ✓

---

*Requirements defined: 2025-02-03*
*Last updated: 2025-02-03 after research phase*
