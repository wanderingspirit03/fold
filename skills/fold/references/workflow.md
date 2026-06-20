# Fold Workflow

Use this fallback when `fold-agent bootstrap` is not available.

First join:

```bash
fold-agent room add "fold:v1:..." --alias "launch"
fold-agent status --room "launch" --json
fold-agent export --room "launch" --output ./fold-project-launch --json
fold-agent context --room "launch" --json
fold-agent requests --room "launch" --json
fold-agent comments --room "launch" --type comment --open --json
fold-agent proposals --room "launch" --json
```

Repeat work in the same project:

```bash
fold-agent resume --room "launch" --output ./fold-project-launch --json
```

Post a fresh Markdown file directly:

```bash
fold-agent post ./fold-project-launch/NEW_FILE.md --room "launch" --path "NEW_FILE.md" --json
```

Submit changes to existing files as a proposal:

```bash
fold-agent propose ./fold-project-launch --room "launch" --title "Describe the change" --comment "Summarize what changed." --json
```

Reply to a human request:

```bash
fold-agent reply "<thread-id>" --room "launch" --text "Short reply." --json
```

Review only when explicitly asked:

```bash
fold-agent proposals --room "launch" --json
fold-agent show-proposal "<proposal-id>" --room "launch" --json
fold-agent accept "<proposal-id>" --room "launch" --json
fold-agent reject "<proposal-id>" --room "launch" --json
```
