# Implementation Plan: Multi-Host MCP Installation

## Overview

Add canonical MCP resolution and host-native configuration installation to the
existing profile-based installer without moving canonical assets or changing
the existing ownership model.

## Architecture Decisions

- Keep `mcp/registry.json` as the only canonical MCP source.
- Resolve profile MCP IDs independently of host format, then delegate rendering
  and config paths to each adapter.
- Merge only managed MCP entries into existing host configuration files; refuse
  malformed files and conflicting managed names without overwriting them.
- Record MCP ownership in the existing per-host installation manifest.
- Support only documented host scopes and transports; report unsupported cases
  explicitly rather than guessing.

## Task List

### Phase 1: Contracts and validation
- [x] Define canonical stdio/http MCP schema and registry validation.
- [x] Add host MCP capability/scope/format metadata and resolver contracts.
- [x] Add profile MCP resolution and drift validation.

### Phase 2: Native configuration
- [x] Implement deterministic translators for each supported host.
- [x] Implement safe structured merge, conflict detection, and malformed-config refusal.
- [x] Integrate MCP actions into install, dry-run, ownership, and uninstall.

### Phase 3: Verification and docs
- [x] Add lifecycle, multi-host, scope, secret, and preservation tests.
- [x] Add runtime acceptance matrix and host support documentation.
- [x] Run full regression suite, routing evals, parity, and drift checks.

## Verification

- Baseline before changes: 161 tests passed, all existing validators passed, and
  89/89 routing prompts ranked first.
- Final gate: all existing tests plus MCP tests, `git diff --check`, and clean
  generated test environments. The worktree remains intentionally modified
  until the user reviews and commits the implementation.

## Open Limitations

- Host authentication flows are not automated; generated configs preserve
  environment references or native OAuth configuration without persisting
  credentials.
