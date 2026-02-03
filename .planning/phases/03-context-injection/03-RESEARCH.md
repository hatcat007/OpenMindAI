# Phase 3: Context Injection - Research

**Researched:** 2026-02-03
**Domain:** Context injection, relevance scoring, token management, @opencode-ai/plugin SDK
**Confidence:** MEDIUM

## Summary

This research covers implementing context injection for the opencode-brain plugin, focusing on loading stored observations at session start and presenting them effectively to Opencode agents. Based on analysis of the existing codebase and Phase 1/2 research, I've identified the technical approaches, patterns, and pitfalls.

**Key Findings:**
1. The @opencode-ai/plugin SDK provides `session.created` and `session.compacting` events for injection timing
2. No native `modifySystemPrompt` API exists - context injection requires alternative approaches
3. Relevance scoring should weight: recency (40%), importance (30%), agent type match (20%), keyword match (10%)
4. Token counting requires estimation algorithms (4 chars ≈ 1 token for English text)
5. Context should be formatted as styled text with clear section headers

**Primary Recommendation:** Implement context injection by prepending formatted memory context to the first user message or using session.compacting hook, with smart relevance scoring and conservative compression (2000 token default limit).

---

## Standard Stack

### Core (Verified from Codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@opencode-ai/plugin` | ^1.x (peer) | Plugin SDK for event handling | Required by Opencode, provides session events |
| `bun:sqlite` | Built-in | Storage retrieval | Already implemented in Phase 1 |

### For Context Injection (Research Required)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | - | Token estimation | Use simple heuristic (4 chars ≈ 1 token) |
| None required | - | Text formatting | Use native string/template formatting |

**No additional dependencies needed** - Context injection can be implemented using existing storage layer and native TypeScript capabilities.

---

## Architecture Patterns

### Pattern 1: Session Event Injection
**What:** Use `session.created` and `session.compacting` events to inject context
**When to use:** Primary injection mechanism (INJ-01, INJ-06)
**Confidence:** HIGH (verified from plugin.ts and research docs)

```typescript
// Source: Existing plugin.ts + research/ARCHITECTURE.md
export const OpencodeBrainPlugin: Plugin = async ({ client, directory, worktree }) => {
  const storage = createStorage({ filePath: storagePath });
  
  return {
    "session.created": async ({ session }) => {
      // INJ-01: Load memory at session start
      const memories = loadRelevantMemories(storage, session.id);
      
      // INJ-05: Ensure context available for first message
      // Context is formatted and stored for injection
      const context = formatContextForInjection(memories);
      sessionContext.set(session.id, context);
    },
    
    "session.compacting": async ({ session }) => {
      // INJ-06: Custom compaction context
      const summary = createSessionSummary(session);
      storage.write(`summary-${session.id}`, summary);
    }
  };
};
```

### Pattern 2: Relevance Scoring Algorithm
**What:** Multi-factor scoring to prioritize memories
**When to use:** When selecting which memories to inject (INJ-03)
**Confidence:** MEDIUM (pattern from training, weights need validation)

```typescript
// Recommended implementation based on CONTEXT.md decisions
interface RelevanceScore {
  entry: MemoryEntry;
  score: number;
  factors: {
    recency: number;      // 0-1, higher = more recent
    importance: number;   // 0-1, based on type (decision > tool)
    agentMatch: number;   // 0-1, 1 if agent type matches
    keywordMatch: number; // 0-1, based on query overlap
  };
}

function calculateRelevance(
  entry: MemoryEntry,
  currentAgent: 'plan' | 'build',
  queryKeywords: string[]
): number {
  const weights = {
    recency: 0.40,
    importance: 0.30,
    agentMatch: 0.20,
    keywordMatch: 0.10
  };
  
  // Recency: exponential decay based on age
  const ageHours = (Date.now() - entry.createdAt) / (1000 * 60 * 60);
  const recency = Math.exp(-ageHours / 24); // Half-life of 24 hours
  
  // Importance: based on observation type
  const importanceWeights: Record<string, number> = {
    'decision': 1.0,
    'problem': 0.9,
    'warning': 0.8,
    'refactor': 0.7,
    'success': 0.6,
    'discovery': 0.5,
    'feature': 0.4,
    'bugfix': 0.4,
    'pattern': 0.3,
    'solution': 0.3,
  };
  const importance = importanceWeights[entry.type] || 0.2;
  
  // Agent match: does entry agent type match current?
  const agentMatch = entry.metadata?.agentType === currentAgent ? 1.0 : 0.5;
  
  // Keyword match: overlap with query
  const content = entry.content.toLowerCase();
  const matches = queryKeywords.filter(kw => content.includes(kw.toLowerCase())).length;
  const keywordMatch = matches / Math.max(queryKeywords.length, 1);
  
  return (
    recency * weights.recency +
    importance * weights.importance +
    agentMatch * weights.agentMatch +
    keywordMatch * weights.keywordMatch
  );
}
```

