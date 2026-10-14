# Uso Diario

🇪🇸 Español | 🇺🇸 [English](../en/daily-usage.md)

Después de instalar la Foundation, usa los Commands del ciclo de vida mediante
la interfaz nativa del Host:

| Command | Uso |
| --- | --- |
| `/spec` | Definir requisitos antes de programar |
| `/plan` | Dividir el trabajo en tareas pequeñas |
| `/build` | Implementar incrementalmente con tests |
| `/test` | Probar comportamiento e investigar fallas |
| `/constraints` | Definir y hacer cumplir umbrales de calidad |
| `/review` | Revisar corrección, seguridad y mantenibilidad |
| `/webperf` | Auditar rendimiento del navegador |
| `/code-simplify` | Reducir complejidad innecesaria |
| `/ship` | Preparar un lanzamiento verificado |
| `/work` | Iniciar, cambiar o cerrar trabajos aislados |

Usa la superficie de Commands que soporte tu Host. En Hosts sin Commands
nativos, el installer mantiene disponibles los Skills subyacentes como fallback
documentado.

Para un proyecto nuevo, ejecuta `sync --host <host> --profile decameron` después
de instalar la Foundation global. El Overlay también mantiene el archivo de
instrucciones del proyecto del Host para usar Skills relevantes del proyecto
junto con los Skills base requeridos por los Commands.

## Ciclo De Trabajo

Usa `/work` únicamente para el ciclo local de ramas, Worktrees y documentos:

```text
/work start feature integracion-dingus --from develop
/work switch feature/integracion-dingus
/work close
```

Para retomar una rama local creada anteriormente, solicita explícitamente
`--existing`:

```text
/work start feature integracion-dingus --existing
/work switch integracion-dingus
/work start feature integracion-dingus --existing --worktree
```

`--existing` nunca selecciona una rama que solo exista en remoto, cambia
commits ni recrea un Worktree ocupado. Solo cambia a una rama local sin
Worktree cuando el directorio actual está limpio y no contiene otro trabajo
activo; en los demás casos asocia la rama a un Worktree aislado. El comando
informa las rutas, pero no cambia automáticamente el directorio de la
terminal ni del IDE.

Si el feature actual está sucio o ya está activo, otro `start` crea
automáticamente un Worktree aislado desde la referencia explícita de `--from`.
Así conserva los archivos sin commit y el historial de tareas del feature:

```text
/work start hotfix error-pagos --from main
/work switch feature/integracion-dingus
```

Nunca ejecuta push, pull, merge, rebase, reset, stash ni elimina ramas o
Worktrees. Usa `/spec` y `/plan` para crear los documentos que `/work close`
archiva bajo `docs/work-items/<type>/<name>/`. Las tareas sin marcar bloquean el
cierre por defecto; usa `/work close --allow-incomplete` solo después de decidir
explícitamente archivar trabajo incompleto.

El cierre captura un snapshot temporal privado, usa un índice Git aislado y
verifica los blobs aprobados antes de actualizar `HEAD`. Sus hooks se ejecutan
una sola vez y en orden Git. Si falla un hook o el commit, restaura los archivos
movidos solo cuando es seguro; los archivos recreados o modificados se conservan
junto con un snapshot durable bajo `.git/work-lifecycle/`. Tras un cierre exitoso,
el índice del desarrollador se reconcilia con el nuevo `HEAD` y conserva el staging
ajeno. Repite `/work close` después de resolver el
conflicto; un archivo ya confirmado se informa sin crear un commit vacío. El
Command instalado resuelve el script desde el Skill `work-lifecycle` instalado y
no depende de la estructura del repositorio fuente.

Consulta [Skills](skills.md) para elegir un Skill directamente y
[Solución de problemas](troubleshooting.md) cuando un Command o instalación no
esté disponible.
