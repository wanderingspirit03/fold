# 015 Agent Handoff Bootstrap

## Status

DONE

## Goal

Make it practical for a fresh coding agent to join a Fold project room from one
copied handoff, while letting repeat agents keep durable Fold operating policy
installed as a standards-compatible skill.

## Scope

- Add `fold resume` as the fresh-agent CLI entry point.
- Keep `fold resume` as composition over existing encrypted-room primitives:
  `room add`, `status`, `context`, `export`, `requests`, `comments`, and
  `proposals`.
- Update agent invite copy in CLI and web to lead with `fold resume`.
- Update the public well-known agent skill to teach `fold resume`.
- Add a standards-compatible `skills/fold/SKILL.md` package for repeat agents.
- Add a publishable skill-only package at `packages/fold-skills` that contains
  `skills/fold` without bundling the Fold web app or CLI runtime.
- Document package-runner and skill-install strategy without pretending an npm
  package exists before publication.

## Non-Goals

- Do not publish an npm package in this implementation pass.
- Do not use the unscoped npm name `fold` for package-runner examples.
- Do not make skill installation required for one-off agent handoffs.
- Do not add a new server-readable state model. Encrypted room replay remains
  the source of project memory.

## Resume Command Contract

Suggested usage:

```bash
fold resume --room "fold:v1:..." --alias "launch" --output ./fold-project --json
fold resume --room launch --output ./fold-project --json
```

The command should:

- save the room alias when `--room` is a token or room URL and `--alias` is
  provided;
- confirm access with status;
- export accepted Markdown files when `--output` is provided;
- return a redacted context summary with files, unresolved requests, unresolved
  comments, proposal summaries, latest sequence, and next commands;
- avoid echoing `fold:v1:` tokens, `#key` fragments, room secrets, or `.fold`
  contents in routine JSON output.

## Repeat-Agent Skill Contract

Add a repo-local skill package at:

```text
skills/fold/SKILL.md
packages/fold-skills/skills/fold/SKILL.md
```

The skill should stay compact and teach stable behavior:

- run `fold resume` first;
- keep secret-bearing room access material out of logs and PRs;
- use proposals and replies instead of direct accepted-state mutation;
- use `fold context --json` only as the lower-level machine packet;
- treat installed skills as reusable policy, not live project memory.

## Verification

- Unit tests cover `resume` redaction, alias saving, export output, and invite
  copy.
- `npm run check` passes.
- A black-box subagent receives only a copied handoff plus the skill/handoff
  artifacts needed for the test and reports whether it can infer the correct
  next actions without source-code context.
