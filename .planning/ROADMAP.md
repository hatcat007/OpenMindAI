# Roadmap: Opencode Brain

**Current Status:** 0% complete | **Target:** 100% (5 phases)

---

## Phase 1: Foundation
**Goal:** Establish core storage and plugin architecture
**Requirements:** CORE-01..06, PLUG-01..06, PRIV-05, INST-01..05
**Success Criteria:** Plugin loads, creates mind.mv2, basic storage works

⚠️ **CRITICAL CHANGE:** @memvid/sdk is NOT compatible with Bun. Must implement Bun-compatible storage layer.

| # | Requirement | Description |
|---|-------------|-------------|
| 1 | CORE-01 | Single-file storage in .opencode/mind.mv2 |
| 2 | CORE-02 | Bun-compatible storage implementation (replaces @memvid/sdk) |
| 3 | CORE-03 | Multi-project support via worktree detection |
| 4 | CORE-04 | File locking to prevent corruption (Bun-compatible) |
| 5 | PLUG-01 | Native plugin structure with TypeScript |
| 6 | PLUG-02 | @opencode-ai/plugin SDK integration |
| 7 | PLUG-03 | NPM package structure for opencode-brain |
| 8 | PLUG-04 | Auto-initialization on first run |
| 9 | INST-01 | One-command npm install |
| 10 | INST-02 | Zero configuration out of the box |

**Phase Success:** 
- [ ] Plugin loads without errors in Opencode
- [ ] mind.mv2 created automatically on first run
- [ ] Can write and read from Bun-compatible storage layer
- [ ] Works with Bun runtime
- [ ] Storage API matches @memvid/sdk surface for future migration

**Plans:** 3 plans
- [ ] 01-01-PLAN.md — Bun-compatible storage layer (SQLite-based)
- [ ] 01-02-PLAN.md — Plugin architecture with @opencode-ai/plugin SDK
- [ ] 01-03-PLAN.md — NPM package structure and build configuration

---

## Phase 2: Event Capture
**Goal:** Capture session activity transparently
**Requirements:** CAPT-01..06, PRIV-01..04, INST-05
**Dependencies:** Phase 1
**Success Criteria:** Tool executions captured, buffered writes, no performance impact

| # | Requirement | Description |
|---|-------------|-------------|
| 1 | CAPT-01 | Capture tool.execute.after events |
| 2 | CAPT-02 | Capture file.edited events |
| 3 | CAPT-03 | Capture session.error events |
| 4 | CAPT-04 | Batch writes to disk (async) |
| 5 | CAPT-05 | In-memory buffering with periodic flush |
| 6 | CAPT-06 | Filter sensitive data (secrets, .env) |
| 7 | PRIV-01 | 100% local storage guarantee |
| 8 | PRIV-02 | Exclude .env files from capture |
| 9 | PRIV-03 | Filter bash commands with passwords |
| 10 | INST-05 | No Opencode performance degradation |

**Phase Success:**
- [ ] Every tool use is captured
- [ ] File changes recorded with metadata
- [ ] No noticeable slowdown (benchmark <5% latency increase)
- [ ] Secrets never appear in mind.mv2

---

## Phase 3: Context Injection
**Goal:** Make Opencode remember previous sessions
**Requirements:** INJ-01..06
**Dependencies:** Phase 1, Phase 2
**Success Criteria:** Context loaded at session start, available for queries

| # | Requirement | Description |
|---|-------------|-------------|
| 1 | INJ-01 | Load memory at session.created event |
| 2 | INJ-02 | Inject context into system/user message |
| 3 | INJ-03 | Compress context intelligently |
| 4 | INJ-04 | Handle Build vs Plan agents |
| 5 | INJ-05 | Context available for first user message |
| 6 | INJ-06 | Support session.compacting hook |

**Phase Success:**
- [ ] Previous session context available immediately
- [ ] Opencode can answer "What did we decide..." questions
- [ ] Context doesn't overwhelm token limit
- [ ] Works across agent switches

---

## Phase 4: Commands & Custom Tool
**Goal:** Let users interact with memory directly
**Requirements:** CMD-01..06, TOOL-01..04
**Dependencies:** Phase 1, Phase 2, Phase 3
**Success Criteria:** All /mind commands work, custom tool available

| # | Requirement | Description |
|---|-------------|-------------|
| 1 | CMD-01 | /mind stats command |
| 2 | CMD-02 | /mind search command |
| 3 | CMD-03 | /mind ask command (natural language) |
| 4 | CMD-04 | /mind recent command |
| 5 | CMD-05 | /mind timeline command |
| 6 | CMD-06 | /mind import command (migration) |
| 7 | TOOL-01 | Create mind tool for AI |
| 8 | TOOL-02 | Tool accepts query parameter |
| 9 | TOOL-03 | Tool returns formatted results |
| 10 | TOOL-04 | Tool available to all agents |

**Phase Success:**
- [ ] User can run /mind stats and see statistics
- [ ] User can search with /mind search "auth"
- [ ] AI can call mind tool to query its own memory
- [ ] Migration from claude-brain works

---

## Phase 5: Polish & Optimization
**Goal:** Optimize and add advanced features
**Requirements:** CORE-05, CORE-06, PRIV-04
**Dependencies:** Phase 1-4
**Success Criteria:** File size managed, reset works, user control

| # | Requirement | Description |
|---|-------------|-------------|
| 1 | CORE-05 | Compress old sessions |
| 2 | CORE-06 | Memory reset command with confirmation |
| 3 | PRIV-04 | User opt-out per session if needed |

**Phase Success:**
- [ ] Old sessions compressed automatically
- [ ] File size stays manageable (<5MB for typical use)
- [ ] User can reset memory safely

---

## Milestone Definition

**Milestone Complete When:**
1. All 5 phases complete with verified success criteria
2. Plugin published to npm as `opencode-brain`
3. Documentation complete with install instructions
4. Migration path from claude-brain documented
5. No critical bugs or performance issues

**Definition of Done:**
- User can `npm install opencode-brain`, add to opencode.json, and it works
- Memory persists across Opencode sessions
- /mind commands respond correctly
- No performance degradation
- Privacy guarantees maintained

---

*Roadmap created: 2025-02-03*
*Last updated: 2025-02-03*
