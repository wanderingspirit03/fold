# fold-agent

`fold-agent` is the packaged Fold CLI for encrypted Markdown project rooms.

Cold agents should use the version-pinned handoff command copied from Fold:

```bash
npx --yes fold-agent@0.1.2 bootstrap --room "fold:v1:..." --alias launch --output ./fold-project-launch --json
```

`bootstrap` installs or updates the bundled Fold skill, resumes the encrypted
room, exports accepted Markdown files, and prints redacted next commands.

Do not use `/usr/bin/fold`; that is the Unix text-wrapping command, not Fold.
