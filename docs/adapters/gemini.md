# Gemini CLI Adapter

Gemini CLI discovers workspace Skills from `.gemini/skills/` or `.agents/skills/`,
commands from `.gemini/commands/`, and custom subagents from
`.gemini/agents/`. Global installs use the same directories under `~/.gemini/`.

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --host gemini --profile decameron --project --dry-run
```

Commands remain TOML under `.gemini/commands/`; the installer preserves the
existing upstream Gemini command files, including host-specific variants. The
canonical `plan` command maps to the existing `planning.toml` filename. Agent
files retain the required `name` and `description` frontmatter. Configure MCP
through Gemini's native settings using environment references only.

Official documentation: [Gemini Agent Skills](https://geminicli.com/docs/cli/skills/),
[custom commands](https://geminicli.com/docs/cli/custom-commands/), and
[subagents](https://geminicli.com/docs/core/subagents/).
