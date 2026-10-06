# Cursor Adapter

Cursor discovers long workflows from `.cursor/skills/` and concise policies
from `.cursor/rules/*.mdc`. Do not paste complete `SKILL.md` files into rules.

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --host cursor --profile decameron --project --dry-run
```

The adapter installs Skills under `.cursor/skills/`. The installer intentionally
does not create `.cursor/commands/`; Commands and Agents use a documented
manual or rule fallback because they are not equivalent to Cursor Skills. MCP
remains configured through Cursor's native settings.

Official documentation: [Cursor Skills](https://docs.cursor.com/context/skills)
and [Cursor Rules](https://docs.cursor.com/context/rules).