### Pattern 3: Token Estimation & Compression
**What:** Estimate token count and compress to fit limits
**When to use:** Before injecting context (INJ-03)
**Confidence:** MEDIUM (standard algorithm, verified approach)

```typescript
// Token estimation: 4 characters ≈ 1 token for English
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Compression strategies
interface CompressionConfig {
  maxTokens: number;      // Default: 2000
  mode: 'conservative' | 'aggressive';
}

function compressContext(
  memories: MemoryEntry[],
  config: CompressionConfig
): string {
  // Sort by relevance score
  const scored = memories.map(m => ({
    entry: m,
    score: calculateRelevance(m, 'build', []) // Default to build for initial load
  })).sort((a, b) => b.score - a.score);
  
  let result = '';
  let tokenCount = 0;
  
  for (const { entry } of scored) {
    const formatted = formatMemoryEntry(entry);
    const entryTokens = estimateTokens(formatted);
    
    if (tokenCount + entryTokens > config.maxTokens) {
      // INJ-03: Fallback - summarize further instead of hard truncate
      if (config.mode === 'conservative') {
        // Add summary note instead of more entries
        result += '\n[Additional context summarized: ' + 
          `${scored.length - scored.indexOf({entry, score: 0})} more items]\n`;
        break;
      }
      // Aggressive mode: skip low-relevance entries entirely
      continue;
    }
    
    result += formatted;
    tokenCount += entryTokens;
  }
  
  return result;
}
```

### Pattern 4: Styled Context Formatting
**What:** Format memories with professional styling (ANSI colors, emoji, borders)
**When to use:** When presenting context to user (matches CONTEXT.md decisions)
**Confidence:** HIGH (from CONTEXT.md requirements)

