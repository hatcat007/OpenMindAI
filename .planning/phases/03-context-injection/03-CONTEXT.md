# Phase 3: Context Injection - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Load stored observations at session start and inject them into the conversation context so Opencode can answer "What did we decide...?" questions. This phase delivers INJ-01..06 requirements: load memory at session.created, inject into system/user messages, compress intelligently, handle Build vs Plan agents, ensure first-message availability, and support session.compacting hook.

</domain>

<decisions>
## Implementation Decisions

### Context injection format
- Inject into **system message** (prepended to Opencode's system prompt)
- Use **structured format** with clear headers:
  - "📋 Previous Context"
  - "🎯 Key Decisions" 
  - "📝 Recent Changes"
  - "⚠️ Open Issues"
- Include **essentials only** by default (conservative approach)
  - Last session summary
  - Key architectural decisions
  - Recent file changes
  - Any unresolved errors/issues
- **Stylish but professional** presentation:
  - ANSI color accents (subtle purple/blue gradient)
  - Unicode box-drawing borders (╭─╮ style)
  - Emoji headers for visual scanning
  - Small "— From memory —" divider at end
  - **NOT** a "disco party" — tasteful, readable

### Agent type handling
- **Unified memory approach** — same context injected for both Build and Plan agents
- Context **stays consistent** when user switches agents mid-session (no disruption)
- **Track agent type** on every observation for future filtering/analytics:
  - Tag each observation with `agentType: 'plan' | 'build'`
  - Store in database for potential agent-specific queries later
- **Smart mix priority** for first message:
  - Recent everything (last 2-3 sessions)
  - Plus agent-relevant decisions weighted higher:
    - Build agents: prioritize code changes, tool executions
    - Plan agents: prioritize architecture decisions, research notes

### Context prioritization & compression
- **Relevance scoring algorithm** for prioritization:
  - Weight factors: recency, importance markers, agent type match, query keywords
  - Decisions and errors weighted higher than routine tool executions
  - File changes weighted based on project criticality
- **User-configurable compression**:
  - Default: Conservative (compress only when approaching token limit)
  - Alternative mode: Aggressive (always keep under configurable token threshold)
  - Configurable via future `/mind:config` command
- **Compacting hook only** (INJ-06):
  - Only compress old sessions during `session.compacting` events
  - No background auto-compression (keep it simple)
  - Opportunity to summarize the just-finished session
- **Fallback when still too big:** Summarize further
  - Create higher-level summaries of dropped sessions
  - Never hard-truncate and lose potentially critical context
  - Preserve decision-making rationale even if details compressed

### Injection timing & behavior
- **Inject at `session.created` event** (immediate on session start)
- **Wait for context if needed**:
  - Brief delay acceptable (<100ms typical)
  - Queue first user message until context loaded
  - Never send message to AI without context context
- **Loading indicator:**
  - Show "🧠 Loading memory..." with spinner
  - BUT only display if loading takes >500ms
  - Fast loads (<500ms) are completely invisible (seamless)
- **First session (no prior memory):**
  - Display welcome message: "No previous context found. Starting fresh."
  - Helpful hint: "Your session history will be captured and available in future sessions."
  - Matches opencode-brain branding tone

### Display mode (deferred)
- Future `/mind:config` command will support:
  - `display: minimal` — clean text only
  - `display: fancy` — colors, emoji, borders (default)
- Belongs in Phase 4 (Commands & Tools)

</decisions>

<specifics>
## Specific Ideas

- "I want it stylish but professional — not a disco party" — tasteful headers with colors/emoji
- Welcome message should say "from opencode-brain" to establish brand presence
- Loading indicator with brain emoji (🧠) matches project identity
- Deferred: /mind:config for user control over display modes

</specifics>

<deferred>
## Deferred Ideas

### User configuration command `/mind:config`
Allow users to customize context injection behavior:
- `display: minimal | fancy` — control visual styling
- `compression: conservative | aggressive` — control compression level
- `contextAmount: essentials | full` — how much history to include
- `agentMode: unified | separate` — whether to differentiate Build/Plan contexts

**Rationale:** User configuration is a new capability that belongs in Phase 4 (Commands & Tools) alongside other /mind commands. This phase focuses on the injection mechanism itself.

### Auto-compression of old sessions
Background compression of sessions older than 30 days. Currently deferred to `session.compacting` hook only to keep implementation simple.

### Agent-specific context views
Different context presentation for Build vs Plan agents. Currently unified approach with weighted relevance scoring. Can be expanded later based on user feedback.

</deferred>

---

*Phase: 03-context-injection*
*Context gathered: 2026-02-03*
