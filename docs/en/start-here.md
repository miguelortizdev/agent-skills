# Decameron AI Engineering Standard

🇺🇸 English | 🇪🇸 [Español](../es/start-here.md)

## What This Is

The AI Engineering Standard packages repeatable engineering workflows for AI
coding agents. It provides a shared Foundation, host adapters, Profiles, MCP,
ownership-safe installation, and a generic Context Rules Engine.

Current production catalog:

- 26 Skills: 25 base Skills and 1 Contextual Skill
- 1 production Contextual Skill: `vercel-react-best-practices`
- 9 Commands, 4 Agents, 7 References, and 6 Hosts

## Choose Your Path

| Need | Document |
| --- | --- |
| Developer | [Daily usage](daily-usage.md) |
| Tech Lead / Architect | [Architecture](architecture.md) |
| Skill contributor | [Skills](skills.md) and [Contributing](contributing.md) |
| MCP contributor | [MCP](mcp.md) and [Contributing](contributing.md) |
| Host contributor | [Hosts](hosts.md) and [Contributing](contributing.md) |
| Troubleshooting | [Troubleshooting](troubleshooting.md) |

## First Time

Install the global `decameron` Foundation once:

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --global --host codex --profile decameron
```

Then use a Project Overlay for each repository:

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  sync --host codex --profile decameron
```

Use [Installation](installation.md) for Global, Project Full, Overlay, dry-run,
uninstall, and Profile details.

## Extend It

To add a future Contextual Skill: create `SKILL.md`, register the asset,
configure `appliesWhen`, add tests/evals, validate, and open a PR. No Context
Detector, Resolver, Installer, or Adapter change is required.

## Update And Support

- Update the repository and reconcile the global Foundation with the installer.
- Run `sync` in projects after an update.
- Use [Upstream sync](upstream-sync.md) for upstream changes.
- Use [Troubleshooting](troubleshooting.md) when validation or installation fails.

## Language And Reference Docs

This directory is the canonical technical documentation in English. Host-specific
guides and upstream/history documents remain in `docs/adapters/`,
`docs/architecture/`, and `docs/migration/`; they are shared reference material,
not a second product onboarding path.
