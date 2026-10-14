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

Los Profiles son `default` y `decameron`. El Profile `default` incluye 25 Skills
y 9 Commands. `decameron` agrega `work-lifecycle` y `/work`, para un total de
26 Skills y 10 Commands, además de 4 Agents, 7 References y los servidores MCP
`context7` y `kubernetes`.

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

## Referencia Del Instalador

La forma general del comando es:

```bash
node /ruta/agent-skills/scripts/install-agent-standard.js [refresh|sync] \
  --host <host> [--profile <profile>] \
  [--global | --project | --overlay] \
  [--dry-run] [--uninstall]
```

Valores válidos:

| Opción | Valores | Función |
| --- | --- | --- |
| `--host` | `claude`, `codex`, `cursor`, `gemini`, `opencode`, `openchamber` | Selecciona el Host de destino. Es obligatoria. |
| `--profile` | `default`, `decameron` | Selecciona el conjunto de assets. Es obligatorio salvo en `refresh`, donde se toma del manifest existente. |
| `--global` | — | Instala o desinstala la Foundation en el HOME del usuario. |
| `--project` | — | Instala o desinstala una Foundation completa en el proyecto actual. |
| `sync` | — | Alias de `--overlay`; sincroniza solo el contexto del proyecto. |
| `--overlay` | — | Forma explícita de `sync`. Requiere una Foundation global compatible. |
| `refresh` | — | Regenera los adapters derivados de Codex. No se combina con `--uninstall`. |
| `--dry-run` | — | Muestra las acciones sin escribir archivos. |
| `--uninstall` | — | Elimina solo una instalación registrada, cuyos archivos sigan bajo ownership y sin modificaciones. |

Debe elegirse exactamente un alcance (`--global`, `--project` o `sync`/`--overlay`)
para instalar o desinstalar. `refresh` puede detectar automáticamente el único
manifest Codex existente; si existen instalaciones Global y Project, indica el
alcance explícitamente.

### Instalación Global

```bash
node /ruta/agent-skills/scripts/install-agent-standard.js \
  --global --host <host> --profile <profile>
```

Previsualización:

```bash
node /ruta/agent-skills/scripts/install-agent-standard.js \
  --global --host <host> --profile <profile> --dry-run
```

### Instalación Project Full

Ejecuta el comando desde la raíz del proyecto:

```bash
node /ruta/agent-skills/scripts/install-agent-standard.js \
  --project --host <host> --profile <profile>
```

Este modo instala Foundation, contexto detectado, MCP y manifest dentro del
proyecto. Usa `--dry-run` para revisar antes de escribir.

### Overlay Project (`sync`)

Ejecuta el comando desde la raíz del proyecto después de instalar la Foundation
global compatible:

```bash
node /ruta/agent-skills/scripts/install-agent-standard.js \
  sync --host <host> --profile <profile>
```

Equivalente explícito:

```bash
node /ruta/agent-skills/scripts/install-agent-standard.js \
  --overlay --host <host> --profile <profile>
```

El Overlay no duplica Foundation, Commands, Agents, References ni MCP globales.
Solo sincroniza Skills contextuales y las instrucciones administradas del proyecto.

## Refrescar Adapters Codex

Después de actualizar un Command canónico en `commands/*.toml`, refresca los
Skills derivados sin volver a escribir el Profile:

```bash
node /ruta/agent-skills/scripts/install-agent-standard.js \
  refresh --host codex --global
```

Para una instalación Project, ejecútalo desde la raíz del proyecto:

```bash
node /ruta/agent-skills/scripts/install-agent-standard.js \
  refresh --host codex --project
```

También puedes omitir `--global` o `--project` cuando solo existe una
instalación Codex detectable. Si existen ambas, indica el alcance explícitamente.
Usa `--dry-run` para revisar los cambios antes de escribirlos.

Si hay una instalación Global y otra Project, elige una:

```bash
node /ruta/agent-skills/scripts/install-agent-standard.js \
  refresh --host codex --global

node /ruta/agent-skills/scripts/install-agent-standard.js \
  refresh --host codex --project
```

## Instalación Del Ciclo De Trabajo

En Project Full, `/work` resuelve su script Node desde
`<directorio-de-skills-del-host>/work-lifecycle/scripts/work.js`. Los Commands
de una Foundation global resuelven el mismo script desde el directorio global
del Skill; los proyectos Overlay usan la Foundation global. Así `/work start`,
`/work switch` y `/work close` no dependen de la ubicación del repositorio fuente.
Codex no tiene un directorio nativo de Commands en este Profile. El adapter
mantiene `globalCommandSupport: fallback` y genera un Skill por cada Command
seleccionado en `.agents/skills/<command-id>/SKILL.md`; no crea
`.codex/commands`. Los Skills generados conservan el prompt canónico completo,
incluidos modos como `$build auto`, y listan las dependencias con su tipo real.
`/work` resuelve el script instalado de `work-lifecycle`, no una ruta del
repositorio fuente.

En Codex, invoca los adapters generados con `$`:

```text
$spec
$plan
$build auto
$work start feature dingus --from main
```

Las instalaciones Global y Project Full generan los adapters localmente. Los
proyectos Overlay reutilizan la Foundation global y no los duplican. El dry-run
muestra los destinos generados; una actualización refresca un adapter
administrado que no fue modificado, mientras que una modificación manual
produce un conflicto seguro. Uninstall elimina únicamente Skills generados cuyo
ownership esté probado y que permanezcan sin cambios.

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

Desinstalación Global:

```bash
node /ruta/agent-skills/scripts/install-agent-standard.js \
  --global --host <host> --profile <profile> --uninstall
```

Desinstalación Project Full:

```bash
node /ruta/agent-skills/scripts/install-agent-standard.js \
  --project --host <host> --profile <profile> --uninstall
```

Previsualización de cualquier desinstalación:

```bash
node /ruta/agent-skills/scripts/install-agent-standard.js \
  --project --host <host> --profile <profile> --uninstall --dry-run
```

No uses `--uninstall` sin un manifest existente: el installer no elimina archivos
no registrados de forma automática.

Consulta las [guías de Host](../adapters/README.md) para destinos nativos.
