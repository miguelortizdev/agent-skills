# Architecture

🇺🇸 English | 🇪🇸 [Español](../es/architecture.md)

## Source Of Truth

```text
Registry + Profiles
        ↓
Canonical assets
        ↓
Installer + Ownership
        ↓
Host Adapters
        ↓
Claude | Codex | Cursor | Gemini | OpenCode | OpenChamber
```

The Registry describes asset IDs, paths, dependencies, Hosts, and MCP. Profiles
select a stable Foundation; Adapters translate it to native Host paths without
duplicating Skill content.

## Installation Modes

```text
Global Foundation  → reusable user-level Base assets + MCP
Project Full       → Foundation in the project + future resolved context
Project Overlay    → contextual project assets over a matching Foundation
```

Ownership manifests record created files and hashes. Uninstall and reconciliation
remove only unchanged files owned by the relevant installation. User-managed
files and shared files owned by another installation are preserved.

## Generic Context Engine

The Context Scanner produces bounded generic facts. The Rule Evaluator supports
`file`, `path`, `dependency`, `text`, `anyOf`, `allOf`, and `noneOf`. Contextual
knowledge is declared by a Registry asset's `appliesWhen`; the scanner,
resolver, installer, and adapters contain no technology-specific matching.

The production catalog currently enables zero Contextual Skills. Synthetic tests
prove future Skills can be added through Registry rules without core changes.

See [Installation](installation.md), [Skills](skills.md), and [Hosts](hosts.md)
for operational details.
