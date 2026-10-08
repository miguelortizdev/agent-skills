# MCP Installation

MCP servers are defined once in `mcp/registry.json`. Profiles select server
IDs, and host adapters translate those entries into native configuration files.
Credentials are never stored in the registry; environment references remain
provider-neutral.

## Supported Hosts

| Host | Project path | Global path | Format |
| --- | --- | --- | --- |
| Claude | `.mcp.json` | `~/.claude.json` | JSON `mcpServers` |
| Codex | `.codex/config.toml` | `~/.codex/config.toml` | TOML `mcp_servers` |
| Cursor | `.cursor/mcp.json` | `~/.cursor/mcp.json` | JSON `mcpServers` |
| Gemini | `.gemini/settings.json` | `~/.gemini/settings.json` | JSON `mcpServers` |
| OpenCode | `opencode.json` | `~/.config/opencode/opencode.json` | JSON `mcp` |
| OpenChamber | `opencode.json` | `~/.config/opencode/opencode.json` | JSON `mcp` |

Run a dry run before writing configuration:

```bash
node scripts/install-agent-standard.js \
  --host cursor --profile decameron --project --dry-run
```

Replace `cursor` with any supported host and use `--global` for the global
scope. Existing configuration is preserved. A conflicting server ID, malformed
configuration file, symlinked destination, or unsupported transport stops the
operation rather than overwriting user data.

## Ownership And Removal

MCP entries are recorded in the host installation manifest alongside skills,
commands, and agents. Reinstalling the same profile preserves creation
ownership. Uninstall removes only entries owned by that installation, leaves
user-managed entries intact, and deletes a configuration file only when the
installer originally created it and no entries remain.

```bash
node scripts/install-agent-standard.js \
  --host cursor --profile decameron --project --uninstall --dry-run
```

The registry currently contains `context7` and `kubernetes`, both using the
stdio transport. HTTP servers can be added with a valid HTTPS URL and no inline
secret values.
