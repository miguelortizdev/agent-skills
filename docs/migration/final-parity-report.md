# Final Agent Standard Parity Report

## Compared Baseline

- Repository: `https://github.com/addyosmani/agent-skills.git`
- Baseline SHA: `1401c8b8030e023baeebb31781a6653fe8e93026`
- Provenance: `upstream/agent-skills.json`
- Baseline path check: 210 upstream paths present

## Capability Counts

| Capability | Upstream | Available in this repository | Result |
| --- | ---: | ---: | --- |
| Canonical Skills | 25 | 25 | VERIFIED |
| Canonical Commands | 9 | 9 | VERIFIED |
| Specialist Agents | 4 | 4 | VERIFIED |
| Shared References | 7 | 7 | VERIFIED |
| Routing eval cases | 25 | 25 | VERIFIED |
| Eval files and fixtures | present | present | VERIFIED |
| Hooks | 9 files | 9 files | VERIFIED |
| Validation scripts | 14 files | 14 baseline files plus standardization validators | VERIFIED |
| Plugin manifests | 5 | 5 | VERIFIED |
| License and attribution | MIT | MIT | VERIFIED |

## Standardization Additions

- Canonical registry: `registry/catalog.json`, `registry/hosts.json`, and schemas.
- Profiles: `profiles/default.json` and `profiles/decameron.json`.
- Provider-neutral MCP registry: `mcp/registry.json` and schema.
- Thin adapters: Claude, Codex, Cursor, OpenCode, Gemini, and OpenChamber.
- Host-native command preservation for Claude/Gemini and V2 subagent rendering
  for OpenCode/OpenChamber.
- Scope-specific project/global destinations with isolated installer coverage.
- Cross-platform Node.js installer with dry-run and conflict-safe writes.
- Registry, profile, MCP, adapter drift, and upstream path validators.
- Upstream provenance and report-only upstream change detection.
- Structural, cross-host, and routing CI quality gates.
- Migration-specific Definition of Done.

## Host Evidence

| Host | Evidence | Result |
| --- | --- | --- |
| Claude | Official plugin component docs, native manifest paths, adapter drift validation | VERIFIED statically |
| Codex | Official Skills/plugin docs, root `skills/` manifest, progressive disclosure preserved | VERIFIED statically |
| Cursor | Official Skills/Rules docs, `.cursor/skills` mapping, no long workflow pasted into rules | VERIFIED statically |
| OpenCode | Official Skills/Commands/Agents/MCP docs, `.opencode/{skills,commands,agents}` discovery mapping, V2 `mode: subagent` output | VERIFIED statically and by filesystem smoke tests |
| Gemini | Official Agent Skills/custom command/subagent/MCP docs, preserved native command variants, `.gemini/{skills,commands,agents}` workspace/user-scope mapping | VERIFIED statically and by filesystem smoke tests |
| OpenChamber | Official Skills, Commands, MCP, Repository Config docs and official source repository; mapped through OpenCode V2 plus `.openchamber/project.json` | VERIFIED statically and by filesystem smoke tests |

Static verification means official documentation was checked and deterministic
adapter/installer tests pass. It does not claim that every vendor CLI is
installed in this CI environment or that a paid/external host session was
executed.

## Validation Results

- `node scripts/validate-skills.js`: 25 checked, 0 errors, 0 warnings.
- `node scripts/validate-commands.js`: 9 checked, 0 errors.
- `node scripts/validate-reference-links.js`: passed.
- `node scripts/validate-artifact-paths.js`: passed.
- `node scripts/validate-versions.js`: passed.
- `node scripts/validate-registry.js`: 49 unique assets, 6 hosts.
- `node scripts/validate-profiles.js`: 2 profiles.
- `node scripts/validate-mcp.js`: 1 provider-neutral server.
- `node scripts/validate-adapter-drift.js`: 6 hosts passed.
- `node scripts/validate-upstream-parity.js`: 210 baseline paths present.
- `node scripts/run-evals.js --min-rank1 95`: 141 checks passed, rank-1 `100%` (`89/89`).
- New focused validator and installer tests: all passed.
- `git diff --check`: passed.

## Functional Loss

```text
Functional loss: NONE
```

All upstream capabilities remain available from their canonical paths. Hosts
that do not natively expose a particular upstream surface retain the canonical
asset and use an adapter mapping or documented fallback; no Skill, Command,
Agent, Reference, Hook, Eval, script, manifest, or license capability was
deleted.

## Remaining Operational Follow-Up

- Run vendor-specific smoke tests in environments where Claude, Codex, Cursor,
  OpenCode, Gemini, and OpenChamber are installed.
- Run Tier 3 external-model and plugin behavioral evals on the release cadence;
  they remain intentionally outside every commit's deterministic gate.
- Use `node scripts/check-agent-skills-upstream.js` before reconciling future
  upstream changes; it reports differences and never updates automatically.
