# Instalación

🇪🇸 Español | 🇺🇸 [English](../en/installation.md)

El installer selecciona un Profile del Registry y mapea assets canónicos a un
Host. Escribe manifests de ownership y nunca crea una segunda fuente de verdad.

## Modos

| Modo | Foundation | Contexto | Recomendado para |
| --- | --- | --- | --- |
| Global Foundation | Sí | No | Configuración reutilizable del Host de un desarrollador |
| Project Full | Sí | Del proyecto | CI/CD, repositorios portables o aislados |
| Project Overlay / `sync` | No | Del proyecto | Un proyecto que ya usa una Foundation global |

Los Profiles son `default` y `decameron`. El Profile `decameron` incluye 25
Skills, 9 Commands, 4 Agents, 7 References y los servidores MCP `context7` y
`kubernetes`.

Los ejemplos operativos marcados con `<!-- doc-test: executable -->` se validan
desde un proyecto y HOME temporales aislados. Los demás bloques son ilustrativos.

## Flujo Recomendado

Primera vez:

<!-- doc-test: executable -->
```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --global --host codex --profile decameron --dry-run
```

Por proyecto:

<!-- doc-test: executable -->
```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  sync --host codex --profile decameron --dry-run
```

Uso diario: utiliza normalmente los Commands del Host. `sync` también mantiene
el bloque de instrucciones administrado del proyecto para usar los Skills del
proyecto relevantes junto con los Skills base requeridos por los Commands.

## Instrucciones Del Proyecto

El Overlay/`sync` declara su mecanismo de instrucciones en cada adapter:

| Host | Archivo de instrucciones |
| --- | --- |
| Claude | `CLAUDE.md` |
| Codex | `AGENTS.md` |
| Gemini | `GEMINI.md` |
| Cursor | `.cursor/rules/ai-engineering-standard.mdc` |
| OpenCode | `AGENTS.md` |
| OpenChamber | `AGENTS.md` |

El installer crea o actualiza únicamente el bloque delimitado por
`ai-engineering-standard:start` y `ai-engineering-standard:end`. Conserva el
contenido del usuario, los `sync` repetidos son idempotentes y uninstall elimina
solo ese bloque. Los archivos compartidos como `AGENTS.md` permanecen hasta
desinstalar el último Host propietario. Usa `--dry-run` para previsualizar el
archivo y el bloque de instrucciones.

## Project Full

<!-- doc-test: executable -->
```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --project --host codex --profile decameron --dry-run
```

Instala la Foundation completa en el proyecto. Si se registran Contextual Skills
en el futuro, los Skills coincidentes se agregarán sin cambiar el core.

## Dry Run Y Uninstall

Agrega `--dry-run` para previsualizar acciones sin escribir. Desinstala solo una
instalación existente con el mismo Host, Profile y alcance:

<!-- doc-test: executable -->
```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  --project --host codex --profile decameron --uninstall --dry-run
```

Para un Overlay, usa `sync --uninstall` o la forma explícita
`--overlay --uninstall`. Solo se eliminan archivos cuyo ownership está probado y
que no cambiaron; los archivos del usuario permanecen.

Consulta las [guías de Host](../adapters/README.md) para destinos nativos.
