# Fold Workflow

Use this fallback when `fold resume` is not available.

First join:

```bash
fold room add "fold:v1:..." --alias "launch"
fold status --room "launch" --json
fold export --room "launch" --output ./fold-project --json
fold context --room "launch" --json
fold requests --room "launch" --json
fold comments --room "launch" --type comment --open --json
fold proposals --room "launch" --json
```

Repeat work in the same project:

```bash
fold resume --room "launch" --output ./fold-project --json
```

Submit work:

```bash
fold propose ./fold-project --room "launch" --title "Describe the change" --comment "Summarize what changed." --json
```

Reply to a human request:

```bash
fold reply "<thread-id>" --room "launch" --text "Short reply." --json
```

Review only when explicitly asked:

```bash
fold proposals --room "launch" --json
fold show-proposal "<proposal-id>" --room "launch" --json
fold accept "<proposal-id>" --room "launch" --json
fold reject "<proposal-id>" --room "launch" --json
```
