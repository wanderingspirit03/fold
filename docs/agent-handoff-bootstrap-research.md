# Agent Handoff Bootstrap Research

This note captures the current direction for making Fold handoffs easy for a
fresh coding agent that may not have Fold, an agent skill manager, or prior
project context installed.

## Goal

A human should be able to copy one agent handoff block from Fold into a fresh
agent session. That handoff should get the agent into a native Fold workflow
with minimal assumptions.

The handoff should:

- work when the agent has no Fold CLI installed;
- work when the agent has no skills manager installed;
- prefer portable Agent Skills when available;
- keep room URLs, `fold:v1:` tokens, keys, and `.fold/rooms.json` secret;
- use encrypted room state as the source of project memory;
- make `fold resume` the long-term fresh-session entry point.

## Current Fold Setup

Fold already has most of the primitives needed for this.

- CLI agent invite text is generated in `src/cli/operations.ts` by
  `createRoomInvite`.
- Web agent invite text is generated in
  `apps/web/app/room/[roomId]/page.tsx` by `createAgentInvite`.
- The public web skill is served from
  `apps/web/public/.well-known/fold/agent-skill.md`.
- The skill now teaches security rules, safe CLI availability checks, `resume`,
  `propose`, proposal review, room creation, invites, and self-hosting notes.
- There is an empty directory at
  `apps/web/app/.well-known/fold/agent-skill.md`; the real served file is the
  one under `public`.
- Existing CLI primitives already support a future resume command:
  - `resume` imports a secret room token or URL when `--alias` is provided,
    confirms access, exports files, lists requests/comments/proposals, and
    returns redacted next commands;
  - `room add` imports a secret room token or URL and saves an alias;
  - `status` confirms the append-log sequence;
  - `context` returns a redacted agent handoff packet;
  - `export` writes accepted Markdown files locally;
  - `requests`, `comments`, `proposals`, and `show-proposal` expose review
    state;
  - `propose` submits encrypted reviewable changes without mutating accepted
    state.

`docs/agent-continuity.md` records `fold resume` as a thin orchestration layer
over these commands.

## External Skill Distribution Notes

Agent Skills are an open folder format centered on `SKILL.md`, with optional
`scripts`, `references`, and assets. They are a good fit for Fold's stable
operating policy: security rules, proposal-first behavior, and how to resume a
room safely.

GitHub CLI has preview documentation for `gh skill install`, `gh skill list`,
`gh skill preview`, `gh skill publish`, `gh skill search`, and
`gh skill update`. GitHub's changelog says `gh skill` requires GitHub CLI
v2.90.0 or later. The local machine used for this research has `gh` v2.83.1,
and `gh skill` is not available there, which is a useful real-world warning:
`gh skill install` should not be the only handoff path.

The skills.sh ecosystem commonly uses an `npx skills add <owner/repo>` style
flow. That is useful for repeat users, but it still assumes the receiving agent
can install skills and knows how its host loads them.

Sources reviewed:

- https://agentskills.io/home
- https://cli.github.com/manual/gh_skill
- https://cli.github.com/manual/gh_skill_install
- https://github.blog/changelog/2026-04-16-manage-agent-skills-with-github-cli/
- https://code.visualstudio.com/docs/agent-customization/agent-skills

## Options

### Option 1: Skill-First Handoff

The handoff starts by asking the agent to install the Fold skill:

```bash
gh skill install wanderingspirit03/fold packages/fold-skills/skills/fold@<tag-or-sha>
# or
npx skills add wanderingspirit03/fold --skill fold
```

Then it asks the agent to run Fold commands.

This is elegant for repeat users, teams, and agents with native skills support.
It is not minimal for first contact. A fresh agent may not have `gh skill`, may
not have a skills manager, may not have network access to skill registries, or
may not load newly installed skills during the current session.

### Option 2: Web Skill URL First

The handoff says:

```text
Read https://your-fold-app/.well-known/fold/agent-skill.md
```

Then it gives room commands.

This is transparent, hosted, and already available in Fold. It is also fragile:
some agents cannot browse, some will skim or summarize the skill instead of
loading it as a real capability, and it still does not solve CLI availability.

### Option 3: CLI Bootstrap Through A Package Runner

After the CLI is published under a scoped package name, the handoff can start
with a package-runner command:

```bash
npx @fold/<cli-package> resume --room "fold:v1:..." --alias "launch" --output ./fold-project --json
```

This makes the smallest assumption: the agent can run a command in a shell with
Node/npm available. The command can import the room, replay encrypted state
client-side, export files, print a redacted context packet, and provide next
commands.

This has its own risks: `npx` package execution needs Node/npm, network access,
registry trust, a published package, and a versioning policy. Some environments
disable network installs. Still, once Fold has a package, this is the most
practical default because it does not require the user or agent to understand
skills before joining a room.

