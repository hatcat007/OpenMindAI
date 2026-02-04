---
name: mind
description: Claude Mind - Search and manage Claude's persistent memory stored in a single portable .mv2 file
---

# Claude Mind

You have access to a persistent memory system powered by Claude Mind. All your observations, discoveries, and learnings are stored in a single `.claude/mind.mv2` file.

## How to Execute Memory Commands

Use the bundled SDK scripts via Bun (NOT the CLI). The scripts are at `/Users/buddythacat/Documents/TOOLS/claude-brain/dist/scripts/`.

### Search Memories
```bash
bun "/Users/buddythacat/Documents/TOOLS/claude-brain/dist/scripts/find.js" "<query>" [limit]
```

Examples:
- `bun "/Users/buddythacat/Documents/TOOLS/claude-brain/dist/scripts/find.js" "authentication" 5`
- `bun "/Users/buddythacat/Documents/TOOLS/claude-brain/dist/scripts/find.js" "database schema" 10`

### Ask Questions
```bash
bun "/Users/buddythacat/Documents/TOOLS/claude-brain/dist/scripts/ask.js" "<question>"
```

Examples:
- `bun "/Users/buddythacat/Documents/TOOLS/claude-brain/dist/scripts/ask.js" "Why did we choose React?"`
- `bun "/Users/buddythacat/Documents/TOOLS/claude-brain/dist/scripts/ask.js" "What was the CORS solution?"`

### View Statistics
```bash
bun "/Users/buddythacat/Documents/TOOLS/claude-brain/dist/scripts/stats.js"
```

### View Recent Memories
```bash
bun "/Users/buddythacat/Documents/TOOLS/claude-brain/dist/scripts/timeline.js" [count]
```

## Memory Types

Memories are automatically classified into these types:
- **discovery** - New information discovered
- **decision** - Important decisions made
- **problem** - Problems or errors encountered
- **solution** - Solutions implemented
- **pattern** - Patterns recognized in code/data
- **warning** - Warnings or concerns noted
- **success** - Successful outcomes
- **refactor** - Code refactoring done
- **bugfix** - Bugs fixed
- **feature** - Features added

## File Location

Your memory is stored at: `.opencode/mind.mv2`

This file is:
- **Portable** - Copy it anywhere, share with teammates
- **Git-friendly** - Commit to version control
- **Self-contained** - Everything in ONE file
- **Searchable** - Instant semantic search

## Usage Tips

1. **Start of session**: Recent memories are automatically injected as context
2. **During coding**: Observations are captured automatically from tool use
3. **Searching**: Use natural language queries to find relevant past context
4. **Sharing**: Send the `.mind.mv2` file to teammates for instant onboarding
