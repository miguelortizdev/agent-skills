# Upstream Sync

🇺🇸 English | 🇪🇸 [Español](../es/upstream-sync.md)

Upstream updates must be treated as migrations, not as blind file copies:

```text
upstream/main update
        ↓
temporary sync branch
        ↓
merge or rebase
        ↓
resolve conflicts
        ↓
full regression
        ↓
PR
```

A Git merge without conflicts does not guarantee functional compatibility.
Review Registry IDs, Profiles, Commands, Agents, References, adapters, MCP, and
ownership behavior after a sync.

## Update The Standard

1. Update the standard repository from the approved upstream revision.
2. Run registry, profile, Skill, adapter, MCP, routing, and parity validation.
3. Commit the migration on a dedicated branch and open a PR.
4. Reinstall or reconcile the global Foundation:

```bash
node scripts/install-agent-standard.js \
  --global --host codex --profile decameron
```

5. Run `sync` in each project using that Foundation.

Never include secrets or silently change ownership. Preserve local user files
and investigate any conflicts before merging.
