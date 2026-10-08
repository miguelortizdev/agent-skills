# MCP

🇺🇸 English | 🇪🇸 [Español](../es/mcp.md)

MCP servers are registered once in `mcp/registry.json`. Profiles select IDs and
Host Adapters render them into native configuration. The `decameron` Profile
currently selects `context7` and `kubernetes`; `default` selects no MCP.

## Current Servers

| ID | Transport | Configuration |
| --- | --- | --- |
| `context7` | stdio | `npx -y @upstash/context7-mcp` |
| `kubernetes` | stdio | `kubernetes-mcp-server`, optional `KUBECONFIG` reference |

Credentials are never stored in the Registry. Use environment references and
never place literal secrets in configuration or documentation.

## Host Representation

The adapters use each Host's documented path and format. Run a dry-run first:

```bash
node scripts/install-agent-standard.js \
  --host cursor --profile decameron --project --dry-run
```

Existing entries are preserved. Conflicts, malformed files, symlinks, and
unsupported transports stop the operation rather than overwriting user data.

## Contribution And Tests

1. Register the server.
2. Add it to the intended Profile.
3. Configure environment references.
4. Map each Host representation.
5. Add tests and run `node scripts/validate-mcp.js`.
6. Open a PR.

MCP is Foundation-only for Project Overlay. Ownership-aware uninstall removes
only entries created by the selected installation.
