---
name: fold
description: Work safely in encrypted Fold Markdown project rooms. Use when joining or resuming a Fold room from an agent handoff, handling fold:v1 tokens or room URLs, exporting project context, replying to Fold comments/requests, or submitting reviewable Markdown proposals through the Fold CLI.
---

# Fold

Fold is an encrypted Markdown project room for humans and coding agents. Use the
Fold CLI for room work. Treat this skill as reusable operating policy; live
project memory comes from encrypted room replay through `fold-agent bootstrap`,
`fold-agent resume`, or `fold-agent context`, not from the skill.

## Start Here

When a handoff contains a pinned `fold-agent bootstrap` command, run that first:

```bash
npx --yes fold-agent@0.1.0 bootstrap --room "fold:v1:..." --alias "launch" --output ./fold-project --json
```

If `fold` is not globally installed but you are inside the Fold repo, use the
repo-local wrapper from the handoff:

```bash
npm run --silent cli -- bootstrap --room "fold:v1:..." --alias "launch" --output ./fold-project --json
```

Do not use `/usr/bin/fold`. That is the Unix text-wrapping command, not Fold.
The Fold skill teaches agent behavior; `fold-agent` performs encrypted room
operations.

If `fold-agent resume` is unavailable, use the fallback sequence in
`references/workflow.md`.

## Rules

- Keep room URLs, `fold:v1:` tokens, `#key` fragments, and `.fold/rooms.json`
  secret.
- Never paste room keys, tokens, or decrypted access files into logs, issues,
  pull requests, or third-party services.
- Use `fold-agent post` for fresh Markdown files. Use proposals for changes to
  existing accepted files unless the room policy explicitly asks for direct
  edits.
- Do not self-assign a visible persona. Fold assigns agent personas from
  room/system logic.
- Use saved aliases after the first join. Repeat agents should not reinstall
  this skill every time.

## Normal Workflow

1. Resume the room.
2. Read open requests, comments, and pending proposals from the resume output.
3. Edit exported files locally.
4. Post fresh Markdown files directly:

```bash
fold-agent post ./fold-project/NEW_FILE.md --room "launch" --path "NEW_FILE.md" --json
```

5. Submit existing-file changes as one reviewable proposal:

```bash
fold-agent propose ./fold-project \
  --room "launch" \
  --title "Describe the change" \
  --comment "Summarize what changed." \
  --json
```

6. Reply instead of proposing when a human request needs clarification:

```bash
fold-agent reply "<thread-id>" --room "launch" --text "Short reply." --json
```

## References

- Read `references/security.md` before handling secret-bearing room access.
- Read `references/workflow.md` when `fold-agent resume` is unavailable or a handoff
  gives only older commands.
- Read `references/cli.md` for command examples and repeat-agent behavior.
