# Host Adapters

Adapters translate the canonical registry into each host's native discovery
paths. They are intentionally thin: the adapter contains paths, mappings,
fallbacks, and official documentation links, not duplicated Skill content.

| Host | Skills | Commands | Agents | MCP | Guide |
| --- | --- | --- | --- | --- | --- |
| Claude | Native plugin | Native plugin | Native plugin | Adapter mapping | [Claude](claude.md) |
| Codex | Native plugin or `.agents/skills` | Underlying Skill | `.codex/agents/*.toml` | Host/plugin mapping | [Codex](codex.md) |
| Cursor | `.cursor/skills` | Rule/manual fallback | Rule/manual fallback | Host mapping | [Cursor](cursor.md) |
| OpenCode | `.opencode/skills` | `.opencode/commands` | `.opencode/agents` (`mode: subagent`) | `opencode.json` | [OpenCode](opencode.md) |
| Gemini | `.gemini/skills` | `.gemini/commands` | `.gemini/agents` | Host settings | [Gemini](gemini.md) |
| OpenChamber | Settings or OpenCode | `.opencode/commands` | `.opencode/agents` (`mode: subagent`) | Settings → MCP | [OpenChamber](openchamber.md) |

The machine-readable source for this table is `registry/hosts.json` plus each
host's `adapters/<host>/adapter.json`.