Important current constraint: this repo's root package is currently private and
named `fold`, while the public npm name `fold` is unrelated. Do not recommend
`npx fold` or `npx @fold/<cli-package>` until Fold publishes a scoped package
and decides the real package name.

## Recommended Direction

Make `fold resume` the product contract. Treat skills, web URLs, `gh skill`,
skills.sh, and a package runner such as `npx` as delivery paths.

The target handoff should be layered:

```text
You are joining a Fold encrypted Markdown project room.

Preferred after the Fold CLI package is published:

  npx @fold/<cli-package>@<version> resume --room "fold:v1:..." --alias "launch" --output ./fold-project --json

If Fold is already installed:

  fold resume --room "fold:v1:..." --alias "launch" --output ./fold-project --json

Then follow the commands printed by Fold. Keep room URLs, fold:v1 tokens, keys,
and .fold/rooms.json secret. Work through proposals unless the room policy says
otherwise.

Reference skill:

  https://your-fold-app/.well-known/fold/agent-skill.md
```

Until the public CLI package exists, handoffs from the repo-local CLI can use
the development wrapper:

```bash
npm run --silent cli -- resume --room "fold:v1:..." --alias "launch" --output ./fold-project --json
```

Fold now includes a standards-compatible skill package at
`packages/fold-skills/skills/fold`. Include an optional power-user line after
the primary bootstrap:

```bash
gh skill install wanderingspirit03/fold packages/fold-skills/skills/fold@<tag-or-sha>
# or, where available:
npx skills add wanderingspirit03/fold --skill fold
```

Do not require that line for a one-off handoff.

## `fold resume` Shape

`fold resume` should compose existing commands instead of creating a second
state model.

Suggested usage:

```bash
fold resume --room "fold:v1:..." --alias "launch" --output ./fold-project --json
fold resume --room launch --output ./fold-project --json
```

Responsibilities:

- import the token with `room add` when `--room` is a token and `--alias` is
  provided;
- confirm access with `status`;
- export accepted Markdown files to `--output`;
- emit or save a redacted `context` packet;
- include unresolved human requests;
- include unresolved comments;
- include pending proposals and recent proposal decisions;
- include latest server sequence and accepted file hashes;
- include exact next commands for `propose`, `reply`, `comments`, `requests`,
  `proposals`, and `show-proposal`;
- optionally fetch and cache `/.well-known/fold/agent-skill.md` with its
  version metadata;
- never echo the room token, room URL with `#key`, room secret, or `.fold`
  contents in routine JSON output.

Suggested schema:

```text
fold.resume.result.v1
```

## Standards-Compatible Skill Package

Fold should still add a real Agent Skills package to the repo:

```text
skills/fold/
  SKILL.md
  references/
    cli.md
    security.md
    workflow.md
```

Keep the skill small. It should teach durable behavior, not duplicate the whole
CLI manual.

The skill should say:

- use `fold resume` first when joining a room;
- treat tokens, room URLs, keys, and `.fold/rooms.json` as secrets;
- prefer `propose`, `requests`, `comments`, and `reply`;
- never paste room secrets into logs or pull requests;
- use the exact alias and output path printed in the handoff;
- use `fold context --json` only when a lower-level machine packet is needed.

Avoid bundling a large CLI binary inside the skill. Use the skill to point to
the CLI installation or `npx` path.

## Minimal Implementation Plan

1. Keep hardening `fold resume` as a thin CLI orchestration command.
2. Decide and publish a scoped CLI package name; do not use the unscoped npm
   package name `fold`.
3. Keep CLI and web agent invite text leading with `fold resume`.
4. Keep `apps/web/public/.well-known/fold/agent-skill.md` aligned with
   `fold resume`.
5. Maintain `skills/fold/SKILL.md` and `packages/fold-skills/skills/fold` as
   identical standards-compatible skill copies until the package layout becomes
   the only install path.
6. Document optional install paths:
   - `gh skill install wanderingspirit03/fold packages/fold-skills/skills/fold@<tag-or-sha>` once supported
     by the user's GitHub CLI;
   - `npx skills add wanderingspirit03/fold --skill fold` where skills.sh
     tooling is
     available;
   - direct web skill URL as fallback.
7. Clean up the empty `apps/web/app/.well-known/fold/agent-skill.md`
   directory.

## Decision

The most practical and minimal approach is:

1. current handoff from this repo: `npm run --silent cli -- resume ...`;
2. target primary handoff after package publication:
   version-pinned `npx @fold/<cli-package> resume ...`;
3. installed CLI path: `fold resume ...`;
4. optional persistent capability: Agent Skills via `gh skill` or skills.sh;
5. fallback reference: `/.well-known/fold/agent-skill.md`.

This keeps the user-facing handoff tiny while preserving portability. The
actual project memory remains in encrypted Fold room state, not in a copied
prompt or a static skill.
