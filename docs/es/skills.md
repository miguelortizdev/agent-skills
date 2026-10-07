# Skills

🇪🇸 Español | 🇺🇸 [English](../en/skills.md)

## Catálogo Actual

- 26 Skills productivos
- 25 Skills base
- 1 Skill limitado al Profile: `vercel-react-best-practices` (solo decameron)

El Profile `default` selecciona la Foundation de 25 Skills. `decameron` agrega
`vercel-react-best-practices` y MCP corporativos.

## Skills Base Y Contextuales

Los Skills base describen flujos de trabajo de ingeniería duraderos y son
seleccionados por ambos Profiles. Un Contextual Skill es un asset opcional del
Registry que se selecciona a partir de facts acotados del proyecto. El Skill de
Vercel está limitado al Profile y no se selecciona automáticamente por evidencia.

## Anatomy De Un Skill

Un Skill vive en `skills/<name>/SKILL.md` y sigue la anatomy de
[Skill anatomy](../skill-anatomy.md): frontmatter, Overview, When to Use,
Process, Verification y guía anti-rationalization cuando corresponda.

Los Skills se seleccionan por ID canónico. El Registry es la fuente de rutas y
dependencias; los Profiles no contienen el texto de los Skills.

## Tests Y Evals

Ejecuta la validación estructural con `node scripts/validate-skills.js`. Agrega
tests enfocados y routing evals para nuevo comportamiento. Los fixtures
contextuales pueden definir Skills sintéticos en Registries de test; no son
assets del catálogo productivo.

Consulta [Contribución](contributing.md) para el flujo de extensión.
