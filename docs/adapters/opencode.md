# OpenCode Adapter

OpenCode discovers project-local assets from these paths:

```text
.opencode/skills/
.opencode/commands/
.opencode/agents/
```

Install a selected profile with:

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --host opencode --profile decameron --project --dry-run
```

Skills are loaded on demand through OpenCode's native `skill` tool. The
installer renders canonical TOML command definitions as Markdown files under
`.opencode/commands/`, and renders canonical agents under `.opencode/agents/`
with `mode: subagent`. Global installs use `~/.config/opencode/{skills,commands,agents}`.
If a command is unsupported, invoke its underlying Skill directly. MCP
configuration is translated to OpenCode's native config.

Official documentation: [OpenCode Agent Skills](https://opencode.ai/docs/skills/),
[Commands](https://opencode.ai/docs/commands/), and
[MCP servers](https://opencode.ai/docs/mcp-servers/).
