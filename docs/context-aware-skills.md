# Context-Aware Skills

Context-aware Skills add technology-specific guidance to a normal Profile
without replacing its foundation. Project installation reads bounded local
metadata, resolves declarative rules from `registry/catalog.json`, and sends
the resulting canonical Skills through the existing installer and adapters.

## Detection

Detection is deterministic and local. It does not use an LLM, the network,
project scripts, package-manager commands, `.env` values, or project binaries.
The detector reads known manifests and bounded files while excluding `.git`,
`node_modules`, `vendor`, build outputs, coverage, caches, and temporary files.

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

Context detection runs for `--project` installations only. `--global` installs
do not depend silently on the current working directory. Use dry-run to see the
detected context, evidence, selected Skills, host, scope, and target files
without writing anything:

```bash
node scripts/install-agent-standard.js \
  --host codex --profile decameron --project --dry-run
```

Contextual Skills are recorded in the existing installation manifest. If a
later project reinstall no longer matches a contextual rule, only unchanged
files previously owned as contextual Skills are removed. Base Skills and user
files remain intact.

## Adding A Contextual Skill

1. Create a standard `skills/<name>/SKILL.md` with the normal Skill anatomy.
2. Register it as a custom `skill` with `contextual: true` in `registry/catalog.json`.
3. Declare `appliesWhen.any` using dependency, file, or bounded text signals.
4. Add detector/resolver fixtures for positive, negative, and multi-stack cases.
5. Run registry, Skill, installer, and full-suite validation.

No adapter changes are required. Do not add framework-specific logic to the
installer; the installer consumes resolved canonical asset IDs.

## Troubleshooting

- A false positive usually means a rule is too broad. Prefer a strong manifest dependency or an OpenShift-specific marker.
- A missing match should be reported with the expected local evidence and added as a focused detector fixture.
- `vercel.json` is not required for Next.js guidance; Vercel-specific advice is only appropriate when Vercel configuration is present.
- Global installs intentionally do not infer context from the current directory.
