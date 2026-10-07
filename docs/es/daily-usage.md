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

Usa la superficie de Commands que soporte tu Host. En Hosts sin Commands
nativos, el installer mantiene disponibles los Skills subyacentes como fallback
documentado.

Para un proyecto nuevo, ejecuta `sync --host <host> --profile decameron` después
de instalar la Foundation global. Hoy ese Overlay no tiene Contextual Skills
productivos para instalar; futuras entradas del Registry pueden agregarlos
automáticamente.

Consulta [Skills](skills.md) para elegir un Skill directamente y
[Solución de problemas](troubleshooting.md) cuando un Command o instalación no
esté disponible.
