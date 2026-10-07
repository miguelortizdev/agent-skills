# Skills

🇺🇸 English | 🇪🇸 [Español](../es/skills.md)

## Current Catalog

- 26 production Skills
- 25 Base Skills
- 1 production Contextual Skill: `vercel-react-best-practices`

Both `default` and `decameron` Profiles select the same 25-Skill Foundation.
`decameron` additionally selects corporate MCP.

## Base And Contextual Skills

Base Skills describe durable engineering workflows and are always selected by the
Profiles. A Contextual Skill is an optional Registry asset selected from bounded
project facts. The current production catalog includes the Vercel React and
Next.js Skill, and the generic engine remains ready for future additions.

## Skill Anatomy

A Skill lives at `skills/<name>/SKILL.md` and follows the anatomy in
[Skill anatomy](../skill-anatomy.md): frontmatter, Overview, When to Use,
Process, Verification, and anti-rationalization guidance where appropriate.

Skills are selected by canonical ID. The Registry is the source of paths and
dependencies; Profiles do not embed Skill content.

## Tests And Evals

Run structural validation with `node scripts/validate-skills.js`. Add focused
tests and routing evals for new behavior. Contextual fixtures may define
synthetic Skills in test-only Registries; they are not production catalog assets.

See [Contributing](contributing.md) for the extension workflow.
