---
name: fold
version: 0.1.0
description: Work in encrypted Fold Markdown project rooms through the CLI.
homepage: /
---

# Fold Agent Skill

Fold is an encrypted Markdown project room for humans and coding agents. Use the CLI for all room mutations. Browser access is optional for inspection only.

## Security Rules

- Treat room URLs, `fold:v1:` tokens, and `.fold/rooms.json` as secrets.
- Never send a room URL fragment (`#key=...`) to a server API.
- Never paste a room key into logs, issue trackers, pull requests, or third-party services.
- Prefer proposals. Do not directly mutate accepted project state unless the room policy explicitly allows it.
- Do not self-assign a visible persona. Fold assigns agent personas from room/system logic.

## Install

First, check whether the CLI is already available:

```bash
fold --help
```

From the Fold repository during development, install dependencies and run the local CLI through `npm run`:

```bash
npm install
npm run --silent cli -- --help
```

If `fold` is not available, use the repository-local form shown in the invite:

```bash
npm run --silent cli -- <command>
```

Do not use `npm install -g fold` or `npx fold`. The public unscoped npm package name is unrelated to Fold's CLI. After Fold publishes a scoped CLI package, use the version-pinned package-runner command shown in the handoff.

Repeat agents with a standards-compatible Fold skill already installed do not need to install the skill again. Skill installation is optional operating policy; encrypted project state still comes from `fold resume` or `fold context`.

The copied agent handoff is authoritative for the room. Prefer its exact alias, token, app URL, and sync URL.

## Resume A Room

Use the copied handoff's `fold resume` command first. Agent invites normally use a token because it preserves both the web app URL and sync server URL:

```bash
fold resume --room "fold:v1:..." --alias launch --output ./fold-project --json
```

If `fold` is not installed yet in development, run the same command through:

```bash
npm run --silent cli -- resume --room "fold:v1:..." --alias launch --output ./fold-project --json
```

For repeat work in the same project, use the saved alias:

```bash
fold resume --room launch --output ./fold-project --json
```

If `fold resume` is unavailable, fall back to `fold room add`, `fold status`, `fold export`, `fold context`, `fold requests`, `fold comments`, and `fold proposals`.

## Work On A Project

Edit files locally, then submit one reviewable proposal:

```bash
fold propose ./fold-project \
  --room launch \
  --title "Update project docs" \
  --comment "Summarizes the changes and any decisions needed." \
  --json
```

For one file:

```bash
fold export --room launch --path docs/PLAN.md --output ./PLAN.md --json
fold propose ./PLAN.md --room launch --path docs/PLAN.md --title "Tighten plan" --json
```

## Review Proposals

```bash
fold proposals --room launch --json
fold show-proposal PROPOSAL_ID --room launch --json
fold accept PROPOSAL_ID --room launch --json
fold reject PROPOSAL_ID --room launch --json
```

Accept/reject only when a human or higher-level workflow explicitly asks you to make the review decision.

## Create A Room For A Human

When you create the room first on a hosted Fold deployment, use the hosted public URL once and send the human invite back to the user:

```bash
FOLD_PUBLIC_URL=https://your-fold.example \
fold publish ./project --alias launch
fold room invite launch --for human
fold room invite launch --for agent
```

When working from this repository, use the local CLI wrapper:

```bash
FOLD_PUBLIC_URL=https://your-fold.example \
npm run --silent cli -- publish ./project --alias launch
npm run --silent cli -- room invite launch --for human
```

For local development, publish with explicit local URLs:

```bash
fold publish ./project --server http://127.0.0.1:8787 --alias launch
fold room invite launch --for human
```

If there is no Markdown file or project directory yet, create an empty room first:

```bash
fold room create --alias launch --app-url http://127.0.0.1:3000 --sync-url http://127.0.0.1:8787
fold room invite launch --for human
```

The human invite contains the browser room link and client-side key. Treat it as a secret. If the web app and sync server are on different origins, use both `--app-url` and `--sync-url` when creating or publishing the room. If the output warns about local-only URLs, tell the user the room is only reachable from the same machine or network until they provide public `appUrl` and `syncUrl` values.

## Invite Others

Generate a human invite:

```bash
fold room invite launch --for human
```

Generate an agent invite:

```bash
fold room invite launch --for agent
```

Optional repeat-agent skill install paths, when the agent host supports them:

```bash
gh skill install wanderingspirit03/fold packages/fold-skills/skills/fold@<tag-or-sha>
npx skills add wanderingspirit03/fold --skill fold
```

If the invite warns about `localhost`, `127.0.0.1`, or a private LAN address, the room may not be reachable by collaborators outside that machine or network. Ask the human to provide a reachable `appUrl` and `syncUrl`, then update:

```bash
fold room set-url launch \
  --app-url https://fold.example \
  --sync-url https://fold.example
```

## Self-Hosting Notes

- Mac-local single-machine: `localhost` is fine.
- Mac-local collaborators: the server must bind to a reachable host, the firewall must allow the port, and collaborators need a URL that points to the host Mac.
- Hosted platforms should use public HTTPS URLs, WebSocket support, and persistent append-log storage.
- Same-origin hosted Fold uses one URL for both the browser app and sync server. Set `FOLD_PUBLIC_URL` or pass explicit `--app-url` and `--sync-url`.
- Losing the room key means losing access unless someone still has a saved alias, token, room URL, or export.
