# Codebase Concerns

**Analysis Date:** 2026-02-03

## Tech Debt

**Unimplemented Core Features:**
- Issue: Multiple TODO comments indicate incomplete functionality in `src/core/mind.ts`
- Files: `src/core/mind.ts` (lines 329, 347, 379, 383)
- Impact: 
  - Session summaries not implemented (line 329) - `getContext()` returns empty array
  - Observation count not tracked (line 347) - `saveSessionSummary()` always sets to 0
  - Unique session counting not implemented (line 379) - `stats()` always returns 0
  - Top observation types aggregation missing (line 383) - returns empty object
- Fix approach: Implement proper tracking and aggregation logic, store session metadata in memvid frames

**Type Safety Compromises:**
- Issue: Extensive use of `any` type, especially around SDK imports and memvid instances
- Files: 
  - `src/core/mind.ts` (lines 10, 64-66, 92, 247, 287, 380)
  - `src/scripts/ask.ts` (line 66)
  - `src/scripts/find.ts`, `src/scripts/stats.ts`, `src/scripts/timeline.ts` (similar patterns)
- Impact: Loss of type safety, potential runtime errors, harder refactoring
- Fix approach: Create proper TypeScript interfaces for SDK types, use type guards for SDK responses

**Workaround for Claude Code Bug:**
- Issue: PostToolUse hook doesn't fire for Edit operations, requiring workaround in stop hook
- Files: `src/hooks/stop.ts` (lines 9, 25-30, 31-159)
- Impact: File changes must be captured via git diff at session end, less reliable than real-time capture
- Fix approach: Monitor Claude Code updates, remove workaround when bug is fixed upstream

## Known Bugs

**Silent Error Handling:**
- Issue: Many catch blocks silently ignore errors without logging or reporting
- Files: 
  - `src/core/mind.ts` (lines 52-54, 56-58, 139, 160-161)
  - `src/hooks/smart-install.ts` (lines 30-32, 40-42)
  - `src/hooks/post-tool-use.ts` (line 186)
- Symptoms: Failures occur silently, making debugging difficult
- Trigger: File system errors, backup operations, dependency installation failures
- Workaround: Enable debug mode (`MEMVID_MIND_DEBUG=1`) for some visibility

**File Corruption Detection Fragility:**
- Issue: Corruption detection relies on string matching error messages from SDK
- Files: `src/core/mind.ts` (lines 149-155)
- Symptoms: May miss corruption cases if SDK error messages change
- Trigger: SDK updates that change error message format
- Workaround: Manual file deletion and recreation

**Deduplication Cache Growth:**
- Issue: In-memory deduplication cache in post-tool-use hook could theoretically grow unbounded
- Files: `src/hooks/post-tool-use.ts` (lines 42-68)
- Symptoms: Memory usage increases over long sessions
- Trigger: Many unique tool invocations within deduplication window
- Workaround: Cache cleanup exists but only runs when size > 100, could be improved

## Security Considerations

**Command Injection Risk:**
- Issue: `execSync` calls use environment variables and user-controlled paths without sanitization
- Files: 
  - `src/hooks/smart-install.ts` (lines 78, 91)
  - `src/hooks/stop.ts` (lines 43, 50, 58, 65)
  - `src/scripts/*.ts` (multiple execSync calls)
- Risk: If `CLAUDE_PLUGIN_ROOT` or `CLAUDE_PROJECT_DIR` are compromised, arbitrary commands could execute
- Current mitigation: Commands are hardcoded, but paths come from env vars
- Recommendations: 
  - Validate and sanitize all paths before use
  - Use `path.resolve()` and check paths don't escape expected directories
  - Consider using `child_process.spawn` with explicit argument arrays instead of shell commands

**File System Operations:**
- Issue: File operations use paths from environment variables without comprehensive validation
- Files: `src/core/mind.ts` (lines 113-114, 398-399), `src/scripts/utils.ts` (lines 72-95)
- Risk: Path traversal attacks if env vars contain malicious paths
- Current mitigation: Uses `resolve()` but doesn't validate against expected directories
- Recommendations: Add path validation to ensure files stay within project directory

**Dynamic SDK Import:**
- Issue: SDK is dynamically imported without version pinning in runtime
- Files: `src/core/mind.ts` (line 70), `src/scripts/*.ts` (multiple locations)
- Risk: SDK updates could introduce breaking changes or vulnerabilities
- Current mitigation: Version specified in package.json, but dynamic import bypasses some checks
- Recommendations: Consider version validation at runtime, or use static imports with proper error handling

## Performance Bottlenecks

**Large File Size Check:**
- Issue: File size check uses synchronous `statSync` which blocks event loop
- Files: `src/core/mind.ts` (lines 132-134)
- Problem: On very large filesystems or slow I/O, this could cause noticeable delays
- Cause: Synchronous file system call during initialization
- Improvement path: Use async `stat()` or move to background check

**Compression Algorithm Complexity:**
- Issue: Compression logic in `src/utils/compression.ts` is large (~430 lines) with multiple regex operations
- Files: `src/utils/compression.ts`
- Problem: Could be slow for very large tool outputs
- Cause: Multiple passes over content, regex matching, string operations
- Improvement path: Profile and optimize hot paths, consider streaming for very large inputs

