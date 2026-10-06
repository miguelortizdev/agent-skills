# Gemini CLI Adapter

Gemini CLI discovers workspace Skills from `.gemini/skills/` or `.agents/skills/`
and commands from `.gemini/commands/`.

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --host gemini --profile decameron --project --dry-run
```

Commands remain TOML under `.gemini/commands/`; the canonical `plan` command
maps to the existing `planning.toml` filename for Gemini compatibility. Agents
without a native equivalent remain available as manual or Skill-based
fallbacks. Configure MCP through Gemini's native settings using environment
references only.

Official documentation: [Gemini Agent Skills](https://geminicli.com/docs/cli/skills/)
and [custom commands](https://geminicli.com/docs/cli/custom-commands/).
