# Installation

🇺🇸 English | 🇪🇸 [Español](../es/installation.md)

The installer selects a Profile from the Registry and maps canonical assets to a
Host. It writes ownership manifests and never creates a second source of truth.

## Modes

| Mode | Foundation | Context | Recommended for |
| --- | --- | --- | --- |
| Global Foundation | Yes | No | A developer's reusable host setup |
| Project Full | Yes | Project-scoped | CI/CD, portable or isolated repositories |
| Project Overlay / `sync` | No | Project-scoped | A project using an existing global Foundation |

Profiles are `default` and `decameron`. The `decameron` Profile includes 25
Skills, 9 Commands, 4 Agents, 7 References, and the `context7` and `kubernetes`
MCP servers.

Operational examples marked `<!-- doc-test: executable -->` are validated from
an isolated temporary project and HOME. Other code blocks are illustrative.

## Recommended Flow

First time:

<!-- doc-test: executable -->
```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --global --host codex --profile decameron --dry-run
```

Per project:

<!-- doc-test: executable -->
```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  sync --host codex --profile decameron --dry-run
```

Daily: use the Host's Commands normally. The current production catalog has
zero Contextual Skills, so `sync` may succeed with no project writes.

## Full Project

<!-- doc-test: executable -->
```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --project --host codex --profile decameron --dry-run
```

This installs the complete Foundation in the project. If future Contextual
Skills are registered, matching Skills are added without core changes.

## Dry Run And Uninstall

Add `--dry-run` to preview actions without writing. Uninstall only an existing
installation for the same Host, Profile, and scope:

<!-- doc-test: executable -->
```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --project --host codex --profile decameron --uninstall --dry-run
```

For an Overlay, use `sync --uninstall` or the explicit `--overlay --uninstall`.
Only files proven to be owned and unchanged are removed; user files remain.

See the shared [host guides](../adapters/README.md) for native destinations.
