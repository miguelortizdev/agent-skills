# Contributing

🇺🇸 English | 🇪🇸 [Español](../es/contributing.md)

Keep canonical content in the repository root and describe it in the Registry.
Use a focused branch, tests first for behavior changes, and a PR with the full
validation report.

## Add A Base Skill

1. Create `skills/<name>/SKILL.md`.
2. Register the asset when the installation Registry requires it.
3. Add tests and routing evals.
4. Run `node scripts/validate-skills.js`, `node scripts/test-all.js`, and relevant validators.
5. Update the bilingual product documentation.
6. Open a PR.

## Add A Contextual Skill

1. Create `SKILL.md`.
2. Register the asset in `registry/catalog.json`.
3. Configure `appliesWhen` with the generic DSL.
4. Add contextual tests and evals.
5. Validate Registry, Profiles, installation, and routing.
6. Open a PR.

No Context Detector, Resolver, Installer, or Adapter change is required.

## Add MCP

1. Register the server.
2. Add it to the intended Profile.
3. Use environment-backed references.
4. Map Host representations.
5. Add tests and run MCP validation.
6. Open a PR.

## Add A Host

Update the Registry host entry, adapter, native destinations, capability matrix,
ownership/uninstall behavior, tests, and adapter-drift validation. Do not copy
canonical asset content into an adapter.

## Required Checks

Run the official suite, routing evals, Skill/Registry/Profile/MCP validation,
adapter drift, upstream parity, documentation link checks, and `git diff --check`.
