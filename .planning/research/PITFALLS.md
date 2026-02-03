# Pitfalls Research: Opencode Brain

## Critical Challenges

### 1. Bun vs Node.js Compatibility ⚠️ HIGH RISK

**The Problem:**
Opencode uses Bun as its JavaScript runtime, not Node.js. While Bun has good Node.js compatibility, there are edge cases.

**Specific Risks:**
- `@memvid/sdk` uses native Rust bindings via Node-API
- Bun's Node-API support is newer and may have gaps
- File locking mechanisms may differ
- Some Node.js APIs might behave subtly differently

**Warning Signs:**
- Native module loading errors
- File corruption or locking issues
- Performance degradation
- Memory leaks

**Prevention Strategy:**
1. **Test early and thoroughly** with Bun
2. **Create test suite** that runs in both Node and Bun
3. **Have fallback** for native modules (pure JS alternative)
4. **Monitor Bun compatibility** issues on GitHub

**Phase to Address:** Phase 1 - Foundation

---

### 2. Session Injection Timing ⚠️ MEDIUM-HIGH RISK

**The Problem:**
Unlike Claude Code's explicit hooks, Opencode's `session.created` event fires at a specific time. We need to inject memory context effectively without overwhelming the context window or confusing the agent.

**Specific Risks:**
- Injecting too early: Context might be lost in system prompt
- Injecting too late: User messages already sent without context
- Too much context: Hits token limits, degrades performance
- Wrong format: Agent doesn't understand the memory

**Warning Signs:**
- Agent asks questions it should know from memory
- "I don't have context from previous sessions"
- Slow session startup
- Context window errors

**Prevention Strategy:**
1. **Use compaction hook** (`session.compacting`) instead of injection
2. **Format memory as system prompt** or user message
3. **Compress intelligently** - only inject relevant context
4. **Test with real sessions** - verify context is available

**Phase to Address:** Phase 2 - Capture & Phase 3 - Injection

---

### 3. Event Hook Overhead ⚠️ MEDIUM RISK

**The Problem:**
Capturing every tool execution (`tool.execute.after`) could add latency to every operation, degrading the user experience.

**Specific Risks:**
- Slow tool responses
- UI lag in TUI
- Excessive memory file writes
- Disk I/O bottleneck

**Warning Signs:**
- Noticeable delays between command and response
- High CPU/disk usage
- Memory file growing too fast
- User complaints about sluggishness

**Prevention Strategy:**
1. **Batch writes** - Don't write to disk on every event
2. **In-memory buffering** - Accumulate, then flush periodically
3. **Async processing** - Don't block tool execution
4. **Debouncing** - Only capture significant changes
5. **Lazy loading** - Don't load full history until needed

**Phase to Address:** Phase 2 - Capture

---

### 4. Storage Location Confusion ⚠️ MEDIUM RISK

**The Problem:**
Opencode has multiple configuration locations (global vs project, .opencode/ vs opencode.json). Users might install plugin globally but expect project-level memory, or vice versa.

**Specific Risks:**
- Memory not persisting across sessions
- Different memories in different contexts
- User confusion about where data is stored
- Git committing wrong files

**Warning Signs:**
- "Why doesn't it remember?"
- Multiple mind.mv2 files scattered
- Memory works in one project but not another
- Global config affecting all projects unexpectedly

**Prevention Strategy:**
1. **Follow Opencode conventions** - Use `.opencode/mind.mv2`
2. **Clear documentation** - Explain storage location
3. **Auto-detection** - Find correct location based on worktree
4. **Explicit configuration** - Allow override in opencode.json
5. **Git helpers** - Auto-add to .gitignore if desired

**Phase to Address:** Phase 1 - Foundation

---

### 5. Multi-Agent Context Confusion ⚠️ MEDIUM RISK

**The Problem:**
Opencode has Build (full access) and Plan (read-only) agents. They might have different needs for memory access.

**Specific Risks:**
- Plan agent trying to access memory it shouldn't
- Build agent missing context because Plan was used
- Different agents seeing different contexts
- Memory pollution from agent switching

**Warning Signs:**
- "I don't have that information" after agent switch
- Inconsistent behavior between Build and Plan
- Context seems to disappear

**Prevention Strategy:**
1. **Agent-aware storage** - Tag memories by agent type
2. **Shared core memory** - Base context available to all
3. **Agent-specific extensions** - Each agent can add its own
4. **Clear merging** - Combine contexts intelligently

**Phase to Address:** Phase 3 - Injection

---

### 6. Plugin Distribution Complexity ⚠️ MEDIUM RISK

