# Context-Aware Skills

🇪🇸 Español | 🇺🇸 [English](../en/context-aware-skills.md)

El Generic Context Rules Engine selecciona Skills específicos de software a
partir de evidencia acotada del proyecto. Contextual Skills productivos: **1**.

El primer Contextual Skill productivo es `vercel-react-best-practices`, adaptado
de [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) y
mantenido por Vercel Engineering bajo la licencia MIT. Se activa cuando el
manifest del proyecto declara `react`, `react-dom` o `next`.

## Reglas Genéricas

Las reglas `appliesWhen` del Registry soportan estos tipos hoja:

| Regla | Significado |
| --- | --- |
| `file` | Coincide con rutas de archivos acotadas |
| `path` | Coincide con rutas de archivos o directorios |
| `dependency` | Coincide con nombres de dependencias en manifests JSON |
| `text` | Coincide con texto en archivos acotados |

Combina reglas con `anyOf`, `allOf` y `noneOf`.

```json
{
  "allOf": [
    { "type": "file", "paths": ["platform.yaml"] },
    { "anyOf": [
      { "type": "text", "files": ["platform.yaml"], "patterns": ["kind: FuturePlatform"] },
      { "type": "dependency", "names": ["future-platform-sdk"] }
    ] }
  ],
  "noneOf": [{ "type": "text", "files": ["platform.yaml"], "patterns": ["legacy: true"] }]
}
```

## Flujo De Extensión

1. Crea `skills/<name>/SKILL.md`.
2. Registra el asset en `registry/catalog.json`.
3. Configura `appliesWhen`.
4. Agrega tests contextuales y routing evals.
5. Valida y abre un PR.

No se requiere cambiar Context Detector, Resolver, Installer ni Adapter.

**SOLO EJEMPLO — NO FORMA PARTE DEL CATÁLOGO PRODUCTIVO:** un asset de test
`redis-engineering` puede usar una regla `text` para `docker-compose.yml`. El
mismo motor genérico lo resuelve sin registro productivo.

Consulta [Arquitectura](architecture.md) para los límites y
[Solución de problemas](troubleshooting.md) cuando no hay coincidencias.
