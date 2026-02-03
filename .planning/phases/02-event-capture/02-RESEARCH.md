# Phase 2: Event Capture Research

**Research Date:** 2025-02-03  
**Phase:** 02 — Event Capture  
**Goal:** Research implementation patterns for transparent session activity capture

---

## 1. Opencode Plugin Event Hooks

### Available Event Hooks

Based on the @opencode-ai/plugin SDK (as observed in Phase 1 implementation):

| Hook | Timing | Input Data | Use Case |
|------|--------|------------|----------|
| `session.created` | Session start | `{ session: { id: string } }` | Initialize context, load history |
| `tool.execute.after` | After tool completes | `{ tool: string, sessionID: string, callID: string, args?: Record<string, any> }` | Capture tool usage |
| `file.edited` | File modified | `{ filePath: string }` | Track file changes |
| `session.deleted` | Session ends | `{}` | Cleanup, close storage |
| `session.error` | Error occurs | (SDK-specific) | Error tracking |

### Event Handler Pattern

```typescript
// Synchronous storage operations (bun:sqlite)
"tool.execute.after": async (input) => {
  // Event capture logic here
  // No await needed for storage.write() - it's synchronous
}
```

**Critical:** All storage operations are SYNCHRONOUS with bun:sqlite.

---

## 2. Event Buffering Patterns

### Pattern: In-Memory Buffer with Periodic Flush

**Why:** Writing to SQLite on every event causes performance degradation. Batch writes are 10-100x more efficient.

**Implementation Approach:**

```typescript
// Buffer structure
interface EventBuffer {
  entries: MemoryEntry[];
  lastFlush: number;
  maxSize: number;      // Flush when buffer reaches this size
  flushInterval: number; // Flush every N milliseconds
}

// Flush strategy
if (buffer.entries.length >= maxSize || 
    Date.now() - buffer.lastFlush >= flushInterval) {
  flushBuffer();
}
```

**Recommended Settings:**
- Buffer size: 10-50 entries (depending on event frequency)
- Flush interval: 5000ms (5 seconds)
- Force flush on session.end to prevent data loss

### Don't Hand-Roll

**Use:** Simple array + setInterval pattern  
**Don't use:** Complex async queues, RxJS, or event emitters for this use case

---

## 3. Privacy Filtering Strategies

### Secret Detection Patterns

```typescript
// Password/secret patterns to filter
const SENSITIVE_PATTERNS = [
  /password\s*[:=]\s*[^\s]+/gi,           // password: value
  /api[_-]?key\s*[:=]\s*[^\s]+/gi,       // api_key: value
  /secret\s*[:=]\s*[^\s]+/gi,            // secret: value
  /token\s*[:=]\s*[^\s]+/gi,             // token: value
  /-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/,
  /[a-zA-Z0-9_]*password[a-zA-Z0-9_]*\s*[=:]\s*["']?[^"'\s]+["']?/gi,
];

// Redaction function
function sanitizeContent(content: string): string {
  let sanitized = content;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}
```

### File Exclusions

**Never capture:**
- `.env` files (all variations: `.env.local`, `.env.production`, etc.)
- Files in `.git/` directory
- Files with extensions: `.key`, `.pem`, `.p12`, `.pfx`
- Files matching: `*secret*`, `*password*`, `*credential*`, `*token*` (case insensitive)

```typescript
const EXCLUDED_PATTERNS = [
  /\.env/,
  /\.git\//,
  /\.(key|pem|p12|pfx)$/,
  /secret/i,
  /password/i,
  /credential/i,
  /token/i,
];

function shouldCaptureFile(filePath: string): boolean {
  return !EXCLUDED_PATTERNS.some(pattern => pattern.test(filePath));
}
```

### Bash Command Filtering

**Redact entire bash commands containing:**
- `curl` with `-u` or `--user`
- `ssh` with passwords
- `mysql`, `psql` with `-p` or `--password`
- Any command with patterns matching secret detection

```typescript
function sanitizeBashCommand(command: string): string | null {
  // Check for sensitive patterns
  if (SENSITIVE_PATTERNS.some(p => p.test(command))) {
    return '[REDACTED BASH COMMAND]';
  }
  
  // Check for auth flags
  if (/curl.*-u\s|curl.*--user/.test(command)) {
    return '[REDACTED BASH COMMAND]';
  }
  
  return command;
}
```

---

## 4. Performance Optimization

### Bun-Specific Considerations

**bun:sqlite characteristics:**
- Synchronous API (no async/await)
- WAL mode handles concurrency automatically
- 3-6x faster than better-sqlite3 for typical operations
- Minimal overhead for batched writes

### Benchmark Targets (INST-05)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Event capture latency | <1ms per event | Time from event to buffer add |
| Flush latency | <50ms | Time to write batch to SQLite |
| Memory overhead | <10MB | Buffer + metadata |
| CPU impact | <5% | Relative to baseline Opencode |