**The Problem:**
Distributing as an npm package vs local files vs GitHub install creates confusion about installation method.

**Specific Risks:**
- Users don't know how to install
- Version mismatch between plugin and Opencode
- Dependency resolution issues
- Plugin not loading after update

**Warning Signs:**
- Installation issues reported
- "Plugin not found" errors
- Version compatibility questions
- Update breaks existing installs

**Prevention Strategy:**
1. **Official npm package** - `opencode-brain`
2. **Clear install instructions** - Multiple methods documented
3. **Version constraints** - Specify compatible Opencode versions
4. **Auto-updater** - Check for updates, notify user
5. **One-line installer** - Script that handles everything

**Phase to Address:** Phase 1 - Foundation (packaging)

---

### 7. Memory Format Compatibility ⚠️ LOW-MEDIUM RISK

**The Problem:**
The `.mv2` file format from `@memvid/sdk` should be compatible, but we need to verify.

**Specific Risks:**
- Format changes in SDK
- Bun vs Node file serialization differences
- Corruption during transfer between systems
- Migration from claude-brain format issues

**Warning Signs:**
- "Cannot read memory file" errors
- Corrupted data
- Migration failures
- Format version mismatches

**Prevention Strategy:**
1. **Verify SDK compatibility** - Test with Bun early
2. **Format versioning** - Include version in file
3. **Backup on migration** - Don't overwrite, create new
4. **Validation on load** - Check integrity before use
5. **Migration tool** - Provide explicit import command

**Phase to Address:** Phase 1 - Foundation

---

### 8. Context Privacy Leaks ⚠️ LOW RISK (but critical)

**The Problem:**
If not careful, memory could capture sensitive information (passwords, API keys, .env files) and store them in the memory file.

**Specific Risks:**
- Secrets captured in tool outputs
- File contents accidentally stored
- User passwords in bash command history
- API keys in error messages

**Warning Signs:**
- Secrets in mind.mv2
- Accidental exposure in git commits
- Security vulnerability reports

**Prevention Strategy:**
1. **Secret filtering** - Detect and exclude secrets
2. **Respect .env** - Never capture .env files
3. **User confirmation** - Ask before capturing sensitive data
4. **Content filtering** - Exclude password/key patterns
5. **Audit mode** - Show what will be captured before save

**Phase to Address:** Phase 2 - Capture

---

## Implementation Pitfalls

### Don't: Use Synchronous File Operations

**Why:** Blocks the event loop, degrades Opencode performance

**Do:** Use async/await for all file operations

---

### Don't: Capture Everything

**Why:** Memory file becomes huge, context window overflow

**Do:** Smart filtering - only capture meaningful context

---

### Don't: Inject Raw Memory

**Why:** Confuses the agent, wastes tokens on irrelevant info

**Do:** Summarize and contextualize before injection

---

### Don't: Block on Errors

**Why:** Plugin failure shouldn't break Opencode

**Do:** Silent fail, log errors, continue gracefully

---

### Don't: Assume File System State

**Why:** File might be locked, missing, or corrupted

**Do:** Always check, validate, and handle errors

---

## Testing Pitfalls

### Don't: Test Only in Isolation

**Why:** Plugin might break in real Opencode environment

**Do:** Test with actual Opencode running

---

### Don't: Skip Edge Cases

**Why:** Large projects, long sessions, corrupted files happen

**Do:** Test with extreme conditions

---

### Don't: Ignore Performance

**Why:** User will uninstall if Opencode becomes slow

**Do:** Benchmark tool execution with/without plugin

---

## Which Phase Should Address Each?

| Pitfall | Phase | Priority |
|---------|-------|----------|
| Bun compatibility | 1 - Foundation | CRITICAL |
| Event overhead | 2 - Capture | HIGH |
| Storage location | 1 - Foundation | HIGH |
| Distribution | 1 - Foundation | MEDIUM |
| Format compatibility | 1 - Foundation | MEDIUM |
| Session injection | 3 - Injection | MEDIUM |
| Multi-agent | 3 - Injection | MEDIUM |
| Privacy leaks | 2 - Capture | MEDIUM |

## Early Warning System

**Set up monitoring for:**

1. **Error rates** - Plugin errors shouldn't be frequent
2. **Performance metrics** - Tool execution latency
3. **Memory file size** - Shouldn't grow unbounded
4. **User feedback** - Watch for confusion reports

**Red flags that need immediate attention:**
- Memory not persisting across sessions
- Opencode becoming sluggish with plugin enabled
- Memory file corruption errors
- User reports of missing context
