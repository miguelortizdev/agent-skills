# Estándar de Ingeniería de IA de Decameron

🇪🇸 Español | 🇺🇸 [English](../en/start-here.md)

## Qué Es

El Estándar de Ingeniería de IA reúne flujos de trabajo repetibles para agentes
de programación con IA. Incluye una Foundation compartida, adaptadores de Host,
Profiles, MCP, instalación con ownership seguro y un Context Rules Engine
genérico.

Catálogo productivo actual:

- 25 Skills, todos base
- 0 Contextual Skills productivos
- 9 Commands, 4 Agents, 7 References y 6 Hosts

## Elige Tu Ruta

| Necesidad | Documento |
| --- | --- |
| Desarrollador | [Uso diario](daily-usage.md) |
| Líder técnico / Arquitecto | [Arquitectura](architecture.md) |
| Contribuidor de Skills | [Skills](skills.md) y [Contribución](contributing.md) |
| Contribuidor MCP | [MCP](mcp.md) y [Contribución](contributing.md) |
| Contribuidor de Hosts | [Hosts](hosts.md) y [Contribución](contributing.md) |
| Solución de problemas | [Troubleshooting](troubleshooting.md) |

## Primera Vez

Instala una vez la Foundation global `decameron`:

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --global --host codex --profile decameron
```

Después usa un Project Overlay para cada repositorio:

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  sync --host codex --profile decameron
```

Consulta [Instalación](installation.md) para Global, Project Full, Overlay,
dry-run, uninstall y Profiles.

## Extenderlo

Para agregar un futuro Contextual Skill: crea `SKILL.md`, registra el asset,
configura `appliesWhen`, agrega tests/evals, valida y abre un PR. No se requiere
cambiar Context Detector, Resolver, Installer ni Adapter.

## Actualización Y Soporte

- Actualiza el repositorio y reconcilia la Foundation global con el installer.
- Ejecuta `sync` en los proyectos después de actualizar.
- Usa [Sincronización upstream](upstream-sync.md) para cambios upstream.
- Usa [Solución de problemas](troubleshooting.md) si falla una validación o instalación.

## Idioma Y Referencias

`docs/en/` es la documentación técnica canónica en inglés; este directorio es su
equivalente de producto en español. Las guías específicas
de Host y los documentos upstream/históricos permanecen en `docs/adapters/`,
`docs/architecture/` y `docs/migration/`; son referencias compartidas, no otra
ruta de onboarding del producto.
