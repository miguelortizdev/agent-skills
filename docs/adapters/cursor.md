# Cursor Adapter

Cursor discovers long workflows from `.cursor/skills/` and concise policies
from `.cursor/rules/*.mdc`. Do not paste complete `SKILL.md` files into rules.

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --host cursor --profile decameron --project --dry-run
```

The adapter installs Skills under `.cursor/skills/`, Commands as Markdown under
`.cursor/commands/`, and specialist Agents under `.cursor/agents/`. Commands use
the canonical Markdown representation and preserve the `planning` → `plan`
filename alias. Agents are copied without host metadata because Cursor's native
subagent files do not require OpenCode's `mode: subagent` field.

Global installs place Skills and Agents under `~/.cursor/{skills,agents}`. The
installer does not create `~/.cursor/commands/` because the current official
documentation confirms project Commands but does not document a global Commands
directory. MCP remains configured through Cursor's native settings.

Official documentation: [Cursor Skills](https://docs.cursor.com/context/skills),
[Cursor Commands](https://docs.cursor.com/context/commands),
[Cursor Subagents](https://docs.cursor.com/context/subagents), and
[Cursor Rules](https://docs.cursor.com/context/rules).
