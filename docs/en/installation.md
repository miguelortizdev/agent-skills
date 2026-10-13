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

Profiles are `default` and `decameron`. The `default` Profile includes 25 Skills
and 9 Commands. The `decameron` Profile adds `work-lifecycle` and `/work`, for
26 Skills and 10 Commands total, plus 4 Agents, 7 References, and the `context7`
and `kubernetes` MCP servers.

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

Daily: use the Host's Commands normally. `sync` also maintains the project's
managed instruction block so relevant project Skills can be used alongside the
base Skills required by Commands.

## Work Lifecycle Installation

For Project Full, `/work` resolves its Node script from the installed
`<host-skill-directory>/work-lifecycle/scripts/work.js`. Global Foundation
commands resolve the same script from the installed global Skill directory;
Overlay projects use the global Foundation. This keeps `/work start`,
`/work switch`, and `/work close` independent of the source repository location.
Codex has no native Command directory in this profile. The adapter keeps
`globalCommandSupport: fallback` and generates one Skill per selected Command
under `.agents/skills/<command-id>/SKILL.md`; it does not create
`.codex/commands`. The generated Skills preserve the canonical Command prompt,
including modes such as `$build auto`, and list dependencies by their actual
type. `/work` resolves the installed `work-lifecycle` script rather than the
source repository path.

For Codex, invoke the generated adapters with `$`:

```text
$spec
$plan
$build auto
$work start feature dingus --from main
```

Global and Project Full installations generate the adapters locally. Overlay
projects reuse the global Foundation and do not duplicate them. Dry-run shows
the generated targets; updating an unchanged managed adapter refreshes it, while
manual modifications cause a safe conflict. Uninstall removes only owned,
unchanged generated Skills.

## Project Instructions

Overlay/sync declares its instruction mechanism in each Host adapter:

| Host | Project instruction file |
| --- | --- |
| Claude | `CLAUDE.md` |
| Codex | `AGENTS.md` |
| Gemini | `GEMINI.md` |
| Cursor | `.cursor/rules/ai-engineering-standard.mdc` |
| OpenCode | `AGENTS.md` |
| OpenChamber | `AGENTS.md` |

The installer creates or updates only the managed block delimited by
`ai-engineering-standard:start` and `ai-engineering-standard:end`. Existing user
content is preserved, repeated `sync` runs are idempotent, and uninstall removes
only that block. Shared files such as `AGENTS.md` remain until the last owning
Host is uninstalled. Use `--dry-run` to preview the instruction file and block.

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
