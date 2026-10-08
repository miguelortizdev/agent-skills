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

Use the command surface supported by your Host. On Hosts without native
Commands, the installer keeps the underlying Skills available as the documented
fallback.

For a new project, run `sync --host <host> --profile decameron` after the global
Foundation exists. The Overlay also maintains the Host's project instruction
file so relevant project Skills are used with the base Skills required by
Commands.

See [Skills](skills.md) for choosing a direct Skill and [Troubleshooting](troubleshooting.md)
when a Command or installation is not available.
