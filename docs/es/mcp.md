# MCP

🇪🇸 Español | 🇺🇸 [English](../en/mcp.md)

Los servidores MCP se registran una sola vez en `mcp/registry.json`. Los
Profiles seleccionan IDs y los Host Adapters los convierten a configuración
nativa. El Profile `decameron` selecciona `context7` y `kubernetes`; `default`
no selecciona MCP.

## Servidores Actuales

| ID | Transporte | Configuración |
| --- | --- | --- |
| `context7` | stdio | `npx -y @upstash/context7-mcp` |
| `kubernetes` | stdio | `kubernetes-mcp-server`, referencia opcional `KUBECONFIG` |

Las credenciales nunca se guardan en el Registry. Usa referencias a variables de
entorno y nunca pongas secretos literales en configuración o documentación.

## Representación Por Host

Los adapters usan la ruta y formato documentados de cada Host. Ejecuta primero
un dry-run:

```bash
node scripts/install-agent-standard.js \
  --host cursor --profile decameron --project --dry-run
```

Las entradas existentes se conservan. Conflictos, archivos inválidos, symlinks y
transportes no soportados detienen la operación en lugar de sobrescribir datos.

## Contribución Y Tests

1. Registra el servidor.
2. Agrégalo al Profile correspondiente.
3. Configura referencias de entorno.
4. Mapea la representación de cada Host.
5. Agrega tests y ejecuta `node scripts/validate-mcp.js`.
6. Abre un PR.

MCP es solo Foundation en Project Overlay. Un uninstall con ownership elimina
solo las entradas creadas por la instalación seleccionada.
