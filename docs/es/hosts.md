# Hosts

🇪🇸 Español | 🇺🇸 [English](../en/hosts.md)

El Registry lista seis Hosts soportados. Los adapters se mantienen delgados:
solo rutas nativas, representaciones, fallbacks y metadata de capacidades.

| Host | Skills | Commands | Agents | MCP |
| --- | --- | --- | --- | --- |
| Claude | NATIVE | NATIVE | NATIVE | FALLBACK |
| Codex | NATIVE | FALLBACK | NATIVE | FALLBACK |
| Cursor | NATIVE | LIMITED | NATIVE | FALLBACK |
| Gemini | NATIVE | NATIVE | NATIVE | FALLBACK |
| OpenCode | NATIVE | NATIVE | NATIVE | FALLBACK |
| OpenChamber | NATIVE | NATIVE | NATIVE | FALLBACK |

Las guías específicas de Host permanecen en la referencia compartida:

- [Matriz de adapters](../adapters/README.md)
- [Claude](../adapters/claude.md)
- [Codex](../adapters/codex.md)
- [Cursor](../adapters/cursor.md)
- [Gemini](../adapters/gemini.md)
- [OpenCode](../adapters/opencode.md)
- [OpenChamber](../adapters/openchamber.md)

Para agregar un Host, actualiza la entrada del Registry, el contrato del adapter,
destinos nativos, matriz de capacidades, ownership/uninstall, tests y validación
de drift. No dupliques assets canónicos.

## Checks Ejecutables De Hosts

Estos dry-runs aislados verifican los IDs de Host y el Profile documentados:

<!-- doc-test: executable -->
```bash
node /path/to/agent-skills/scripts/install-agent-standard.js --global --host claude --profile decameron --dry-run
```

<!-- doc-test: executable -->
```bash
node /path/to/agent-skills/scripts/install-agent-standard.js --global --host codex --profile decameron --dry-run
```

<!-- doc-test: executable -->
```bash
node /path/to/agent-skills/scripts/install-agent-standard.js --global --host cursor --profile decameron --dry-run
```

<!-- doc-test: executable -->
```bash
node /path/to/agent-skills/scripts/install-agent-standard.js --global --host gemini --profile decameron --dry-run
```

<!-- doc-test: executable -->
```bash
node /path/to/agent-skills/scripts/install-agent-standard.js --global --host opencode --profile decameron --dry-run
```

<!-- doc-test: executable -->
```bash
node /path/to/agent-skills/scripts/install-agent-standard.js --global --host openchamber --profile decameron --dry-run
```
