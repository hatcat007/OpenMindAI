# Testing Patterns

**Analysis Date:** 2026-02-03

## Test Framework

**Runner:**
- Vitest 3.0.0
- Config: No explicit config file detected (uses defaults)

**Assertion Library:**
- Vitest built-in `expect` API

**Run Commands:**
```bash
npm test              # Run all tests (vitest run)
```

## Test File Organization

**Location:**
- Co-located in `src/__tests__/` directory
- Separate from source files

**Naming:**
- Pattern: `*.test.ts`
- Examples: `index.test.ts`, `mind-lock.test.ts`

**Structure:**
```
src/
├── __tests__/
│   ├── index.test.ts
│   └── mind-lock.test.ts
├── core/
├── hooks/
└── ...
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from "vitest";

describe("Suite Name", () => {
  it("should do something", async () => {
    // test implementation
    expect(actual).toBe(expected);
  });
});
```

**Patterns:**
- Use `describe` blocks to group related tests
- Use `it` for individual test cases
- Tests are async by default when needed
- Setup: Create temporary resources at test start
- Teardown: Clean up in `finally` blocks
- Assertion: Use Vitest `expect` API

## Mocking

**Framework:** Vitest built-in mocking

**Patterns:**
- No explicit mocking patterns detected in current tests
- Tests use real file system operations with temporary directories

**What to Mock:**
- External API calls (if any)
- File system operations (when testing logic without I/O)

**What NOT to Mock:**
- Core functionality being tested
- File system operations when testing file handling logic

## Fixtures and Factories

**Test Data:**
```typescript
function makeTempMemoryPath(): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "claude-brain-lock-"));
  return { dir, path: join(dir, "mind.mv2") };
}

async function writeOnce(memoryPath: string, i: number): Promise<void> {
  const mind = await Mind.open({ memoryPath, debug: false });
  await mind.remember({
    type: "discovery",
    summary: `summary-${i}`,
    content: `content-${i}`,
  });
}
```

**Location:**
- Helper functions defined within test files
- Temporary directories created using `node:os/tmpdir` and `node:fs/mkdtempSync`

## Coverage

**Requirements:** Not enforced

**View Coverage:**
```bash
# Coverage command not configured in package.json
```

## Test Types

**Unit Tests:**
- Scope: Individual functions and modules
- Approach: Test exports and core functionality
- Example: `src/__tests__/index.test.ts` tests default config exports

**Integration Tests:**
- Scope: File system operations, concurrent access patterns
- Approach: Use temporary directories, test real file I/O
- Example: `src/__tests__/mind-lock.test.ts` tests concurrent memory writes

**E2E Tests:**
- Not used

## Common Patterns

**Async Testing:**
```typescript
it("should handle async operations", async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});
```

**Error Testing:**
```typescript
// Pattern not explicitly shown in current tests
// Use expect().toThrow() or expect().rejects.toThrow() for error cases
```

**File System Testing:**
```typescript
it("writes all frames in the happy path", async () => {
  const { dir, path } = makeTempMemoryPath();
  try {
    // Test operations
    const writes = 5;
    for (let i = 0; i < writes; i++) {
      await writeOnce(path, i);
    }
    
    const mind = await Mind.open({ memoryPath: path, debug: false });
    const stats = await mind.stats();
    expect(stats.totalObservations).toBe(writes);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

**Concurrent Testing:**
```typescript
it("preserves all frames with concurrent writers", async () => {
  const { dir, path } = makeTempMemoryPath();
  try {
    const writes = 20;
    const tasks = Array.from({ length: writes }, (_, i) => writeOnce(path, i));
    const results = await Promise.allSettled(tasks);
    
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length) {
      throw failed[0].reason;
    }
    
    // Verify results
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 15000); // Custom timeout for longer tests
```

**Cleanup Pattern:**
- Always use `try/finally` blocks for resource cleanup
- Remove temporary directories/files in `finally` block
- Use `rmSync(dir, { recursive: true, force: true })` for cleanup
- See: `src/__tests__/mind-lock.test.ts`

**Timeout Configuration:**
- Default timeout used for most tests
- Custom timeout specified as third argument to `it()` for longer operations
- Example: `it("test name", async () => {...}, 15000)` for 15-second timeout

---

*Testing analysis: 2026-02-03*