```typescript
// Format context with stylish but professional presentation
function formatContextSection(
  title: string,
  emoji: string,
  items: string[],
  color: string
): string {
  const border = '─'.repeat(50);
  const lines = [
    `\x1b[${color}m╭${border}╮\x1b[0m`,
    `\x1b[${color}m│ ${emoji} ${title.padEnd(46)}│\x1b[0m`,
    `\x1b[${color}m├${border}┤\x1b[0m`,
    ...items.map(item => `\x1b[${color}m│\x1b[0m ${item.slice(0, 46).padEnd(46)}\x1b[${color}m│\x1b[0m`),
    `\x1b[${color}m╰${border}╯\x1b[0m`,
  ];
  return lines.join('\n');
}

// Main context formatter per CONTEXT.md decisions
function formatFullContext(context: InjectedContext): string {
  const sections: string[] = [];
  
  // 📋 Previous Context header
  sections.push(formatContextSection(
    'Previous Context',
    '📋',
    ['From your opencode-brain memory'],
    '38;5;141' // Light purple
  ));
  
  // 🎯 Key Decisions
  if (context.keyDecisions.length > 0) {
    sections.push(formatContextSection(
      'Key Decisions',
      '🎯',
      context.keyDecisions.slice(0, 5),
      '38;5;75' // Blue
    ));
  }
  
  // 📝 Recent Changes
  if (context.recentChanges.length > 0) {
    sections.push(formatContextSection(
      'Recent Changes',
      '📝',
      context.recentChanges.slice(0, 5),
      '38;5;78' // Green
    ));
  }
  
  // ⚠️ Open Issues
  if (context.openIssues.length > 0) {
    sections.push(formatContextSection(
      'Open Issues',
      '⚠️',
      context.openIssues.slice(0, 3),
      '38;5;214' // Orange
    ));
  }
  
  // — From memory — divider
  sections.push('\n\x1b[38;5;245m— From opencode-brain memory —\x1b[0m\n');
  
  return sections.join('\n\n');
}
```

### Pattern 5: Agent Type Detection
**What:** Detect whether current agent is 'plan' or 'build'
**When to use:** For agent-specific weighting (INJ-04)
**Confidence:** LOW (requires SDK verification - not found in codebase)

```typescript
// AGENT TYPE DETECTION - REQUIRES VERIFICATION
// The SDK may provide agent info in session or context

// Approach 1: From session object (VERIFY WITH SDK)
function detectAgentType(session: any): 'plan' | 'build' {
  // Hypothesis: session.agent or session.type might contain this
  if (session.agent?.type) {
    return session.agent.type === 'plan' ? 'plan' : 'build';
  }
  
  // Fallback: Default to unified approach
  return 'build'; // Default to build (most permissive)
}

// Approach 2: Store agent type in observation metadata
// Each observation should be tagged with agentType during capture
// This is already decided in CONTEXT.md: "Track agent type on every observation"
```

### Anti-Patterns to Avoid
- **Don't hard-truncate context:** Always summarize, never cut mid-sentence (INJ-03 requirement)
- **Don't inject raw memory dumps:** Format and contextualize before injection (from PITFALLS.md)
- **Don't block on context loading:** Show loading indicator only if >500ms (CONTEXT.md)
- **Don't differentiate Build/Plan contexts:** Unified memory approach per locked decision
- **Don't auto-compress in background:** Only during session.compacting (CONTEXT.md)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Character-based estimation | Simple heuristic (4 chars ≈ 1 token) | Accurate enough, no API needed |
| Text compression | LLM-based summarization | Recency-based filtering + truncation | Faster, deterministic, sufficient |
| Relevance scoring | ML model | Weighted algorithm (documented above) | Deterministic, fast, debuggable |
| ANSI colors | Manual escape codes | Template functions with constants | Maintainable, testable |

**Key insight:** Context injection doesn't require external libraries. The complexity is in the algorithm design (relevance scoring, compression strategy) not in the implementation dependencies.

---

## Common Pitfalls

### Pitfall 1: No Native System Prompt Modification
**What goes wrong:** Expecting SDK to provide `modifySystemPrompt()` API that doesn't exist
**Why it happens:** Different from Claude Code hooks which could modify system prompt
**How to avoid:**
- Use `session.compacting` hook to inject context (if available in SDK)
- OR prepend context to first user message
- OR use custom tool that provides memory context

**Confidence:** MEDIUM - Based on plugin.ts analysis showing no system prompt modification API

### Pitfall 2: Session ID Tracking
**What goes wrong:** Losing track of which session we're in during async operations
**Why it happens:** Plugin is long-lived, sessions come and go
**How to avoid:**
```typescript
// Track current session ID
let currentSessionId: string = "unknown";

return {
  "session.created": async ({ session }) => {
    currentSessionId = session.id;
    // Store context for this specific session
  },
  "tool.execute.after": async (input) => {
    // Use currentSessionId for metadata
  }
};
```

### Pitfall 3: Loading Too Much Context
**What goes wrong:** Injecting full history hits token limits, degrades performance
**Why it happens:** No filtering or compression
**How to avoid:**
- Default to 2000 token limit (from types.ts DEFAULT_CONFIG)
- Conservative mode: Only compress when approaching limit
- Always prioritize: decisions > errors > changes > tools

### Pitfall 4: Agent Type Detection Failure
**What goes wrong:** Can't determine if Build or Plan agent is active
**Why it happens:** SDK may not expose agent type clearly
**How to avoid:**
- Store agentType in observation metadata at capture time
- Default to unified approach (both agents see same context)
- Smart mix: Weight agent-relevant entries higher, don't exclude

**Confidence:** LOW - Requires SDK exploration during implementation

### Pitfall 5: First Message Race Condition
**What goes wrong:** User sends message before context loaded
**Why it happens:** `session.created` fires but async loading not complete
**How to avoid:**
- Load context synchronously in session.created (storage is sync)
- OR queue first message until context ready
- Show loading indicator if >500ms (per CONTEXT.md)

---

## Code Examples

### Loading Context at Session Start (Verified Pattern)
```typescript
// From existing plugin.ts pattern + requirements
"session.created": async ({ session }) => {
  currentSessionId = session.id;
  
  // Check if first session (no prior memory)
  const stats = storage.stats();
  if (stats.count === 0) {
    // Show welcome message per CONTEXT.md
    client.app.log({
      message: "🧠 No previous context found. Starting fresh.\nYour session history will be captured and available in future sessions."
    });
    return;
  }
  
  // Load recent entries (last 2-3 sessions worth)
  const recentEntries = storage.getRecent(50); // Last 50 observations
  
  // Score and filter
  const scored = recentEntries.map(entry => ({
    entry,
    score: calculateRelevance(entry, 'build', []) // Detect actual agent
  }));
  
  // Format and store for injection
  const formatted = formatFullContext({
    keyDecisions: scored.filter(s => s.entry.type === 'decision').map(s => s.entry.content),
    recentChanges: scored.filter(s => s.entry.type === 'refactor' || s.entry.type === 'feature').map(s => s.entry.content),
    openIssues: scored.filter(s => s.entry.type === 'problem' || s.entry.type === 'warning').map(s => s.entry.content),
  });
  
  // Store in session-specific cache for injection
  sessionContextCache.set(session.id, formatted);
},
```

### Token Estimation (Standard Approach)
```typescript
// Simple but effective token estimation
// Based on: ~4 characters per token for English text
function estimateTokens(text: string): number {
  // Account for Unicode (emoji, non-ASCII)
  const asciiChars = text.split('').filter(c => c.charCodeAt(0) < 128).length;
  const unicodeChars = text.length - asciiChars;
  
  // Unicode chars often count as multiple tokens
  return Math.ceil(asciiChars / 4) + (unicodeChars * 2);
}

// More accurate for code (shorter tokens)
function estimateCodeTokens(code: string): number {
  // Code has more symbols, shorter average token length
  return Math.ceil(code.length / 3.5);
}
```

### Smart Mix Priority (Per CONTEXT.md)
```typescript
// Smart mix: Recent everything + agent-relevant weighted higher
function getSmartMix(
  entries: MemoryEntry[],
  currentAgent: 'plan' | 'build',
  maxEntries: number = 20
): MemoryEntry[] {
  
  // Separate entries by relevance to current agent
  const agentRelevant: MemoryEntry[] = [];
  const otherEntries: MemoryEntry[] = [];
  
  for (const entry of entries) {
    const isRelevant = isAgentRelevant(entry, currentAgent);
    if (isRelevant) {
      agentRelevant.push(entry);
    } else {
      otherEntries.push(entry);
    }
  }
  
  // Take top agent-relevant entries first
  const result = agentRelevant.slice(0, Math.floor(maxEntries * 0.6));
  
  // Fill remainder with recent other entries
  const remainingSlots = maxEntries - result.length;
  result.push(...otherEntries.slice(0, remainingSlots));
  
  return result;
}

function isAgentRelevant(entry: MemoryEntry, agent: 'plan' | 'build'): boolean {
  const planTypes = ['decision', 'discovery', 'pattern', 'problem'];
  const buildTypes = ['refactor', 'feature', 'bugfix', 'success'];
  
  if (agent === 'plan') {
    return planTypes.includes(entry.type);
  } else {
    return buildTypes.includes(entry.type) || entry.metadata?.tool !== undefined;
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct system prompt modification | Message-based context injection | 2025 (SDK limitation) | No native system prompt API found |
| Vector similarity search | Weighted relevance scoring | This phase | Deterministic, faster, no embedding deps |
| Fixed context window | Configurable compression modes | This phase | User control over token usage |
| Separate agent memories | Unified memory with weighting | CONTEXT.md decision | Simpler, no context loss on switch |

**Open Questions:**
1. **SDK system prompt API:** Does @opencode-ai/plugin provide any system prompt modification?
   - Research attempted: Web searches failed (402 errors)
   - Current evidence: No such API in existing plugin.ts
   - Recommendation: Assume no native API, use alternative approaches

2. **Agent type detection:** How does SDK expose current agent type?
   - Research attempted: Codebase grep found no SDK-provided agent type
   - Recommendation: Store in observation metadata, detect from session if possible

3. **Session.compacting event:** Exact timing and data provided?
   - Confidence: MEDIUM - Event mentioned in research docs but details unclear
   - Recommendation: Implement with graceful fallback if not available

---

## Open Questions

1. **SDK System Prompt API**
   - What we know: Existing plugin.ts shows no system prompt modification API
   - What's unclear: Whether newer SDK versions provide this capability
   - Recommendation: Plan for message-based injection, investigate SDK during implementation

2. **Agent Type Detection**
   - What we know: CONTEXT.md requires tracking agentType in metadata
   - What's unclear: Whether SDK exposes current agent in session object
   - Recommendation: Implement metadata tagging in Phase 2 capture, use stored value

3. **Token Count Accuracy**
   - What we know: 4 chars ≈ 1 token is standard heuristic
   - What's unclear: Exact tokenization rules for Opencode's LLM
   - Recommendation: Conservative estimates (assume more tokens), configurable limits

4. **Session.compacting Hook Data**
   - What we know: Event exists per research/ARCHITECTURE.md
   - What's unclear: What data is passed to the handler
   - Recommendation: Implement with flexible input handling

---

## Sources

### Primary (HIGH confidence)
- `.planning/phases/03-context-injection/03-CONTEXT.md` - User locked decisions
- `src/plugin.ts` - Existing plugin implementation patterns
- `src/types.ts` - Type definitions including InjectedContext interface
- `.planning/research/ARCHITECTURE.md` - Opencode architecture research
- `.planning/research/PITFALLS.md` - Identified risks and mitigation strategies
- `.planning/phases/01-foundation/01-RESEARCH.md` - Storage layer patterns

### Secondary (MEDIUM confidence)
- `src/storage/sqlite-storage.ts` - Storage API surface (search, read)
- `src/storage/storage-interface.ts` - Storage interface definitions
- Training data on token estimation algorithms
- Training data on relevance scoring patterns

### Tertiary (LOW confidence - marked for validation)
- @opencode-ai/plugin SDK capabilities beyond what's in codebase
- Exact agent type detection mechanism
- Session.compacting event payload structure
- Token per character ratios for non-English text

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified from existing codebase
- Architecture patterns: MEDIUM-HIGH - Based on verified SDK patterns + training knowledge
- Pitfalls: MEDIUM - Some based on documented risks, some hypothesized
- Code examples: MEDIUM - Mix of verified patterns and recommended implementations

**Research date:** 2026-02-03
**Valid until:** 30 days (stable APIs, but SDK may have undocumented features)

**Researcher notes:**
- Web searches for SDK documentation failed (402 errors)
- Context7 queries would be ideal for @opencode-ai/plugin SDK details
- Key uncertainty: Whether SDK provides system prompt modification API
- Recommendation: Plan for message-based injection with SDK investigation task
- Locked decisions from CONTEXT.md are prescriptive - honor these in planning

**Next Steps for Implementation:**
1. Verify SDK API during implementation (check for modifySystemPrompt or equivalent)
2. Implement agent type detection (store in Phase 2, use here)
3. Test token estimation against actual Opencode behavior
4. Validate relevance scoring weights with real usage