### Testing Strategy

```typescript
// Performance test pattern
const start = performance.now();
for (let i = 0; i < 1000; i++) {
  captureEvent({ type: 'test', content: 'benchmark' });
}
const elapsed = performance.now() - start;
console.log(`1000 events: ${elapsed}ms (${elapsed/1000}ms per event)`);
```

---

## 5. Event Type Mapping

### tool.execute.after → MemoryEntry

```typescript
function toolEventToMemoryEntry(input: ToolExecuteInput): MemoryEntry {
  const content = sanitizeToolContent(input.tool, input.args);
  
  return {
    id: generateUUID(),
    type: determineObservationType(input.tool),
    content,
    createdAt: Date.now(),
    metadata: {
      sessionId: input.sessionID,
      tool: input.tool,
      summary: `${input.tool} executed`,
      // Tool-specific metadata extraction
      files: extractFilesFromArgs(input.args),
    },
  };
}

function determineObservationType(tool: string): ObservationType {
  const typeMap: Record<string, ObservationType> = {
    'search': 'discovery',
    'read': 'discovery',
    'write': 'solution',
    'edit': 'refactor',
    'bash': 'solution',
    'glob': 'discovery',
  };
  return typeMap[tool] || 'pattern';
}
```

### file.edited → MemoryEntry

```typescript
function fileEditToMemoryEntry(input: FileEditInput): MemoryEntry | null {
  if (!shouldCaptureFile(input.filePath)) {
    return null; // Skip excluded files
  }
  
  return {
    id: generateUUID(),
    type: 'refactor',
    content: `File modified: ${input.filePath}`,
    createdAt: Date.now(),
    metadata: {
      files: [input.filePath],
      summary: `Edited ${path.basename(input.filePath)}`,
    },
  };
}
```

---

## 6. Common Pitfalls

### Pitfall 1: Async Storage Writes

**Wrong:**
```typescript
await storage.write(id, entry); // bun:sqlite is sync!
```

**Right:**
```typescript
storage.write(id, entry); // Direct call, no await
```

### Pitfall 2: Writing on Every Event

**Problem:** SQLite transaction overhead per event kills performance.

**Solution:** Always buffer and batch writes.

### Pitfall 3: Missing Flush on Session End

**Problem:** Buffer never flushed if session ends before flush interval.

**Solution:** Force flush in `session.deleted` handler.

### Pitfall 4: Storing Secrets

**Problem:** .env files or passwords captured in tool output.

**Solution:** Aggressive pre-storage filtering + file exclusion.

### Pitfall 5: Memory Leaks

**Problem:** Buffer grows unbounded if flush fails.

**Solution:** Max buffer size cap with emergency flush.

---

## 7. Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Opencode Events                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │tool.execute │  │ file.edited │  │session.error│ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
└─────────┼────────────────┼────────────────┼─────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────┐
│              Event Capture Handler                   │
│  ┌───────────────────────────────────────────────┐ │
│  │ 1. Sanitize (remove secrets)                  │ │
│  │ 2. Filter (exclude .env, secrets)            │ │
│  │ 3. Transform (to MemoryEntry)                │ │
│  └────────────────┬────────────────────────────────┘ │
└─────────────────┼──────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│              In-Memory Buffer                        │
│  ┌───────────────────────────────────────────────┐ │
│  │ Array<MemoryEntry>                            │ │
│  │ • Max size: 50 entries                        │ │
│  │ • Flush interval: 5000ms                      │ │
│  │ • Force flush on session.end                  │ │
│  └────────────────┬────────────────────────────────┘ │
└─────────────────┼──────────────────────────────────┘
                  │
       ┌──────────┴──────────┐
       │                     │
       ▼                     ▼
┌─────────────┐    ┌──────────────────┐
│ 5s Interval │    │ Buffer full (50)   │
│   Flush     │    │   Flush            │
└──────┬──────┘    └─────────┬──────────┘
       │                     │
       └──────────┬──────────┘
                  ▼
┌─────────────────────────────────────────────────────┐
│              bun:sqlite Storage                      │
│  ┌───────────────────────────────────────────────┐ │
│  │ • Synchronous writes                           │ │
│  │ • WAL mode concurrency                         │ │
│  │ • .opencode/mind.mv2                           │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 8. Implementation Checklist

- [ ] Event buffer with max size and time-based flush
- [ ] Secret detection patterns (passwords, API keys, tokens)
- [ ] File exclusion patterns (.env, .git, secrets)
- [ ] Bash command sanitization
- [ ] Tool event → MemoryEntry mapping
- [ ] File edit event → MemoryEntry mapping
- [ ] Session end force-flush
- [ ] Performance benchmarking (<5% overhead)
- [ ] Error handling (never crash Opencode)

---

**Research Status:** Complete  
**Next Step:** Create detailed PLAN.md files for implementation
