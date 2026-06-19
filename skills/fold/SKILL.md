---
name: fold
description: Work safely in encrypted Fold Markdown project rooms. Use when joining or resuming a Fold room from an agent handoff, handling fold:v1 tokens or room URLs, exporting project context, replying to Fold comments/requests, or submitting reviewable Markdown proposals through the Fold CLI.
---

# Fold

Fold is an encrypted Markdown project room for humans and coding agents. Use the
Fold CLI for room work. Treat this skill as reusable operating policy; live
project memory comes from encrypted room replay through `fold resume` or
`fold context`, not from the skill.

## Start Here

When a handoff contains a `fold resume` command, run that first:

```bash
fold resume --room "fold:v1:..." --alias "launch" --output ./fold-project --json
```

If `fold` is not globally installed but you are inside the Fold repo, use the
repo-local wrapper from the handoff:

```bash
npm run --silent cli -- resume --room "fold:v1:..." --alias "launch" --output ./fold-project --json
```

If `fold resume` is unavailable, use the fallback sequence in
`references/workflow.md`.

## Rules

- Keep room URLs, `fold:v1:` tokens, `#key` fragments, and `.fold/rooms.json`
  secret.
- Never paste room keys, tokens, or decrypted access files into logs, issues,
  pull requests, or third-party services.
- Prefer proposals. Do not mutate accepted project state directly unless the
  room policy explicitly asks for it.
- Do not self-assign a visible persona. Fold assigns agent personas from
  room/system logic.
- Use saved aliases after the first join. Repeat agents should not reinstall
  this skill every time.

## Normal Workflow

1. Resume the room.
2. Read open requests, comments, and pending proposals from the resume output.
3. Edit exported files locally.
4. Submit one reviewable proposal:

```bash
fold propose ./fold-project \
  --room "launch" \
  --title "Describe the change" \
  --comment "Summarize what changed." \
  --json
```

5. Reply instead of proposing when a human request needs clarification:

```bash
fold reply "<thread-id>" --room "launch" --text "Short reply." --json
```

## References

- Read `references/security.md` before handling secret-bearing room access.
- Read `references/workflow.md` when `fold resume` is unavailable or a handoff
  gives only older commands.
- Read `references/cli.md` for command examples and repeat-agent behavior.
