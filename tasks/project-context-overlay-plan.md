# Implementation Plan: Project Context Overlay

## Overview

Add an opt-in project overlay mode that reuses the existing registry, profile,
context detection, adapters, and ownership logic while materializing only
contextual Skills in a project that already has a compatible global foundation.
Existing `--global` and `--project` behavior remains unchanged.

## Baseline

- Unified tests: 257/257
- Routing: 101/101
- Registry: 53 assets, 6 hosts
- Skills: 29 total, including 4 contextual Skills
- Upstream parity: 210/210
- Adapter drift: PASS
- Working tree: clean

## Architecture Decisions

- Add `overlay` as an explicit opt-in mode; keep `--global` and `--project` as
  the existing foundation and full-project modes.
- Represent the modes as `global`, `full`, and `overlay` in the installation
  plan and manifest. Legacy project manifests without `mode` are treated as
  `full`; legacy global manifests are treated as `global`.
- Overlay uses project destinations and the existing contextual resolver, but
  selects no profile foundation assets and never merges MCP.
- Overlay requires a matching global manifest for the same host and profile.
- A full project installation cannot be silently converted to an overlay;
  overlay-to-full is allowed by expanding the existing project ownership.
- No global project registry or disk-wide project scan is introduced.

## Task List

### Phase 1: Contract and tests
- [x] Add overlay CLI and manifest contract tests.
- [x] Add lifecycle tests for preconditions, idempotency, reconciliation,
  uninstall, dry-run, and full/global regressions.

### Phase 2: Installer implementation
- [x] Add plan mode resolution and global foundation validation.
- [x] Restrict overlay materialization to contextual Skills and isolate
  ownership.
- [x] Add mode-aware uninstall and safe legacy manifest handling.

### Phase 3: Documentation and verification
- [x] Document Global Foundation, Full Project, and Project Context Overlay.
- [x] Add the six-host support matrix and usage recommendations.
- [x] Run the full suite, routing, validators, parity, adapter drift, and diff
  checks.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| A project full manifest is mistaken for an overlay | High | Explicit mode checks and safe conversion error |
| Overlay accidentally merges foundation MCP | High | Build plan selects no MCP and tests inspect filesystem |
| Global foundation is missing or belongs to another host/profile | High | Validate global manifest before context detection or writes |
| Host discovery shadows global assets | Medium | Use existing project skill destinations and document/test each adapter |
| Existing manifests lack `mode` | Medium | Infer legacy global/project modes from `scope` |

## Verification

- All overlay lifecycle tests pass.
- Full project and global baseline tests remain green.
- Overlay filesystem contains contextual Skills only.
- Overlay manifests contain `mode`, host, profile, contextual evidence, and
  managed files without foundation ownership.
- No writes occur in dry-run or failed precondition paths.
