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
npx --yes ai-engineering-standard@latest \
  --global --host codex --profile decameron --dry-run
```

Per project:

<!-- doc-test: executable -->
```bash
npx --yes ai-engineering-standard@latest \
  sync --host codex --profile decameron --dry-run
```

Daily: use the Host's Commands normally. `sync` also maintains the project's
managed instruction block so relevant project Skills can be used alongside the
base Skills required by Commands.

## Installer Reference

The general command shape is:

```bash
npx --yes ai-engineering-standard@latest [refresh|sync] \
  --host <host> [--profile <profile>] \
  [--global | --project | --overlay] \
  [--dry-run] [--uninstall]
```

Valid values and options:

| Option | Values | Purpose |
| --- | --- | --- |
| `--host` | `claude`, `codex`, `cursor`, `gemini`, `opencode`, `openchamber` | Selects the target Host. Required. |
| `--profile` | `default`, `decameron` | Selects the asset set. Required except for `refresh`, which reads it from the existing manifest. |
| `--global` | — | Installs or uninstalls the Foundation in the user's HOME. |
| `--project` | — | Installs or uninstalls a complete Foundation in the current project. |
| `sync` | — | Alias for `--overlay`; synchronizes project context only. |
| `--overlay` | — | Explicit form of `sync`. Requires a compatible global Foundation. |
| `refresh` | — | Regenerates derived Codex adapters. Cannot be combined with `--uninstall`. |
| `--dry-run` | — | Shows actions without writing files. |
| `--uninstall` | — | Removes only a registered installation whose owned files remain unchanged. |

Choose exactly one scope (`--global`, `--project`, or `sync`/`--overlay`) for
install and uninstall operations. `refresh` can detect the only existing Codex
manifest; if both Global and Project installations exist, specify the scope.

### Global Installation

```bash
npx --yes ai-engineering-standard@latest \
  --global --host <host> --profile <profile>
```

Preview it first:

```bash
npx --yes ai-engineering-standard@latest \
  --global --host <host> --profile <profile> --dry-run
```

### Full Project Installation

Run this from the project root:

```bash
npx --yes ai-engineering-standard@latest \
  --project --host <host> --profile <profile>
```

This installs the Foundation, detected project context, MCP, and the ownership
manifest in the project. Add `--dry-run` to review the plan first.

### Project Overlay (`sync`)

Run this from the project root after installing a compatible Global Foundation:

```bash
npx --yes ai-engineering-standard@latest \
  sync --host <host> --profile <profile>
```

Equivalent explicit form:

```bash
npx --yes ai-engineering-standard@latest \
  --overlay --host <host> --profile <profile>
```

The Overlay does not duplicate the global Foundation, Commands, Agents,
References, or MCP. It only synchronizes contextual Skills and the managed
project instruction block.

## Refreshing Codex Adapters

After updating a canonical Command under `commands/*.toml`, refresh the derived
Skills without rewriting the Profile:

```bash
npx --yes ai-engineering-standard@latest \
  refresh --host codex --global
```

For a Project installation, run it from the project root:

```bash
npx --yes ai-engineering-standard@latest \
  refresh --host codex --project
```

You may omit `--global` or `--project` when only one Codex installation is
detectable. If both exist, specify the scope explicitly. Add `--dry-run` to
preview changes before writing them.

When both scopes exist, use one of these explicit commands:

```bash
npx --yes ai-engineering-standard@latest \
  refresh --host codex --global

npx --yes ai-engineering-standard@latest \
  refresh --host codex --project
```

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
npx --yes ai-engineering-standard@latest \
  --project --host codex --profile decameron --dry-run
```

This installs the complete Foundation in the project. If future Contextual
Skills are registered, matching Skills are added without core changes.

## Dry Run And Uninstall

Add `--dry-run` to preview actions without writing. Uninstall only an existing
installation for the same Host, Profile, and scope:

<!-- doc-test: executable -->
```bash
npx --yes ai-engineering-standard@latest \
  --project --host codex --profile decameron --uninstall --dry-run
```

For an Overlay, use `sync --uninstall` or the explicit `--overlay --uninstall`.
Only files proven to be owned and unchanged are removed; user files remain.

Global uninstall:

```bash
npx --yes ai-engineering-standard@latest \
  --global --host <host> --profile <profile> --uninstall
```

Full Project uninstall:

```bash
npx --yes ai-engineering-standard@latest \
  --project --host <host> --profile <profile> --uninstall
```

Preview any uninstall:

```bash
npx --yes ai-engineering-standard@latest \
  --project --host <host> --profile <profile> --uninstall --dry-run
```

Do not use `--uninstall` without an existing manifest. The installer will not
automatically delete untracked files.

See the shared [host guides](../adapters/README.md) for native destinations.
