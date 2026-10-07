# Implementation Plan: Context-Aware Skills

## Overview

Detect deterministic local technology signals, resolve declarative contextual
Skills from the canonical catalog, and add them to project-scoped installations
without changing Commands, Agents, host adapters, or the existing ownership
model.

## Architecture Decisions

- Context rules live in `registry/catalog.json`; no framework names are
  hardcoded in the installer.
- `scripts/lib/context-detector.js` only reads bounded local metadata and
  returns normalized evidence.
- `scripts/lib/context-resolver.js` maps evidence to enabled contextual Skills.
- Contextual Skills augment a profile and are installed through existing
  adapter paths.
- Global installs do not inspect the current project. Project installs detect
  context from the project root.
- Contextual ownership is recorded separately in the existing installation
  manifest so removed detections can be reconciled safely.

## Task List

### Phase 1: Contract and detection
- [ ] Add contextual catalog metadata and strict validation.
- [ ] Implement bounded deterministic context detection.
- [ ] Implement registry-driven context resolution with evidence.
- [ ] Add unit fixtures for positive and false-positive stack signals.

### Phase 2: Canonical Skills and installer
- [ ] Add Next.js, Laravel, Spring Boot, and OpenShift Skills.
- [ ] Add contextual Skills to the canonical catalog without changing profiles.
- [ ] Integrate project-only resolution into the installation plan.
- [ ] Reconcile removed contextual Skills through existing ownership safety.

### Phase 3: Verification and docs
- [ ] Add dry-run, multi-stack, monorepo, lifecycle, and six-host coverage.
- [ ] Document context detection, support, troubleshooting, and extension.
- [ ] Run the unified test suite, routing evals, validators, parity, and diff checks.

## Verification

- Baseline: 241/241 tests, routing 89/89, clean worktree.
- Final: unified suite includes all context tests, no-context behavior remains
  unchanged, and temporary project/global acceptance workspaces pass.

## Open Limitations

- Detection is intentionally evidence-based and does not execute project code,
  use network access, or inspect secret files.
