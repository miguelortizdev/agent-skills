# Hosts

🇺🇸 English | 🇪🇸 [Español](../es/hosts.md)

The Registry lists six supported Hosts. Adapters stay thin: native paths,
representations, fallbacks, and capability metadata only.

| Host | Skills | Commands | Agents | MCP |
| --- | --- | --- | --- | --- |
| Claude | NATIVE | NATIVE | NATIVE | FALLBACK |
| Codex | NATIVE | FALLBACK | NATIVE | FALLBACK |
| Cursor | NATIVE | LIMITED | NATIVE | FALLBACK |
| Gemini | NATIVE | NATIVE | NATIVE | FALLBACK |
| OpenCode | NATIVE | NATIVE | NATIVE | FALLBACK |
| OpenChamber | NATIVE | NATIVE | NATIVE | FALLBACK |

Host-specific guides remain in the shared reference directory:

- [Adapter matrix](../adapters/README.md)
- [Claude](../adapters/claude.md)
- [Codex](../adapters/codex.md)
- [Cursor](../adapters/cursor.md)
- [Gemini](../adapters/gemini.md)
- [OpenCode](../adapters/opencode.md)
- [OpenChamber](../adapters/openchamber.md)

To add a Host, update the Registry host entry, adapter contract, native
destinations, capability matrix, ownership/uninstall behavior, tests, and drift
validation. Do not duplicate canonical assets.
