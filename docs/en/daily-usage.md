# Daily Usage

🇺🇸 English | 🇪🇸 [Español](../es/daily-usage.md)

After installing the Foundation, use the lifecycle Commands through the Host's
native interface:

| Command | Use it for |
| --- | --- |
| `/spec` | Define requirements before coding |
| `/plan` | Break work into small tasks |
| `/build` | Implement incrementally with tests |
| `/test` | Prove behavior and investigate failures |
| `/constraints` | Set and enforce quality thresholds |
| `/review` | Review correctness, security, and maintainability |
| `/webperf` | Audit browser performance |
| `/code-simplify` | Reduce unnecessary complexity |
| `/ship` | Prepare a verified launch |
| `/work` | Start, switch, or close isolated work items |

Use the command surface supported by your Host. Codex has no native Command
directory, so its adapter generates Skills with the same Command IDs and you
invoke them with `$`:

```text
$spec
$plan
$build auto
$test
$work start feature dingus --from main
```

After updating a canonical Command, refresh the generated adapters with:

```bash
node /path/to/agent-skills/scripts/install-agent-standard.js \
  refresh --host codex --global
```

`auto` is an argument interpreted by the generated `$build` Skill, not a native
Codex subcommand. The generated Skill contains the complete canonical prompt;
Agents and References remain typed dependencies rather than becoming `$`
invocations. Other Hosts continue using their native Command surfaces.

For a new project, run `sync --host <host> --profile decameron` after the global
Foundation exists. The Overlay also maintains the Host's project instruction
file so relevant project Skills are used with the base Skills required by
Commands.

## Work Lifecycle

Use `/work` only for local branch, Worktree, and documentation lifecycle work:

```text
/work start feature integracion-dingus --from develop
/work switch feature/integracion-dingus
/work close
```

To resume a local branch created earlier, opt in explicitly with `--existing`:

```text
/work start feature integracion-dingus --existing
/work switch integracion-dingus
/work start feature integracion-dingus --existing --worktree
```

`--existing` never selects a remote-only branch, changes commits, or recreates
an occupied Worktree. It switches to an unassociated local branch only when
the current directory is clean and has no active work; otherwise it associates
the branch with an isolated Worktree. The command reports paths but does not
change the terminal or IDE directory automatically.

If the current feature is dirty or already active, another `start` automatically
uses an isolated Worktree from the explicit `--from` reference. This keeps the
feature's uncommitted files and task history intact:

```text
/work start hotfix error-pagos --from main
/work switch feature/integracion-dingus
```

It never performs push, pull, merge, rebase, reset, stash, or branch/Worktree
deletion. Use `/spec` and `/plan` to create the documents that `/work close`
archives under `docs/work-items/<type>/<name>/`. Unchecked checklist items block
close by default; use `/work close --allow-incomplete` only after an explicit
decision to archive incomplete work.

Close captures a private temporary snapshot, uses an isolated Git index, and
verifies the exact approved blobs before updating `HEAD`. Its hooks run once in
Git order. If a hook or commit fails, moved files are restored only when safe;
recreated or modified files are kept alongside a durable recovery snapshot under
`.git/work-lifecycle/`. After a successful close, the developer index is
reconciled onto the new `HEAD` while unrelated staged entries are preserved. Retry
`/work close` after resolving the conflict; an already confirmed archive is
reported without creating an empty commit. The installed Command resolves the
script from the installed `work-lifecycle` Skill, so it does not depend on the
source repository layout.

See [Skills](skills.md) for choosing a direct Skill and [Troubleshooting](troubleshooting.md)
when a Command or installation is not available.
