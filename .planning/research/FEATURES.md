# Features Research: Opencode Brain

## Core Value Proposition

**Give Opencode photographic memory across sessions**

Just like claude-brain does for Claude Code, opencode-brain will remember:
- Context and decisions from previous sessions
- Bugs encountered and solutions found
- Architecture decisions and their rationale
- Code patterns and conventions used

## Feature Categories

### 1. Memory Persistence (Table Stakes)

**Must Have - Core Features:**

- [ ] **Automatic memory capture** - Record session context without user action
- [ ] **Session start injection** - Load previous context into new sessions
- [ ] **One-file storage** - Keep everything in `.opencode/mind.mv2`
- [ ] **Privacy-first** - 100% local, no cloud, no API keys
- [ ] **Git-friendly** - Version control your AI's memory
- [ ] **Portable** - Transfer via `scp`, email, etc.

**How it works:**
```
User starts Opencode
    ↓
Plugin loads .opencode/mind.mv2
    ↓
Injects context into system prompt
    ↓
User works normally
    ↓
Plugin captures: tool uses, decisions, errors
    ↓
On session end: save to mind.mv2
```

### 2. Memory Commands (Table Stakes)

**User-facing commands for memory interaction:**

- [ ] **`/mind stats`** - Show memory statistics
  - Total memories stored
  - Storage size
  - Session count
  - Last updated

- [ ] **`/mind search <query>`** - Search memories
  - Full-text search across all memories
  - Filter by date, type, session
  - Fuzzy matching

- [ ] **`/mind ask <question>`** - Ask your memory questions
  - Natural language queries
  - RAG-style retrieval
  - Contextual answers

- [ ] **`/mind recent`** - Show recent activity
  - Last N sessions
  - Recent decisions
  - Recent errors/solutions

- [ ] **`/mind timeline`** - View chronological history
  - Session-by-session breakdown
  - Key events per session
  - Searchable timeline

### 3. Automatic Capture (Table Stakes)

**What gets captured automatically:**

- [ ] **Tool executions** - Every tool use (read, write, bash, etc.)
- [ ] **File changes** - What files were modified
- [ ] **Errors encountered** - Bug patterns and solutions
- [ ] **User decisions** - "We decided to use X instead of Y"
- [ ] **Architecture context** - "The auth system works like..."
- [ ] **Conventions** - "We use 2-space indentation"

**Implementation via hooks:**
- `tool.execute.after` - Capture tool usage
- `file.edited` - Capture file changes  
- `session.error` - Capture errors
- `message.updated` - Capture decisions (via LLM analysis)

### 4. Smart Memory (Differentiators)

**Advanced features for better memory quality:**

- [ ] **Compression** - Summarize old sessions to save space
- [ ] **Importance scoring** - Mark critical decisions vs routine
- [ ] **Auto-categorization** - Tag memories (bug, decision, convention)
- [ ] **Cross-session linking** - Connect related sessions
- [ ] **Conflict detection** - Alert if contradicting previous decisions

### 5. Integration Features (Table Stakes)

**Seamless Opencode integration:**

- [ ] **Custom tool** - `mind` tool for AI to query its own memory
- [ ] **Agent-aware** - Different memory context for Build vs Plan agents
- [ ] **Multi-project** - Separate memory per project (already handled by .opencode/)
- [ ] **Import/Export** - Backup and restore memories
- [ ] **Reset** - Clear memory with confirmation

### 6. Installation & Setup (Table Stakes)

**Easy installation:**

- [ ] **One-command install** - `npm install opencode-brain`
- [ ] **Auto-configuration** - Detect and configure on first run
- [ ] **Zero dependencies** for users - Just add to opencode.json
- [ ] **Migration support** - Import from claude-brain

## Feature Comparison: Claude-Brain vs Opencode-Brain

| Feature | Claude-Brain | Opencode-Brain |
|---------|--------------|----------------|
| **Storage** | `.claude/mind.mv2` | `.opencode/mind.mv2` |
| **Hooks** | stdin/stdout scripts | Event-based plugin |
| **Commands** | `/mind ...` | `/mind ...` (custom commands) |
| **Auto-capture** | ✅ Yes | ✅ Yes (more events) |
| **Search** | ✅ Yes | ✅ Yes |
| **Stats** | ✅ Yes | ✅ Yes |
| **Custom tool** | ❌ No | ✅ Yes (`mind` tool) |
| **Compression** | ✅ Yes | ✅ Yes |
| **Privacy** | ✅ 100% local | ✅ 100% local |

## Anti-Features (Explicitly Out of Scope)

**Won't build:**

- **Cloud sync** - Against privacy-first principle
- **Multi-user sharing** - Single user per memory file
- **Web interface** - Terminal-first philosophy
- **External APIs** - No calling out to services
- **Auto-correct** - Don't change user code automatically
- **Non-local storage** - No databases, no remote storage

## User Workflows

### Workflow 1: New User

```
1. npm install opencode-brain
2. Add to opencode.json: { "plugin": ["opencode-brain"] }
3. Start Opencode - memory initializes automatically
4. Work normally - context captured transparently
5. Later: /mind stats to see what's remembered
```

### Workflow 2: Returning User

```
1. Start Opencode in project
2. Plugin auto-loads previous context
3. Ask: "What did we decide about auth?"
4. Opencode has full context from previous sessions
```

### Workflow 3: Memory Investigation

```
1. /mind search "authentication"
2. See all previous auth-related work
3. /mind ask "why did we choose JWT?"
4. Get contextual answer from history
```

### Workflow 4: Team Sharing

```
1. Developer A works, commits .opencode/mind.mv2
2. Developer B pulls repo, starts Opencode
3. Developer B has Developer A's context
4. "What did Alice decide about the database?"
```

## Complexity Analysis

**Low Complexity:**
- Basic capture (tool execution, file changes)
- Simple storage (one file)
- Command routing

**Medium Complexity:**
- Context injection into sessions
- Search functionality
- Command implementations

**High Complexity:**
- Smart compression
- Importance detection
- Cross-session linking
- Natural language querying

## Dependencies Between Features

```
Core Storage (mind.mv2)
    ↓
Auto Capture (hooks/events)
    ↓
Session Injection (session.created)
    ↓
Commands (/mind stats, search)
    ↓
Advanced (compression, linking)
```

## Recommended Build Order

1. **Foundation** - Storage, basic plugin structure
2. **Capture** - Event hooks for session/tool/file
3. **Injection** - Load memory at session start
4. **Commands** - User-facing /mind commands
5. **Polish** - Search, stats, compression

## Success Metrics

**What "works" looks like:**

- ✅ Memory file created automatically
- ✅ Context persists across sessions
- ✅ User can search memories
- ✅ Zero configuration after install
- ✅ No noticeable performance impact
- ✅ Works with all Opencode agents
