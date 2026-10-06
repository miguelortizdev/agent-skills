# Claude Code Adapter

Claude Code has native plugin support for Skills, Agents, Commands, Hooks, and
MCP. The preferred distribution path is the existing plugin manifest rather
than copying assets into a project.

```text
.claude-plugin/plugin.json
skills/
agents/
commands/
.claude/commands/
```

For a profile-based project installation:

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --host claude --profile decameron --project --dry-run
```

Use the native Claude plugin installation when the full upstream pack is
desired. Use the installer when a project needs a selected profile and explicit
ownership tracking.

Official documentation: [Claude Code plugins](https://code.claude.com/docs/en/plugins).
