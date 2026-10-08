# Current Repository Inventory

## Capture

- Repository: `addyosmani/agent-skills` fork
- Branch: `refactor/ai-agent-standardization`
- Capture date: 2026-10-06
- Working tree at capture: clean
- Current `HEAD`: `1401c8b8030e023baeebb31781a6653fe8e93026`
- Current `HEAD` is also the captured upstream SHA; see `agent-skills-upstream-baseline.md`.

## Canonical Assets

The repository already uses the standard root-level layout for the upstream
assets. The current inventory is:

| Capability | Canonical location | Count | Notes |
| --- | --- | ---: | --- |
| Skills | `skills/<id>/SKILL.md` | 25 | Includes the `using-agent-skills` routing meta-skill. Several skills also contain local references or scripts. |
| Commands | `commands/*.toml` | 9 | `spec`, `planning`, `build`, `test`, `constraints`, `review`, `webperf`, `code-simplify`, `ship`. |
| Agents | `agents/*.md` | 4 | Code review, security, test, and web performance specialists. |
| Shared references | `references/*.md` | 7 | Checklists, orchestration patterns, testing patterns, and definition of done. |
| Evals | `evals/` | 84 files | Tier 2 cases, Tier 3 fixtures/plugin cases, README, and impact metadata. |
| Hooks | `hooks/` | 9 files | Session start, SDD cache, simplify-ignore scripts and documentation/tests. |
| Validation scripts | `scripts/` | 14 files | Structural validators, eval runner, tests, and shared lint library. |

## Host-Specific Integrations

| Host or integration | Current paths | Current behavior |
| --- | --- | --- |
| Claude Code | `.claude-plugin/`, `.claude/commands/`, `.claude/rules/` | Native plugin manifest, command wrappers, and contribution rules. |
| Codex | `.codex-plugin/plugin.json` | Native plugin manifest points Codex at the root `skills/` directory. |
| Gemini CLI | `.gemini/commands/` | TOML command representations in addition to canonical commands. |
| OpenCode | `.opencode/skills` | Existing host entry is present; the tracked path is an integration marker rather than a second canonical skill tree. |
| Claude marketplace / agent marketplace | `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json` | Marketplace metadata for native installation. |
| Other documented hosts | `docs/*-setup.md` | Cursor, Antigravity, Copilot, Command Code, Windsurf, Gemini, Codex, and OpenCode setup guidance. |

## Plugin and Project Metadata

- `plugin.json` contains the package name, version `0.6.12`, and description.
- `.claude-plugin/plugin.json` contains Claude metadata, command paths, skill
  path, author, repository, license, and plugin eval location.
- `.codex-plugin/plugin.json` contains the Codex plugin metadata.
- Marketplace manifests are retained under `.claude-plugin/` and `.agents/`.
- `LICENSE` retains the MIT license and Addy Osmani copyright notice.
- `AGENTS.md` and `CLAUDE.md` provide repository-level agent guidance.

## Existing Validation and CI

The current deterministic validation surface is:

```text
node scripts/validate-skills.js
node scripts/validate-commands.js
node scripts/validate-reference-links.js
node scripts/validate-artifact-paths.js
node scripts/validate-versions.js
node scripts/run-evals.js
```

The repository also includes focused test files for the validators, eval runner,
skill lint library, and hook behavior. `.github/workflows/test-plugin-install.yml`
validates plugin installation in CI.

The baseline run completed successfully at capture time:

- 25 skills checked, no errors or warnings.
- 9 canonical commands checked, no errors.
- Reference links valid.
- Artifact paths valid.
- Plugin versions consistent at `0.6.12`.
- 141 deterministic eval checks passed.
- Trigger rank-1 rate: 100% (`89/89`).

## Duplication and Vendor-Specific Configuration

The canonical command definitions live in `commands/`. Claude and Gemini have
host-specific command representations under `.claude/commands/` and
`.gemini/commands/`. These are intentional compatibility representations, but
there is currently no registry or drift validator proving that they remain in
sync with the canonical command set.

The root `skills/`, `agents/`, `references/`, `evals/`, `hooks/`, and `scripts/`
trees are the source content. No host-specific duplicate Skill or Agent trees
were found in the captured repository.

## Missing Target Architecture Components

The following requested components are not present yet:

- `registry/catalog.json`, `registry/hosts.json`, and registry schemas.
- `profiles/default.json` and `profiles/decameron.json`.
- Provider-neutral `mcp/registry.json`, schemas, and documentation.
- Explicit `adapters/` directories for Claude, Codex, Cursor, OpenCode,
  Gemini, and OpenChamber.
- Cross-platform installer with dry-run and safe conflict handling.
- Adapter drift validation and upstream change detection.
- Upstream provenance manifest and final parity report.
- A single cross-host structural quality-gate pipeline.

## Migration Risks

1. **Command drift:** Host command formats currently coexist without a shared
   metadata contract. A registry must remain metadata-only and must not replace
   the native files that hosts already consume.
2. **Unsupported host features:** Cursor, Gemini, OpenCode, and OpenChamber may
   not expose equivalent command, agent, or MCP discovery. Adapters must retain
   the canonical capability and document a fallback rather than deleting it.
3. **Generated duplication:** Installers that copy canonical assets can create
   stale files. The installer and drift validator must distinguish generated
   host configuration from canonical content and refuse unsafe overwrites.
4. **Upstream divergence:** The captured upstream SHA is currently identical to
   `HEAD`, but future upstream changes must be detectable without silently
   applying them.
5. **Cross-platform execution:** Existing hooks are shell scripts. They must be
   accounted for as native capabilities while new installation tooling remains
   usable on macOS, Linux, and Windows.
6. **External-model eval cost:** Tier 3 behavioral evaluations are intentionally
   opt-in. Deterministic structural and routing checks must remain the default
   CI gate.

## Migration Constraints

- Preserve all captured upstream assets and their paths unless an adapter
  explicitly documents a host compatibility fallback.
- Keep root-level `skills/`, `commands/`, `agents/`, `references/`, `evals/`,
  `hooks/`, and `scripts/` as the canonical source of truth.
- Add metadata and adapters without copying Skill or Agent content.
- Preserve MIT licensing, attribution, plugin manifests, native integrations,
  and existing validation behavior.
