# Contribución

🇪🇸 Español | 🇺🇸 [English](../en/contributing.md)

Mantén el contenido canónico en la raíz del repositorio y descríbelo en el
Registry. Usa una rama enfocada, tests primero para cambios de comportamiento y
un PR con el reporte completo de validación.

## Agregar Un Skill Base

1. Crea `skills/<name>/SKILL.md`.
2. Registra el asset cuando el Registry de instalación lo requiera.
3. Agrega tests y routing evals.
4. Ejecuta `node scripts/validate-skills.js`, `node scripts/test-all.js` y los validadores relevantes.
5. Actualiza la documentación bilingüe del producto.
6. Abre un PR.

## Agregar Un Contextual Skill

1. Crea `SKILL.md`.
2. Registra el asset en `registry/catalog.json`.
3. Configura `appliesWhen` con el DSL genérico.
4. Agrega tests contextuales y evals.
5. Valida Registry, Profiles, instalación y routing.
6. Abre un PR.

No se requiere cambiar Context Detector, Resolver, Installer ni Adapter.

## Agregar MCP

1. Registra el servidor.
2. Agrégalo al Profile correspondiente.
3. Usa referencias respaldadas por el entorno.
4. Mapea las representaciones de los Hosts.
5. Agrega tests y ejecuta la validación MCP.
6. Abre un PR.

## Agregar Un Host

Actualiza la entrada del Host en el Registry, adapter, destinos nativos, matriz de
capacidades, ownership/uninstall, tests y validación de adapter drift. No copies
contenido de assets canónicos dentro de un adapter.

## Checks Requeridos

Ejecuta la suite oficial, routing evals, validación de Skills/Registry/Profiles/MCP,
adapter drift, upstream parity, checks de enlaces documentales y `git diff --check`.
