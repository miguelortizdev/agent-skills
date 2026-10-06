# Upstream Feature Parity Matrix

## Contract

This matrix compares the captured upstream tree at
`1401c8b8030e023baeebb31781a6653fe8e93026` with this repository. It is the
contract for the migration: an upstream capability may be copied, adapted, or
exposed through a fallback, but it may not disappear.

Allowed status values are `NOT_STARTED`, `MIGRATED`, `ADAPTED`, `VERIFIED`, and
`NOT_SUPPORTED_BY_HOST`. The last value requires an explanation and a
documented compatibility path where technically possible.

Host columns describe the current evidence in the repository, not a claim that
all native host adapters have already been implemented.

## Upstream Assets

| Capability | Upstream Path | Current Repository | Target Path | Claude | Codex | Cursor | OpenCode | Gemini | OpenChamber | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `api-and-interface-design` Skill | `skills/api-and-interface-design/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `browser-testing-with-devtools` Skill | `skills/browser-testing-with-devtools/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `ci-cd-and-automation` Skill | `skills/ci-cd-and-automation/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `code-review-and-quality` Skill | `skills/code-review-and-quality/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `code-simplification` Skill | `skills/code-simplification/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `constraint-driven-development` Skill | `skills/constraint-driven-development/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Includes local `references/floor-guard.md`. |
| `context-engineering` Skill | `skills/context-engineering/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `debugging-and-error-recovery` Skill | `skills/debugging-and-error-recovery/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `deprecation-and-migration` Skill | `skills/deprecation-and-migration/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `documentation-and-adrs` Skill | `skills/documentation-and-adrs/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `doubt-driven-development` Skill | `skills/doubt-driven-development/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `frontend-ui-engineering` Skill | `skills/frontend-ui-engineering/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `git-workflow-and-versioning` Skill | `skills/git-workflow-and-versioning/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `idea-refine` Skill | `skills/idea-refine/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Includes examples, frameworks, criteria, and helper script. |
| `incremental-implementation` Skill | `skills/incremental-implementation/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `interview-me` Skill | `skills/interview-me/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `observability-and-instrumentation` Skill | `skills/observability-and-instrumentation/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `performance-optimization` Skill | `skills/performance-optimization/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Includes local optimization reference. |
| `planning-and-task-breakdown` Skill | `skills/planning-and-task-breakdown/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `security-and-hardening` Skill | `skills/security-and-hardening/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Includes local hardening reference. |
| `shipping-and-launch` Skill | `skills/shipping-and-launch/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `source-driven-development` Skill | `skills/source-driven-development/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `spec-driven-development` Skill | `skills/spec-driven-development/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `test-driven-development` Skill | `skills/test-driven-development/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Canonical content already present. |
| `using-agent-skills` Skill | `skills/using-agent-skills/SKILL.md` | same | same | VERIFIED | VERIFIED | ADAPTED | ADAPTED | ADAPTED | ADAPTED | VERIFIED | Routing meta-skill remains available; native discovery may bypass it. |
| Lifecycle Commands (9) | `commands/*.toml` | same | same | native Markdown variants | Skill fallback | documented fallback | `.opencode/commands/*.md` | preserved `.gemini/commands/*.toml` | `.opencode/commands/*.md` | VERIFIED | Keep all canonical commands and preserve host-native variants. |
| Specialist Agents (4) | `agents/*.md` | same | same | `.claude/agents` | Skill/manual fallback | documented fallback | `.opencode/agents` V2 subagents | `.gemini/agents` | `.opencode/agents` V2 subagents | ADAPTED | Agent content remains canonical; adapters add only host-required metadata. |
| Shared References (7) | `references/*.md` | same | same | packaged | packaged | documented fallback | packaged/project path | packaged | packaged/project path | VERIFIED | Shared links remain valid. |
| Tier 2 and Tier 3 Evals | `evals/` | same | same | plugin evals | adapter validation | adapter validation | adapter validation | adapter validation | adapter validation | VERIFIED | Deterministic evals remain CI-safe; behavioral evals remain opt-in. |
| Hooks | `hooks/` | same | same | native shell hooks | documented fallback | documented fallback | documented fallback | documented fallback | documented fallback | VERIFIED | Unsupported hooks remain canonical and documented. |
| Validation Scripts | `scripts/` | same | same | native repository tools | native repository tools | native repository tools | native repository tools | native repository tools | native repository tools | VERIFIED | Existing scripts remain the baseline quality gates. |
| Plugin Manifests | `plugin.json`, `.claude-plugin/`, `.codex-plugin/`, `.agents/` | same | same plus adapters | native manifests | native manifest | adapter metadata | adapter metadata | adapter metadata | adapter metadata | VERIFIED | Preserve native manifests and version consistency. |
| Host Setup Documentation | `docs/*-setup.md` | same | same plus adapter docs | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | Documentation is part of functional compatibility. |
| MIT License and Attribution | `LICENSE` | same | same | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | Must remain in all redistributed copies. |

## New Standardization Assets

These are additive target capabilities and therefore have no upstream path.
They must not duplicate or replace the upstream assets above.

| Capability | Upstream Path | Current Repository | Target Path | Claude | Codex | Cursor | OpenCode | Gemini | OpenChamber | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Canonical asset registry | n/a | present | `registry/catalog.json` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | Metadata only: IDs, types, paths, source, enabled state. |
| Host registry | n/a | present | `registry/hosts.json` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | Records native paths, scopes, and fallback behavior. |
| Registry schemas | n/a | present | `registry/schema/` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | Deterministic validation contract. |
| Default profile | n/a | present | `profiles/default.json` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | Selects assets without copying content. |
| Decameron profile | n/a | present | `profiles/decameron.json` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | Corporate selection/configuration only. |
| Provider-neutral MCP registry | n/a | present | `mcp/registry.json` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | Environment variable references only; no secrets. |
| Host adapters | n/a | present | `adapters/<host>/` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | Thin mappings, native representations, and documented fallbacks. |
| Cross-platform installer | n/a | present | `scripts/install-agent-standard.js` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | Node.js implementation; dry-run, scoped destinations, and safe writes. |
| Adapter drift validator | n/a | present | `scripts/validate-adapter-drift.js` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | Detects missing capabilities, invalid paths, scope errors, and duplicate generated assets. |
| Upstream provenance | n/a | present | `upstream/agent-skills.json` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | Stores repository, commit, and license. |
| Upstream update report | n/a | present | `scripts/check-agent-skills-upstream.js` | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | Reports changes; never updates automatically. |

## Parity Rules

1. A row marked `MIGRATED` or `VERIFIED` must retain its upstream path and
   content unless a deliberate fork/customization is recorded.
2. A row marked `ADAPTED` must identify the host-specific mapping or fallback in
   the corresponding adapter and host documentation.
3. `NOT_SUPPORTED_BY_HOST` is not permission to remove a canonical asset.
4. Every new registry/profile/MCP/adapter entry must resolve to an existing
   canonical asset or an explicitly documented host capability.
5. The final report may claim completion only when all upstream rows are
   `VERIFIED` or justified `ADAPTED` and functional loss is `NONE`.
