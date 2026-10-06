# Codex Adapter

Codex natively consumes the root `skills/` directory through
`.codex-plugin/plugin.json`. Prefer the native plugin for distribution and
progressive discovery.

```bash
codex plugin marketplace add /path/to/agent-skills
codex plugin add agent-skills@agent-skills
```

For a selected project profile:

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --host codex --profile decameron --project --dry-run
```

Codex does not need the full `using-agent-skills` meta-router preloaded when
native routing is available. The installer installs project and global Skills
under `.agents/skills/` and `~/.agents/skills/`. It intentionally does not
create `.agents/agents/` or `.codex/agents/`: Codex custom agents use its own
TOML configuration surface, so these Markdown personas remain available in the
repository and through documented Skill-based fallbacks. Lifecycle commands
are represented by their underlying Skills when no native slash-command
equivalent exists.

Official documentation: [Codex Skills](https://developers.openai.com/codex/skills).
