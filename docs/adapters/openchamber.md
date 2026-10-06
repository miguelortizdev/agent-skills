# OpenChamber Adapter

OpenChamber is a workspace around OpenCode. The detailed installation and
profile-switching guide is [OpenChamber Installation](../openchamber-installation.md).

OpenChamber can manage Skills, Commands, and MCP from its Settings UI. For
repository-scoped installation, this adapter uses the OpenCode-compatible
paths:

```text
.opencode/skills/
.opencode/commands/
.opencode/agent/
.opencode/references/
```

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --host openchamber --profile decameron --project --dry-run
```

Use **Settings → Skills**, **Settings → Commands**, and **Settings → MCP** to
inspect or configure the resulting project behavior. Repository project actions
and draft starters use `.openchamber/project.json` when needed.

Official documentation: [Skills](https://docs.openchamber.dev/skills/),
[Commands](https://docs.openchamber.dev/commands-snippets/),
[MCP](https://docs.openchamber.dev/mcp/), and
[Repository config](https://docs.openchamber.dev/repository-config/).
