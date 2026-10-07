# MCP Registry

`registry.json` is the canonical, host-independent registry. It uses
`schemaVersion: 1` and a `servers` array. Profiles select server IDs; the
installer resolves those IDs and translates each server through the selected
host adapter.

## Schema

Each server has a lowercase `id`, a display `name`, and one transport:

```json
{
  "schemaVersion": 1,
  "servers": [
    {
      "name": "Kubernetes",
      "id": "kubernetes",
      "transport": "stdio",
      "command": "kubernetes-mcp-server",
      "args": [],
      "env": {
        "KUBECONFIG": {
          "source": "environment",
          "name": "KUBECONFIG",
          "required": false
        }
      }
    }
  ]
}
```

STDIO requires `command` and `args`. HTTP requires an `http://` or `https://`
`url`. HTTP headers are environment-backed references and may include a
provider-neutral `prefix`, for example:

```json
"headers": {
  "Authorization": {
    "source": "environment",
    "name": "MCP_TOKEN",
    "prefix": "Bearer "
  }
}
```

Literal credentials are invalid. Variable names are safe to commit; secret
values are not. Adapters translate this header reference to each native
format, such as Claude/OpenCode header interpolation or Codex's
`bearer_token_env_var` and `env_http_headers` fields.

## Profiles And Installation

Add only the registry ID to a profile's `mcp` array. Validate the registry and
profiles with:

```bash
node scripts/validate-mcp.js
node scripts/validate-profiles.js
```

Install a profile with project or global scope:

```bash
node scripts/install-agent-standard.js \
  --host codex --profile decameron --project
```

Use `--dry-run` to inspect the target and MCP actions without filesystem
writes. Existing malformed configuration fails without changing its bytes.
Identical entries are idempotent; different entries with the same ID are
explicit conflicts.

The installer records MCP ownership in the host manifest. Uninstall removes
only entries created by that installation, transfers shared entries to another
host owner, and preserves user configuration. An installer-created Codex TOML
file is removed only when no useful content remains; an existing user-owned
file is preserved.

## Adding A Server

1. Add a validated server object to `registry.json`.
2. Use only environment references for credentials.
3. Add its ID to an appropriate profile.
4. Confirm every adapter representation is officially supported before marking
   a host supported.
5. Add resolver, lifecycle, conflict, malformed-config, uninstall, and secret
   safety tests for the supported transports.

The registry does not install binaries, invoke servers, authenticate accounts,
or verify provider availability.

## Host Matrix

| Host | Project | Global/User | STDIO | HTTP | Auth/env |
| --- | --- | --- | --- | --- | --- |
| Claude | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED |
| Codex | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED |
| Cursor | SUPPORTED | SUPPORTED | SUPPORTED | LIMITED | SUPPORTED |
| Gemini | SUPPORTED | SUPPORTED | SUPPORTED | LIMITED | SUPPORTED |
| OpenCode | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED |
| OpenChamber | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED |

HTTP is `LIMITED` for Cursor and Gemini because this installer only emits the
documented URL representation for those adapters; it does not claim provider-
specific authentication features beyond environment interpolation. OpenCode
and OpenChamber share the OpenCode V2 `mcp.servers` configuration and ownership
is transferred between their manifests during uninstall.
