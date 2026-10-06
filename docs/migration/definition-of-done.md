# AI Agent Standardization Definition of Done

This checklist is the release gate for the migration. It supplements the
repository-wide `references/definition-of-done.md` and may not be weakened to
make a failing gate pass.

## Upstream Preservation

- [ ] The upstream repository and exact baseline SHA are recorded.
- [ ] Every upstream Skill is accounted for and available at its canonical path.
- [ ] Every upstream Command is accounted for and available natively or through a documented fallback.
- [ ] Every upstream Agent/Subagent is accounted for and remains separate from Skills.
- [ ] Shared References are preserved and all links resolve.
- [ ] Hooks are preserved or have an explicit host fallback.
- [ ] Validation scripts and their focused tests remain available.
- [ ] Tier 1 structural, Tier 2 routing, and Tier 3 behavioral/plugin eval models are preserved.
- [ ] Plugin manifests, native integrations, license, and attribution are preserved.

## Standardization

- [ ] Root-level canonical paths remain the single source of truth.
- [ ] Registry IDs are unique, typed, enabled metadata and resolve to real paths.
- [ ] Profiles select assets without embedding or copying canonical content.
- [ ] MCP entries are provider-neutral and contain no secret values.
- [ ] Every supported host has a thin adapter with verified discovery paths and fallbacks.
- [ ] Adapter drift validation passes for every registered host.
- [ ] The installer supports `--host`, `--profile`, `--global`, `--project`, and `--dry-run`.
- [ ] Dry-run produces no filesystem changes.
- [ ] Safe installation never silently overwrites an existing conflicting file.
- [ ] Upstream comparison reports additions, removals, and changes without auto-updating content.
- [ ] Cross-platform behavior is covered for macOS, Linux, and Windows-compatible Node APIs.

## Verification

- [ ] `git diff --check` passes.
- [ ] Skill, command, reference, artifact-path, and version validators pass.
- [ ] Registry, profile, MCP, adapter drift, and upstream path parity validators pass.
- [ ] Deterministic routing evals pass at the checked-in threshold.
- [ ] Focused tests cover duplicate IDs, missing paths, broken references, conflicts, traversal, and secrets.
- [ ] No canonical assets are duplicated under a host directory in the repository.
- [ ] No secrets, credentials, tokens, passwords, or API keys are present.
- [ ] `git status` is clean and history uses atomic Conventional Commits.
- [ ] Final parity report states `Functional loss: NONE`.
