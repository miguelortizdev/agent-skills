# Sincronización Upstream

🇪🇸 Español | 🇺🇸 [English](../en/upstream-sync.md)

Los cambios upstream deben tratarse como migraciones, no como copias ciegas:

```text
actualización upstream/main
        ↓
rama temporal de sync
        ↓
merge o rebase
        ↓
resolver conflictos
        ↓
regresión completa
        ↓
PR
```

Un merge de Git sin conflictos no garantiza compatibilidad funcional. Revisa IDs
del Registry, Profiles, Commands, Agents, References, adapters, MCP y ownership
después de cada sync.

## Actualizar El Estándar

1. Actualiza el repositorio del estándar desde la revisión upstream aprobada.
2. Ejecuta validación de Registry, Profiles, Skills, adapters, MCP, routing y parity.
3. Haz commit de la migración en una rama dedicada y abre un PR.
4. Reinstala o reconcilia la Foundation global:

```bash
node scripts/install-agent-standard.js \
  --global --host codex --profile decameron
```

5. Ejecuta `sync` en cada proyecto que use esa Foundation.

Nunca incluyas secretos ni cambies ownership silenciosamente. Conserva los
archivos locales del usuario e investiga los conflictos antes del merge.
