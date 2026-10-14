---
name: work-lifecycle
description: Use when starting, switching, or closing isolated engineering work items with Git branches, Worktrees, and archived specification documents.
---

# Work Lifecycle

## Overview

This Skill coordinates the lifecycle of feature, bugfix, hotfix, refactor,
chore, and spike work without adding a database or changing remote Git state.
Git branches and Worktrees are the source of truth. The bundled `scripts/work.js`
script performs deterministic local operations; this Skill supplies the safety
rules and decision points around it.

## When to Use

Use for `/work start`, `/work switch`, and `/work close`. Use `/spec` and `/plan`
separately to create the documents that `/work close` archives.

## Process

1. Confirm the repository root, current branch, Worktrees, and working-tree state.
2. For `start`, validate the type and name. Use `--from <reference>` to create a new branch, validating the source, active work, and inherited documents first. If the current work is active or dirty, create an isolated Worktree automatically from the explicit reference; never stash or commit the original work.
3. For `switch`, discover matching Worktrees and report the exact path without changing directories or files.
4. For `start --existing`, require the local branch to exist and ignore inherited-document protection. Use `git worktree list --porcelain` to report an existing Worktree, stop on locked, prunable, or inaccessible entries, switch only when the current tree is clean and has no active work, and otherwise create a Worktree with the existing branch and no `-b`. Never fetch or select a remote-only branch.
5. For `close`, identify the current work from the branch, preflight documents and destinations, refuse pending checklist items unless `--allow-incomplete` is explicit, capture a durable private snapshot, move only existing documents, verify their hashes and Git blob IDs, stage through an isolated temporary index, and validate the exact tree before the reference update.
6. The close policy runs `pre-commit`, `prepare-commit-msg`, `commit-msg`, and `post-commit` exactly once in Git order. It uses `commit-tree` plus an expected-HEAD `update-ref`; if commit signing is required but cannot be preserved by this deterministic path, it blocks safely.
7. On a failed close, restore moved source documents only when the destination is absent or unchanged. Recreated or modified files are never overwritten; both versions and a private durable recovery snapshot are preserved. A retry must distinguish recoverable partial archives from already committed archives.
8. Stop on ambiguity, unsafe changes, destination conflicts, or failed preflight. Never use remote or destructive Git operations.

## Common Rationalizations

| Rationalization | Reality |
| --- | --- |
| "The tree is clean, so no work is active." | A clean branch or Worktree can still contain an active specification and unfinished tasks. |
| "I can infer the source branch." | The developer controls the source reference; ask or require `--from`. |
| "Close can stage everything safely." | Only the work documents belong in the archive commit. |

## Red Flags

- The requested branch already exists.
- The source reference cannot be resolved.
- Another active work item shares the current directory.
- `SPEC.md`, `tasks/plan.md`, or `tasks/todo.md` would be inherited unexpectedly.
- The working tree contains document conflicts or unsafe filesystem changes; unrelated changes are preserved outside the isolated close index.
- A pre-commit or commit-message hook adds paths outside the document set.
- A hook changes a prepared blob, removes a document, or recreates a source document during rollback.
- `tasks/todo.md` contains unchecked checklist items and `--allow-incomplete` was not supplied.
- The historical destination already contains any target document.
- Git reports a conflict or commit failure.

## Verification

- Run the script's focused tests with `node --test scripts/work-lifecycle-test.js` from the repository.
- Use temporary Git repositories for branch, Worktree, interruption, and commit-failure scenarios.
- Run `node scripts/test-all.js` before declaring the lifecycle complete.
- Confirm the close commit contains only document moves and approved original blobs, the developer's index is reconciled onto the new HEAD while preserving unrelated staged entries, and previous commits remain unchanged.
- Confirm hook counters and recovery snapshots show one hook execution per policy and no unsafe cleanup.
