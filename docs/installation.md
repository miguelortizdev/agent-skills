# Agent Standard Installation

The canonical assets remain in the repository root. The installer selects a
profile and maps those assets to a host-specific discovery path; it does not
create a second source of truth.

## Prerequisites

- Node.js 20 or newer.
- A clone of this repository or a released copy of the installer.
- The target project root when using `--project`.

## Dry Run First

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --host <host> \
  --profile <profile> \
  --project \
  --dry-run
```

Supported hosts are `claude`, `codex`, `cursor`, `opencode`, `gemini`, and
`openchamber`. Supported profiles are `default` and `decameron`.

Project-scoped installs also detect supported technology markers and add
contextual Skills. See [Context-Aware Skills](context-aware-skills.md).

## Installation Strategies

The installer supports three deliberately different strategies:

| Mode | Foundation | Context | Global dependency |
| --- | --- | --- | --- |
| Global Foundation | Yes | No | N/A |
| Full Project | Yes | Yes | No |
| Project Context Overlay | No | Yes | Yes |

### Global Foundation

Install the shared foundation once for a host and profile:

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --host codex --profile decameron --global
```

This installs the profile's Base Skills, Commands, Agents, References, MCP,
and ownership manifest globally. It never detects the current project.

### Full Project

Use a self-contained project installation for CI/CD, portable repositories, or
isolated environments:

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --host codex --profile decameron --project
```

This preserves the existing behavior: foundation assets plus detected
contextual Skills are materialized in the project.

### Project Context Overlay

When a compatible global foundation already exists, sync only the project's
contextual Skills:

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  sync --host codex --profile decameron
```

`--overlay` is the equivalent explicit form. The global host and profile must
match. The project receives contextual Skills only; Base Skills, Commands,
Agents, References, and MCP remain global. Use `--dry-run` to preview the
overlay without writes and `--overlay --uninstall` to remove only its managed
contextual files.

The overlay records `mode: overlay` in the project manifest. Existing full
project installations are not silently converted; uninstall the full project
installation explicitly before switching to overlay. An overlay can be
expanded to a full project installation with `--project`.

### Recommended Workflows

Developers should prefer a global foundation plus a project overlay:

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --global --host codex --profile decameron
cd my-project
node /path/to/agent-skills/scripts/install-agent-standard.js \
  sync --host codex --profile decameron
```

CI/CD and isolated environments should prefer the full project strategy.

### Overlay Support Matrix

The overlay lifecycle is covered for every supported host and uses each
adapter's existing global and project skill destinations:

| Host | Global Foundation | Full Project | Context Overlay |
| --- | --- | --- | --- |
| Claude | SUPPORTED | SUPPORTED | SUPPORTED |
| Codex | SUPPORTED | SUPPORTED | SUPPORTED |
| Cursor | SUPPORTED | SUPPORTED | SUPPORTED |
| Gemini | SUPPORTED | SUPPORTED | SUPPORTED |
| OpenCode | SUPPORTED | SUPPORTED | SUPPORTED |
| OpenChamber | SUPPORTED | SUPPORTED | SUPPORTED |

MCP remains foundation-only in overlay mode. Commands and Agents are not
duplicated into an overlay.

## Install

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --host <host> \
  --profile <profile> \
  --project
```

Use `--global` instead of `--project` for a user-level installation when the
host adapter supports that scope. The installer refuses to overwrite
conflicting files, follows no symlinks, and writes an ownership manifest at:

```text
.agent-standard/installation.json
```

## Change Profile

Do not install a second profile for the same host and scope over an existing
installation. Remove the current host profile first:

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --host <host> \
  --profile <current-profile> \
  --project \
  --uninstall
```

Then install the replacement profile. Each host has an isolated manifest under
`.agent-standard/installations/<host>.json`, so different hosts can coexist.
Uninstallation removes only files created by the requested host and refuses to
delete files whose hashes changed. Shared identical files transfer ownership to
the remaining installation.

Use `--dry-run --uninstall` to preview removal. Installations without a host
manifest cannot be safely removed automatically.

The installer copies complete Skill directories, not only `SKILL.md`, and keeps
shared References inside the host namespace so relative links remain valid.
Run the runtime check for an installed profile with:

```bash
node scripts/validate-installation-integrity.js \
  --root "$PWD" --host cursor --profile decameron
```

MCP profiles are validated against `mcp/registry.json`. The installer resolves
selected servers into each host's documented native configuration format and
merges only its managed entries. See [MCP installation](mcp-installation.md)
for supported scopes, paths, and uninstall behavior.

## Profiles

| Profile | Purpose |
| --- | --- |
| `default` | All 25 upstream Skills, 9 Commands, 4 Agents, shared References, and eval metadata. |
| `decameron` | Corporate baseline with security, API, observability, review, and shipping capabilities. |

Profiles select canonical IDs from `registry/catalog.json`; they do not embed
Skill or Agent content.

## Validate

```bash
node scripts/validate-registry.js
node scripts/validate-profiles.js
node scripts/validate-mcp.js
node scripts/validate-adapter-drift.js
node scripts/validate-reference-links.js
node scripts/validate-upstream-parity.js
```

## Host Guides

- [Claude](adapters/claude.md)
- [Codex](adapters/codex.md)
- [Cursor](adapters/cursor.md)
- [OpenCode](adapters/opencode.md)
- [Gemini](adapters/gemini.md)
- [OpenChamber](adapters/openchamber.md)

The host-specific JSON contracts live under `adapters/<host>/adapter.json`.
