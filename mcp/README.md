# MCP Registry

`registry.json` is provider-neutral metadata for MCP servers. It describes how
to launch a server without choosing a host-specific configuration format.

Secrets are never stored here. An environment entry may reference a variable
name through `valueFrom: "environment"`; the value is resolved by the host at
installation or runtime. Adapters are responsible for translating this shape
to the host's native MCP configuration.

Example:

```json
{
  "id": "kubernetes",
  "command": "kubernetes-mcp-server",
  "args": [],
  "environment": [
    {"name": "KUBECONFIG", "valueFrom": "environment", "required": false}
  ]
}
```

The registry intentionally does not install binaries, invoke commands, or
validate that a provider is available on the current machine.