**Git Operations at Session End:**
- Issue: Multiple `execSync` git commands run sequentially at session end
- Files: `src/hooks/stop.ts` (lines 43-65)
- Problem: Can delay session termination, especially in large repos
- Cause: Synchronous execution of multiple git commands
- Improvement path: Parallelize git commands, add better timeout handling, cache results

## Fragile Areas

**SDK Response Shape Handling:**
- Issue: Code assumes SDK returns either array or `{ frames: [...] }` but handles both inconsistently
- Files: `src/core/mind.ts` (lines 284, 374-375)
- Why fragile: SDK API changes could break assumptions, type checking is minimal
- Safe modification: Add type guards and explicit handling for each response shape
- Test coverage: Limited - only basic lock tests exist

**Timestamp Conversion Logic:**
- Issue: Timestamp conversion assumes seconds if < 4102444800, milliseconds otherwise
- Files: `src/core/mind.ts` (lines 289-293)
- Why fragile: Magic number threshold, assumes SDK behavior won't change
- Safe modification: Use SDK metadata to determine timestamp format, or standardize on one format
- Test coverage: None - no tests for timestamp handling

**Backup File Pruning:**
- Issue: Backup file pruning uses regex matching and file system operations without error handling
- Files: `src/core/mind.ts` (lines 31-59)
- Why fragile: File system errors could cause issues, regex could match wrong files
- Safe modification: Add comprehensive error handling, validate backup file names more strictly
- Test coverage: None

**Compression Tool-Specific Logic:**
- Issue: Compression has hardcoded logic for specific tool names
- Files: `src/utils/compression.ts` (lines 31-50)
- Why fragile: New tool types won't be compressed optimally, tool name changes break logic
- Safe modification: Make compression extensible via configuration or plugin system
- Test coverage: None

## Scaling Limits

**In-Memory Deduplication Cache:**
- Issue: Cache grows with unique tool invocations, cleanup only runs when size > 100
- Files: `src/hooks/post-tool-use.ts` (lines 42-68)
- Current capacity: ~100 entries before cleanup
- Limit: Memory usage grows linearly with unique tool calls
- Scaling path: Use LRU cache with fixed size, or move to persistent storage for long sessions

**Memory File Size:**
- Issue: Hard limit of 100MB before file is considered corrupted
- Files: `src/core/mind.ts` (line 122)
- Current capacity: 100MB memory file
- Limit: Files over 100MB trigger recreation, losing all memory
- Scaling path: Increase threshold or implement file rotation/archival strategy

**Context Token Limits:**
- Issue: Hard-coded token limits for context injection
- Files: `src/types.ts` (lines 81-82), `src/core/mind.ts` (line 321)
- Current capacity: 2000 tokens, 20 observations max
- Limit: May truncate important context in large codebases
- Scaling path: Make limits configurable, implement smarter selection algorithm

## Dependencies at Risk

**@memvid/sdk Dependency:**
- Issue: External SDK dependency with potential breaking changes
- Files: `package.json` (line 47)
- Risk: SDK updates could break functionality, version is pinned with `^` allowing minor updates
- Impact: Memory operations could fail, corruption handling could break
- Migration plan: Monitor SDK releases, test updates in staging, consider pinning exact version for stability

**proper-lockfile Dependency:**
- Issue: File locking library, critical for concurrent access safety
- Files: `package.json` (line 48), `src/utils/memvid-lock.ts`
- Risk: Locking bugs could cause data corruption or deadlocks
- Impact: Memory file corruption, lost observations
- Migration plan: Test lock behavior thoroughly, consider alternatives if issues arise

## Missing Critical Features

**Session Summary Implementation:**
- Problem: Session summaries are stubbed but not actually generated or stored
- Files: `src/core/mind.ts` (lines 338-362)
- Blocks: Cannot provide session-level context in future sessions, only individual observations

**Observation Type Aggregation:**
- Problem: Stats don't show distribution of observation types
- Files: `src/core/mind.ts` (line 383)
- Blocks: Cannot analyze what types of activities are most common

**Unique Session Tracking:**
- Problem: Cannot count how many distinct sessions have occurred
- Files: `src/core/mind.ts` (line 379)
- Blocks: Stats are incomplete, cannot measure usage over time

## Test Coverage Gaps

**Core Mind Functionality:**
- What's not tested: Most `Mind` class methods (remember, search, ask, getContext, stats)
- Files: `src/core/mind.ts`
- Risk: Memory operations could fail silently, corruption handling untested
- Priority: High

**Compression Logic:**
- What's not tested: All compression functions for different tool types
- Files: `src/utils/compression.ts`
- Risk: Compression could lose critical information or fail on edge cases
- Priority: Medium

**Hook Error Handling:**
- What's not tested: Error paths in all hooks, especially smart-install and stop hooks
- Files: `src/hooks/*.ts`
- Risk: Hooks could fail silently, blocking Claude Code functionality
- Priority: High

**File Corruption Recovery:**
- What's not tested: Corruption detection and recovery logic
- Files: `src/core/mind.ts` (lines 144-167), `src/scripts/utils.ts`
- Risk: Corrupted files could cause data loss or hang the system
- Priority: High

**Concurrent Access:**
- What's tested: Basic concurrent writes (in `mind-lock.test.ts`)
- What's not tested: Concurrent reads, mixed read/write scenarios, lock timeout behavior
- Files: `src/utils/memvid-lock.ts`
- Risk: Race conditions could cause data loss
- Priority: Medium

---

*Concerns audit: 2026-02-03*
