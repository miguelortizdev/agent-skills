# Context-Aware Skills

Context-aware Skills add targeted guidance to a normal Profile without replacing
its foundation. Project installation reads bounded local facts, resolves
declarative rules from `registry/catalog.json`, and sends the resulting
canonical Skills through the existing installer and adapters.

## Detection

Detection is deterministic and local. It does not use an LLM, the network,
project scripts, package-manager commands, `.env` values, or project binaries.
The detector produces only generic facts: bounded file paths, directories,
dependency names, and text content from candidate files. It excludes `.git`,
host-managed installation directories, `node_modules`, `vendor`, build outputs,
coverage, caches, and temporary files.

The detector does not know what Next.js, Laravel, Spring Boot, OpenShift, or any
future technology is. Technology knowledge belongs only in the Registry rule
attached to a contextual Skill.

Supported contextual Skills:

| Skill | Evidence |
| --- | --- |
| `nextjs-vercel-engineering` | `next` dependency or `next.config.*` |
| `laravel-engineering` | `laravel/framework` or Laravel markers |
| `spring-boot-engineering` | Spring Boot markers in Maven/Gradle files |
| `openshift-engineering` | OpenShift API/resources, not generic Kubernetes |

Multiple matches are additive. A project can receive Next.js, Spring Boot, and
OpenShift guidance simultaneously.

## Scope And Dry Run

Context detection runs for project-scoped installations: both full `--project`
installs and the project Context Overlay. `--global` installs do not depend
silently on the current working directory. Use dry-run to see the detected
context, evidence, selected Skills, host, scope, and target files without
writing anything:

```bash
node scripts/install-agent-standard.js \
  --host codex --profile decameron --project --dry-run
```

Contextual Skills are recorded in the existing installation manifest. If a
later project reinstall no longer matches a contextual rule, only unchanged
files previously owned as contextual Skills are removed. Base Skills and user
files remain intact.

For an overlay, install the matching global foundation first and then run:

```bash
node scripts/install-agent-standard.js \
  sync --host codex --profile decameron --dry-run
```

The overlay manifest records `mode: overlay`, the inherited host/profile, the
detected context, evidence, and only files owned by contextual Skills. It does
not claim ownership of global Skills, Commands, Agents, References, or MCP.

## Adding A Contextual Skill

1. Create a standard `skills/<name>/SKILL.md` with the normal Skill anatomy.
2. Register it as a custom `skill` with `contextual: true` in `registry/catalog.json`.
3. Declare `appliesWhen` using the generic rule DSL below.
4. Add contextual rule tests/fixtures for positive, negative, and multi-stack cases.
5. Run registry, Skill, installer, and full-suite validation.

No Context Detector, Context Resolver, installer, or adapter changes are
required for a new technology. They consume generic facts and resolved
canonical asset IDs.

## Rule DSL

Rules are JSON objects in `registry/catalog.json`. Leaf rules may use:

| Rule | Purpose | Example |
| --- | --- | --- |
| `file` | Match one or more bounded paths | `{ "type": "file", "paths": ["next.config.ts"] }` |
| `path` | Match a file or directory path | `{ "type": "path", "match": "suffix", "paths": ["services/api"] }` |
| `dependency` | Match dependency names in manifest files | `{ "type": "dependency", "names": ["next"] }` |
| `text` | Match text patterns in bounded files | `{ "type": "text", "files": ["platform.yaml"], "patterns": ["route.openshift.io/"] }` |

Compose rules with `anyOf`, `allOf`, and `noneOf`:

```json
{
  "allOf": [
    { "type": "file", "paths": ["platform.yaml"] },
    { "anyOf": [
      { "type": "text", "files": ["platform.yaml"], "patterns": ["kind: FuturePlatform"] },
      { "type": "dependency", "names": ["future-platform-sdk"] }
    ] }
  ],
  "noneOf": [
    { "type": "text", "files": ["platform.yaml"], "patterns": ["legacy: true"] }
  ]
}
```

Adding a new contextual Skill is: create `SKILL.md`, register the asset,
configure `appliesWhen`, add tests/evals, and finish. Core scanner, resolver,
installer, and adapter code must not change for a new technology.

## Troubleshooting

- A false positive usually means a rule is too broad. Prefer a strong manifest dependency or an OpenShift-specific marker.
- A missing match should be reported with the expected local evidence and added as a focused detector fixture.
- `vercel.json` is not required for Next.js guidance; Vercel-specific advice is only appropriate when Vercel configuration is present.
- Global installs intentionally do not infer context from the current directory.
