# OpenChamber Installation

## Install a Profile

Run the installer from the target project's root. Start with a dry-run:

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --host openchamber \
  --profile decameron \
  --project \
  --dry-run
```

Apply the installation after reviewing the planned files:

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --host openchamber \
  --profile decameron \
  --project
```

The installer writes selected assets to OpenCode-compatible project paths:

```text
.opencode/skills/
.opencode/agent/
.opencode/commands/
.opencode/references/
```

OpenChamber uses OpenCode for agent execution, so restart or reload the
project after installation. Skills can then be selected from the `/` picker or
activated by describing a matching task.

Use `--profile default` instead of `--profile decameron` to install the full
upstream capability set.

## Change Profiles Safely

Every successful installation creates:

```text
.agent-standard/installation.json
```

The manifest records the host, profile, scope, file hashes, and which files the
installer created. The installer refuses to mix a different profile until the
current one is removed.

Remove the current profile with:

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --host openchamber \
  --profile decameron \
  --project \
  --uninstall
```

Then install the replacement profile:

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --host openchamber \
  --profile default \
  --project
```

Uninstallation is conservative:

- Files created by the installer are removed only when their hash is unchanged.
- Files modified after installation cause uninstallation to fail rather than delete local work.
- Files that already existed before installation are preserved.
- An installation without a manifest cannot be safely uninstalled automatically.

Use `--dry-run --uninstall` to inspect removal without changing files.

## MCP

MCP servers are not installed automatically. Configure them in OpenChamber via
**Settings → MCP**, using `mcp/registry.json` as the provider-neutral source.
Resolve credentials through environment variables; never paste secrets into
repository configuration.
