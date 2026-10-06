# Canonical AI Engineering Standard

## Purpose

This repository is a reusable AI Engineering platform. It preserves the full
capability set of `addyosmani/agent-skills` and adds portable metadata,
profiles, provider-neutral MCP definitions, host adapters, installation, drift
detection, and upstream synchronization checks.

The upstream content remains the compatibility baseline. The standardization
layer is additive and must never require a host-specific fork of a canonical
Skill, Command, Agent, Reference, Hook, Eval, or validation script.

## Canonical Layout

The source of truth is deliberately kept at the repository root because the
supported native integrations already understand these paths:

```text
/
├── skills/                 # Canonical Skill workflows
├── agents/                 # Canonical specialist agents
├── commands/               # Canonical lifecycle command metadata
├── references/             # Shared engineering references
├── evals/                  # Structural, routing, and behavioral evals
├── hooks/                  # Hook implementations and documentation
├── scripts/                # Validators, installers, and sync tools
├── docs/                   # User, host, migration, and architecture docs
├── registry/               # Metadata registry; never canonical content
├── profiles/               # Asset selections and configuration
├── standards/              # Corporate policy additions
├── mcp/                    # Provider-neutral MCP metadata
├── adapters/               # Thin per-host mappings and fallbacks
│   ├── claude/
│   ├── codex/
│   ├── cursor/
│   ├── opencode/
│   ├── gemini/
│   └── openchamber/
├── .claude-plugin/         # Native Claude plugin surfaces
├── .codex-plugin/          # Native Codex plugin surfaces
├── .opencode/              # Native OpenCode surfaces
├── .gemini/                # Native Gemini surfaces
├── .agents/                # Native marketplace surfaces
├── AGENTS.md
├── CLAUDE.md
├── plugin.json
└── LICENSE
```

`core/skills`, `core/commands`, and `core/agents` are intentionally not used as
primary locations. Moving canonical assets there would force unnecessary
generation or copying for hosts that already consume the standard root paths.

## Architectural Principles

### Single Source of Truth

Each canonical asset exists once. For example:

```text
skills/api-and-interface-design/SKILL.md
```

The registry stores metadata about that file; it does not embed its content.
Profiles select the asset by ID. Adapters map the asset to host conventions.
Generated host files must never become a second authoritative copy.

### Thin Adapters

An adapter contains only host-specific differences:

- discovery paths and file naming;
- supported command or agent representation;
- native plugin metadata;
- MCP configuration translation;
- installation scope and conflict rules;
- documented fallback when a host lacks a capability.

An adapter must not rewrite generic engineering guidance or silently remove an
asset that the host cannot load.

### Host-Independent Canonical Assets

Skills, Agents, References, Evals, Hooks, and scripts describe capabilities and
workflows, not vendor behavior. Vendor names belong in adapters, setup docs, or
host-specific command wrappers only when required for execution.

### Progressive Disclosure

Asset metadata must support discovery without loading every workflow. Each
Skill keeps a concise `name` and `description` in its frontmatter. The registry
indexes those fields and paths, while full content is loaded only after a host
selects or invokes an asset.

Native routing remains preferred when the host provides it. The
`using-agent-skills` meta-skill remains available as a portable fallback and is
not unnecessarily preloaded into hosts with native discovery.

### Cross-Platform Operations

Canonical content is plain text and JSON. Installation and validation tooling
uses Node.js APIs for path handling, file access, and platform detection so it
works on macOS, Linux, and Windows. Shell hooks remain preserved upstream
capabilities; they are not the only installation mechanism.

Symlinks may be used as an optional optimization where a host explicitly
supports them, but correctness must not depend on symlinks. The default
installer copies or writes explicit host configuration and reports every action.

### No Secrets

Registry, profile, adapter, and MCP files may contain command names, arguments,
paths, and references such as `${KUBECONFIG}`. They must never contain tokens,
passwords, API keys, credentials, client secrets, or generated secret values.

MCP providers are described independently from secret storage. Host adapters
translate environment variable references only when the host requires a
different configuration shape.

## Capability Flow

```text
canonical asset
      ↓
registry metadata
      ↓
profile selection
      ↓
host adapter
      ↓
native host implementation
      OR
documented compatibility fallback
```

The reverse flow is not allowed: a host-specific generated file must not become
the source for canonical content.

## Asset Responsibilities

| Asset | Responsibility | Must not do |
| --- | --- | --- |
| Skill | Reusable workflow, quality gates, and operating guidance | Encode a host-only path without a fallback or adapter boundary. |
| Command | User-facing lifecycle entry point | Replace the underlying Skill or exist only for one host. |
| Agent | Specialist perspective and output contract | Be silently folded into a Skill. |
| Reference | Shared supporting knowledge | Be copied into every Skill without a concrete portability need. |
| Eval | Structural, routing, or behavioral evidence | Be reduced to a unit test that no longer tests agent behavior. |
| Hook | Lifecycle automation supported by a host | Become mandatory for hosts that cannot execute it. |
| Registry | IDs, paths, provenance, enablement, and metadata | Store duplicated asset content or secrets. |
| Profile | Select and configure existing assets | Copy or fork Skills, Commands, or Agents. |
| MCP entry | Provider-neutral launch metadata and env references | Embed credentials or host-specific secrets. |
| Adapter | Host mapping, installation, and fallback behavior | Rewrite canonical engineering guidance. |

## Compatibility and Fallbacks

When a host lacks a native feature, the migration records the limitation in the
parity matrix and adapter docs. The preferred fallback order is:

1. Native host representation using the canonical path.
2. A thin generated wrapper that points to canonical content.
3. A documented manual invocation or system-prompt fallback.
4. `NOT_SUPPORTED_BY_HOST` with an explicit explanation and retained canonical
   asset.

No fallback may claim `VERIFIED` until a deterministic mapping test or native
host check provides evidence.

## Validation Boundaries

Every change follows this order:

```text
canonical content or metadata change
        ↓
focused validator/test
        ↓
git diff --check
        ↓
commit one logical change
        ↓
cross-host and parity validation
```

Deterministic checks run in CI. External-model behavioral evals remain an
additional quality gate and are documented as opt-in when they require a model
or host runtime.

At minimum, validation must reject:

- duplicate registry IDs;
- unknown asset types;
- missing or escaping paths;
- broken references;
- profile references to missing assets;
- adapters that omit registered capabilities;
- duplicate generated canonical assets;
- secrets in registry, profile, MCP, or adapter configuration.

## Upstream Governance

`upstream/agent-skills.json` records the exact source repository, commit, and
license. `scripts/check-agent-skills-upstream.js` compares the stored baseline
with a fetched upstream tree and reports additions, removals, and changes. It
does not update files automatically.

Any intentional fork or customization of upstream content must be recorded in
the parity matrix and provenance documentation. An upstream update is not
complete until all changed capabilities are reconciled and the deterministic
parity checks pass.

## Security and Maintenance Rules

- Never overwrite an existing host configuration silently.
- Resolve all paths relative to a known repository or installation root.
- Reject absolute paths and path traversal in generated asset destinations.
- Validate registry and profile references before installation.
- Keep generated files distinguishable from canonical files.
- Preserve upstream license and attribution in redistributed installations.
- Do not lower eval thresholds or suppress validator failures to obtain green CI.
