# Solución De Problemas

🇪🇸 Español | 🇺🇸 [English](../en/troubleshooting.md)

## Problemas Comunes

| Síntoma | Revisión |
| --- | --- |
| No se encuentra Global Foundation | Instala globalmente el mismo Host/Profile antes de `sync`. |
| Profile incompatible | Desinstala primero el Profile existente para ese Host y alcance. |
| Host incompatible | Usa el Host propietario de la Foundation global. |
| Falta entorno MCP | Revisa referencias requeridas como `KUBECONFIG`. |
| No hubo Contextual Skills | Verifica que el proyecto contenga `react`, `react-dom` o `next` en un `package.json` acotado. |
| Conflicto de ownership | Revisa el manifest y no sobrescribas archivos modificados. |
| Archivo existente no administrado | Mueve o revisa el archivo; el installer rechaza sobrescrituras inseguras. |
| Error de Registry | Ejecuta `node scripts/validate-registry.js` y corrige el asset/regla indicado. |
| Error de Skill | Ejecuta `node scripts/validate-skills.js` y revisa anatomy/frontmatter. |
| Limitación del adapter | Revisa la matriz del Host y la guía compartida de adapters. |

## Diagnóstico Seguro

Empieza con un dry-run:

```bash
node scripts/install-agent-standard.js \
  --host codex --profile decameron --project --dry-run
```

Después ejecuta los validadores relevantes:

```bash
node scripts/validate-registry.js
node scripts/validate-profiles.js
node scripts/validate-mcp.js
node scripts/validate-adapter-drift.js
```

No borres `.agent-standard` ni archivos del Host manualmente cuando el ownership
no sea claro. Usa primero el `--uninstall --dry-run` correspondiente.
