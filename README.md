# Opencode Brain

Memory persistence for Opencode. Remember everything across sessions without user effort.

## Features

- ✨ **Automatic memory capture** — Tool use, file changes, errors, and decisions
- 🔍 **Search memories** — `/mind search <query>` finds relevant context
- 📊 **View statistics** — `/mind stats` shows memory overview
- 💬 **Natural language queries** — `/mind ask <question>` for intelligent answers
- 🔒 **100% local storage** — No cloud, no external APIs
- ⚡ **Zero configuration** — Works out of the box after installation

## Installation

```bash
npm install opencode-brain
```

Add to your `opencode.json`:

```json
{
  "plugin": ["opencode-brain"]
}
```

The plugin auto-initializes on first run — no additional configuration needed.

## Quick Start

After installation, Opencode will automatically:
1. Create `.opencode/mind.mv2` on first run (SQLite storage)
2. Capture session context, tool executions, and file changes
3. Inject relevant memories into new sessions
4. Make context available for natural queries

## Commands

Once installed, use these slash commands in Opencode:

- `/mind stats` — Show memory statistics (entries, sessions, size)
- `/mind search <query>` — Search memories for keywords
- `/mind ask <question>` — Query with natural language
- `/mind recent` — Show recent session activity
- `/mind timeline` — View chronological session history
- `/mind import` — Import from claude-brain (migration)

## Configuration

The plugin works out of the box with sensible defaults. Configuration can be controlled via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCODE_BRAIN_STORAGE_PATH` | `.opencode/mind.mv2` | Path to SQLite database file |
| `OPENCODE_BRAIN_DEBUG` | `false` | Enable debug logging (`true` or `false`) |

### Storage Location

By default, memories are stored in `.opencode/mind.mv2` (SQLite format) within your project directory.

**Important:** Add this to your `.gitignore`:

```
.opencode/mind.mv2
.opencode/mind.mv2.lock
.opencode/mind.mv2-shm
.opencode/mind.mv2-wal
```

The storage file contains:
- Session metadata and context
- Tool execution history
- File change tracking
- Error patterns and solutions
- User decisions and preferences

## Privacy & Security

- **100% local** — All data stored in your project directory
- **No external APIs** — No cloud services or network calls
- **Sensitive data filtering** — Passwords, `.env` files, and secrets are excluded
- **User control** — You control what gets captured and when to reset

## Architecture

Opencode Brain consists of:

1. **Storage Layer** — Bun-native SQLite with bun:sqlite
2. **Plugin Interface** — @opencode-ai/plugin SDK integration
3. **Event Handlers** — Capture tool.execute.after, file.edited, session.error
4. **Context Injection** — Load relevant memories at session start
5. **Commands** — User-facing slash commands for memory interaction

## Development Setup

For contributors and developers:

```bash
# Clone the repository
git clone https://github.com/your-org/opencode-brain.git
cd opencode-brain

# Install dependencies
bun install

# Run tests
bun test

# Build
bun run build

# Watch mode for development
bun run dev
```

### Project Structure

```
src/
├── index.ts          # Plugin entry point
├── plugin.ts         # @opencode-ai/plugin integration
├── config.ts         # Configuration handling
├── storage/          # SQLite storage layer
│   ├── index.ts
│   ├── database.ts
│   └── schema.ts
├── hooks/            # Event handlers
│   ├── session.ts
│   └── tool.ts
└── commands/         # Slash command implementations
    ├── stats.ts
    ├── search.ts
    └── ask.ts
```

## Requirements

- **Bun** >= 1.0.0 (required, Opencode's runtime)
- **Opencode** >= 1.0.0
- **@opencode-ai/plugin** >= 1.0.0 (peer dependency)

## Migration from claude-brain

If you're migrating from claude-brain, use the import command:

```bash
# In Opencode
/mind import
```

This will migrate your `.claude/mind.mv2` file to `.opencode/mind.mv2` format.

**Note:** The storage formats are compatible but path conventions differ:
- claude-brain: `.claude/mind.mv2`
- opencode-brain: `.opencode/mind.mv2`

## Troubleshooting

### Plugin not loading

1. Verify `opencode.json` has `"plugin": ["opencode-brain"]`
2. Check that `node_modules/opencode-brain` exists
3. Restart Opencode after plugin installation

### Storage not created

1. Check write permissions in project directory
2. Verify Bun is installed: `bun --version`
3. Try manual initialization: create `.opencode/` directory

### Search not finding results

1. Verify `.opencode/mind.mv2` exists and has content
2. Check that events are being captured (look for memory entries)
3. Try broader search terms

### Performance issues

1. Large memory files (>10MB) may slow down searches
2. Consider compressing old sessions: `/mind compact` (Phase 5)
3. File size stays manageable with automatic pruning

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

See `CONTRIBUTING.md` for detailed guidelines.

## License

MIT License — see [LICENSE](LICENSE) for details.

## Related

- [Opencode](https://opencode.ai/) — The AI coding agent this plugin extends
- [@opencode-ai/plugin](https://www.npmjs.com/package/@opencode-ai/plugin) — Plugin SDK
- [bun:sqlite](https://bun.com/docs/runtime/sqlite) — Bun's native SQLite driver
- [claude-brain](https://github.com/memvid/claude-brain) — Inspiration and prior art

---

**Built for Opencode with Bun and SQLite.**

*If Opencode isn't remembering your context, install this plugin and never repeat yourself again.*
