# Troubleshooting

🇺🇸 English | 🇪🇸 [Español](../es/troubleshooting.md)

## Common Problems

| Symptom | Check |
| --- | --- |
| Global Foundation not found | Install the same Host/Profile globally before `sync`. |
| Profile mismatch | Uninstall the existing profile for that Host and scope first. |
| Host mismatch | Use the Host that owns the global Foundation. |
| MCP environment missing | Check required environment references such as `KUBECONFIG`. |
| No Contextual Skills matched | This is expected today: production contextual catalog is empty. |
| Ownership conflict | Inspect the installation manifest and do not overwrite changed files. |
| Existing unmanaged file | Move or review the file; the installer refuses unsafe overwrite. |
| Registry validation error | Run `node scripts/validate-registry.js` and fix the reported asset/rule. |
| Skill validation error | Run `node scripts/validate-skills.js` and inspect anatomy/frontmatter. |
| Adapter limitation | Check the Host matrix and the shared adapter guide. |

## Safe Diagnosis

Start with a dry-run:

```bash
node scripts/install-agent-standard.js \
  --host codex --profile decameron --project --dry-run
```

Then run the relevant validators:

```bash
node scripts/validate-registry.js
node scripts/validate-profiles.js
node scripts/validate-mcp.js
node scripts/validate-adapter-drift.js
```

Do not delete `.agent-standard` or Host files manually when ownership is unclear.
Use the matching `--uninstall --dry-run` first.
