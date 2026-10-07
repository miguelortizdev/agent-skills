# Context-Aware Skills

🇺🇸 English | 🇪🇸 [Español](../es/context-aware-skills.md)

The Generic Context Rules Engine is available for future software-specific
Skills. Production Contextual Skills: **none**.

## Generic Rules

Registry `appliesWhen` rules support these leaf types:

| Rule | Meaning |
| --- | --- |
| `file` | Match bounded file paths |
| `path` | Match file or directory paths |
| `dependency` | Match dependency names in JSON manifests |
| `text` | Match text in bounded files |

Compose rules with `anyOf`, `allOf`, and `noneOf`.

```json
{
  "allOf": [
    { "type": "file", "paths": ["platform.yaml"] },
    { "anyOf": [
      { "type": "text", "files": ["platform.yaml"], "patterns": ["kind: FuturePlatform"] },
      { "type": "dependency", "names": ["future-platform-sdk"] }
    ] }
  ],
  "noneOf": [{ "type": "text", "files": ["platform.yaml"], "patterns": ["legacy: true"] }]
}
```

## Extension Flow

1. Create `skills/<name>/SKILL.md`.
2. Register the asset in `registry/catalog.json`.
3. Configure `appliesWhen`.
4. Add contextual tests and routing evals.
5. Validate and open a PR.

No Context Detector, Resolver, Installer, or Adapter change is required.

**EXAMPLE ONLY — NOT PART OF THE PRODUCTION CATALOG:** a test-only
`redis-engineering` asset can use a `text` rule for `docker-compose.yml`. The
same generic engine resolves it without production registration.

See [Architecture](architecture.md) for boundaries and
[Troubleshooting](troubleshooting.md) for no-match behavior.
