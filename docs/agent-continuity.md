# Agent Continuity

This note captures the current product direction for helping a fresh coding
agent session resume long-running Fold project work.

## Problem

Agents lose chat/session memory. Fold should make project memory durable in the
room, not depend on a specific agent session remembering what happened before.

A fresh agent should be able to continue from a saved room alias or invite token
without manually assembling five commands.

## Best Next Design

Use `fold resume` as the fresh-agent entry point:

```bash
fold resume --room launch --output ./fold-project --json
fold resume --room "fold:v1:..." --alias launch --output ./fold-project --json
```

`resume` is a thin orchestration layer over existing primitives, not a
second state model. It should internally compose:

- `room add` when a token plus `--alias` is provided;
- `status`;
- `context`;
- `export`;
- `requests`;
- `comments`;
- `proposals`.

The output must stay redacted like `fold context`: no `room.url`, no token echo,
no `#key`, and no room secret material.

## Why This Is Best

A fresh agent needs one command that means: catch me up and put files on disk.

Fold already has the ingredients:

- `fold context` decrypts accepted files, unresolved comments, proposal
  summaries, and server sequence locally.
- Routine JSON outputs are redacted by default.
- Agent invites already teach `room add`, `status`, `export`, `propose`,
  `requests`, `comments`, and `reply`.

`fold resume` packages those concepts into the friendly front door.

## Priority Order

### 1. Use `fold resume`

Keep it as the product-facing command for "new agent session, continue this room."

It should return:

- accepted project files;
- open human requests;
- unresolved comments;
- pending proposals;
- recent accepted/rejected proposal summaries;
- latest server sequence;
- file hashes;
- exact next commands.

Example next commands:

```bash
fold propose ./fold-project --room "launch" --title "..." --comment "..."
fold reply "<thread-id>" --room "launch" --text "..."
fold show-proposal "<proposal-id>" --room "launch" --json
```

Tradeoff: it overlaps with `context` and `export`. Keep it as composition over
those commands.

### 2. Improve `fold context` As The Substrate

Keep `fold context --room launch --json` as the raw machine packet.

Useful additions:

- separate `requests` from ordinary unresolved comments;
- `nextCommands`;
- `recommendedWorkspacePath`;
- `latestSeq`;
- later, `staleSinceLastResume`.

Tradeoff: `context` can get large because it includes full Markdown files.
Filtering can come later; fresh agents should not have to reconstruct room state
from separate commands by default.

### 3. Update Agent Invites

Today agent invites teach several commands. Replace most of that with:

```bash
fold resume --room "fold:v1:..." --alias "launch" --output ./fold-project --json
```

Keep proposal and reply examples after the resume command.

### 4. Cache The Web Skill Opportunistically

During `room add` or `resume`, fetch and cache:

```text
/.well-known/fold/agent-skill.md
```

This helps offline or long-running sessions and records the skill version. It is
not enough by itself because the skill is generic operating policy, while live
project state comes from encrypted room context.

### 5. Defer Dedicated Skill Commands

Do not add these first:

```bash
fold skill show --room launch
fold skill cache --room launch
```

They may be useful later for packaging and debugging, but they add a new noun
before the main resume loop is solved.

### 6. Demote `patch`

Keep `patch` as compatibility, but docs and invites should teach `propose`.
Fold's product language is proposal-first.

## Net Direction

`fold resume` is the friendly front door.

`fold context` should remain the stable encrypted replay packet underneath.

The long-term principle is:

> Agents can come and go; Fold is the durable project memory.
