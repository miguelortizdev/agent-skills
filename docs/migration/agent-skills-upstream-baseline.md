# Upstream `agent-skills` Baseline

## Source Capture

- Repository: `https://github.com/addyosmani/agent-skills.git`
- Commit SHA: `1401c8b8030e023baeebb31781a6653fe8e93026`
- Capture method: `git clone --depth 1`
- Capture date: 2026-10-06
- License: MIT
- Copyright: Addy Osmani, 2025
- Captured upstream tree: identical to the current repository `HEAD` at the
  time of capture.

The SHA is the authority for this migration. Counts below describe that tree;
they are not assumptions about future upstream versions.

## Asset Counts

| Capability | Canonical count | Tracked file count | Inventory |
| --- | ---: | ---: | --- |
| Skills | 25 | 32 | 25 `SKILL.md` files plus skill-local references, examples, criteria, and one helper script. |
| Commands | 9 | 27 | 9 canonical TOMLs, 9 Claude command wrappers, and 9 Gemini TOMLs. |
| Agents | 4 | 4 | `code-reviewer`, `security-auditor`, `test-engineer`, `web-performance-auditor`. |
| Shared references | 7 | 7 | Accessibility, definition of done, observability, orchestration, performance, security, and testing. |
| Evals | 25 case files | 84 | 25 routing cases, fixtures, plugin evals, eval README, and impact metadata. |
| Hooks | 9 | 9 | 5 shell/test files plus 2 hook documentation files and the session/cache helpers. |
| Validation scripts | 8 entry/test areas | 14 | Validators, eval runner, skill lint library, and focused tests. |
| Plugin manifests | n/a | 5 | Root plugin, Claude plugin/marketplace, Codex plugin, and agents marketplace metadata. |
| Host integration markers | n/a | 2 tracked entries | Claude contribution rules and OpenCode skills integration marker; other host setup is documented under `docs/`. |
| Setup and operational docs | n/a | 17 | Host setup, onboarding, adoption, comparison, and skill anatomy documentation. |

## Canonical Paths

The upstream repository establishes these source paths and they must remain
available after the standardization:

```text
skills/
commands/
agents/
references/
evals/
hooks/
scripts/
docs/
AGENTS.md
CLAUDE.md
LICENSE
plugin.json
```

Host-specific paths present in the baseline are retained as native integration
surfaces, not converted into canonical content:

```text
.agents/plugins/marketplace.json
.claude-plugin/marketplace.json
.claude-plugin/plugin.json
.claude/commands/
.claude/rules/
.codex-plugin/plugin.json
.gemini/commands/
.opencode/skills
```

## Evaluation Coverage

- Tier 2 deterministic routing and structural evaluation is implemented by
  `scripts/run-evals.js`.
- All 25 skills have a matching `evals/cases/<skill>.json` file.
- The captured run reported 141 passed checks, no errors or warnings, and a
  100% rank-1 rate across 89 positive prompts.
- Tier 3 behavioral/plugin evaluations are present under `evals/plugin/` and
  are opt-in because they require an external model/runtime.
- `evals/README.md` remains the specification for tier semantics and execution
  expectations.

## Existing Native Capabilities

The baseline includes, and the target architecture must preserve:

- Claude plugin and marketplace installation.
- Codex native plugin metadata and root-level Skill discovery.
- Gemini command representations.
- OpenCode project integration marker and setup guidance.
- Setup guidance for Cursor, Antigravity, Copilot, Copilot CLI, Command Code,
  Windsurf, and other agents.
- Session-start, SDD cache, and simplify-ignore hook workflows.
- Plugin installation CI and deterministic validation scripts.
- MIT license, attribution, and upstream repository metadata.

## Baseline Parity Statement

At capture time:

```text
Upstream canonical Skills: 25
Current canonical Skills: 25
Upstream canonical Commands: 9
Current canonical Commands: 9
Upstream Agents: 4
Current Agents: 4
Upstream shared References: 7
Current shared References: 7
Upstream Evals: present
Current Evals: present
Upstream Hooks: present
Current Hooks: present
Upstream Scripts: present
Current Scripts: present
Functional loss at baseline: NONE
```

This baseline does not claim that the requested multi-agent standardization is
complete. It only proves that the starting tree contains the upstream feature
set at the captured SHA. New registry, profile, MCP, adapter, installer, drift,
and upstream-update capabilities are additive work tracked by the migration
parity matrix.
