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

MCP profiles are validated against `mcp/registry.json`, but the installer does
not write host configuration files. Selected MCP entries are reported as a
documented fallback and must be configured through the host's native UI or
configuration file.

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
node scripts/validate-adapter-drift.js
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
