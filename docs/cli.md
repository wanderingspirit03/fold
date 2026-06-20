# Fold CLI

The packaged agent CLI is `fold-agent`. Inside this repository, the development
wrapper still runs the same command surface through `npm run --silent cli --`
and examples may show the repo-local binary name `fold`.

The CLI is the agent-facing entry point for publishing Markdown project rooms, saving room aliases, generating invites, submitting reviewable proposals, accepting/rejecting proposals, checking room status, and exporting canonical Markdown. Commands talk to the encrypted append-log HTTP API; document bodies, proposal bodies, comments, project files, and timeline payloads are encrypted client-side before they leave the CLI.

## Commands

```bash
fold publish <file-or-directory> [--server <url>] [--app-url <url>] [--sync-url <url>] [--alias <name>] [--path <room-path>] [--json] [--no-save]
fold room create --alias <name> [--server <url>] [--app-url <url>] [--sync-url <url>] [--json]
fold room add <url-or-token> --alias <name> [--json]
fold room list [--json]
fold room show <alias> [--json]
fold room set-url <alias> [--app-url <url>] [--sync-url <url>] [--json]
fold room forget <alias> [--json]
fold room invite <alias> [--for human|agent] [--json]
fold-agent bootstrap --room <alias-or-url-or-token> --alias <name> --output <project-directory> [--json]
fold resume --room <alias-or-url-or-token> [--alias <name>] [--output <file-or-directory>] [--json]
fold export --room <alias-or-url-or-token> [--path <room-path>] [--output <file-or-directory>] [--json]
fold status --room <alias-or-url-or-token> [--json]
fold post <file.md> --room <alias-or-url-or-token> [--path <room-path>] [--json]
fold propose <file-or-directory> --room <alias-or-url-or-token> [--path <room-path>] [--title <text>] [--comment <text>] [--json]
fold proposals --room <alias-or-url-or-token> [--json]
fold comments --room <alias-or-url-or-token> [--path <room-path>] [--type all|comment|request] [--open] [--json]
fold requests --room <alias-or-url-or-token> [--path <room-path>] [--no-open] [--json]
fold comment --room <alias-or-url-or-token> --text <text> [--path <room-path>] [--quote <text>] [--type comment|request] [--json]
fold reply <comment-id> --room <alias-or-url-or-token> --text <text> [--json]
fold context --room <alias-or-url-or-token> [--json]
fold show-proposal <proposal-id> --room <alias-or-url-or-token> [--json]
fold accept <proposal-id> --room <alias-or-url-or-token> [--json]
fold reject <proposal-id> --room <alias-or-url-or-token> [--json]
fold patch <file.md> --room <alias-or-url-or-token> [--path <room-path>] [--summary <text>] [--json]
```

During development, run the CLI through:

```bash
npm run --silent cli -- publish README.md --json
```

For a local fresh setup:

```bash
npm run server -- --port 8787 --data ./data
npm run --silent cli -- publish ./notes.md \
  --app-url http://127.0.0.1:3000 \
  --sync-url http://127.0.0.1:8787 \
  --alias notes \
  --json
```

Use `--silent` with `npm run` when parsing JSON. Without it, npm can print its run banner before the CLI output.

For a hosted same-origin setup, set `FOLD_PUBLIC_URL` once and omit repeated URL flags:

```bash
FOLD_PUBLIC_URL=https://your-fold.example \
npm run --silent cli -- room create --alias launch --json
npm run --silent cli -- room invite launch --for human
npm run --silent cli -- room invite launch --for agent
```

For split deployments, set `FOLD_PUBLIC_APP_URL` and `FOLD_PUBLIC_SYNC_URL`, or pass `--app-url` and `--sync-url` explicitly.

When an agent creates a room first, the non-JSON `publish` output prints the next human and agent invite commands:

```bash
fold publish ./project \
  --app-url http://127.0.0.1:3000 \
  --sync-url http://127.0.0.1:8787 \
  --alias launch
fold room invite launch --for human
fold room invite launch --for agent
```

If there is no Markdown file yet, create the room first and add files later through proposals:

```bash
fold room create --alias launch --app-url http://127.0.0.1:3000 --sync-url http://127.0.0.1:8787
fold room invite launch --for human
```

## Current Behavior

- Markdown is canonical as raw text in `Y.Text` named `markdown`.
- Rooms can also carry an encrypted Markdown project snapshot: multiple `.md` files keyed by room path.
- `publish` creates a local room id and client-side room secret.
- The initial primary Markdown state is encoded as a Yjs update, encrypted locally, and posted to `POST /rooms/:roomId/updates`; project snapshots are encrypted JSON room payloads.
- Unless `--no-save` is passed, room profiles are written to `.fold/rooms.json` with restrictive local permissions on POSIX systems.
- `export` fetches encrypted records from `GET /rooms/:roomId/updates`, decrypts and replays accepted project records locally, and writes one Markdown file or a project directory.
- `fold-agent bootstrap` is the cold-agent entry point. It installs or updates the bundled skill, imports the room token or URL with `--alias`, exports accepted files, prints a redacted context packet, lists open requests/comments and proposals, and returns next commands that use the saved alias instead of secret room access material.
- `resume` is the warm repeat-agent entry point after an alias already exists.
- `status` calls `GET /rooms/:roomId/status`, which returns metadata only: `roomId`, `recordCount`, and `latestSeq`.
- `propose` submits an encrypted whole-file or whole-project replacement proposal. It does not mutate accepted Markdown. Its JSON response is compact and returns proposal ids, status, persona, hashes, and project summaries, not full proposed Markdown.
- `proposals` lists decrypted proposal summaries by replaying encrypted room records.
- `comments` lists decrypted comment/request roots and replies by replaying encrypted room records, with optional type/path/open filters.
- `requests` lists unresolved encrypted request threads by default so agents can answer human asks without scanning ordinary comments.
- `comment` appends an encrypted agent-authored file or quote comment/request without changing Markdown.
- `reply` appends an encrypted reply to an unresolved comment or request. Resolved threads reject replies until reopened.
- `context` prints a redacted agent handoff packet with accepted files, unresolved comments, and proposal summaries. It decrypts locally and does not include room tokens by default.
- `show-proposal` decrypts one proposal, including proposed Markdown and timeline events.
- `accept` appends an encrypted canonical document update plus an encrypted proposal-accepted event. Its JSON response is compact and does not echo the accepted Markdown body.
- `reject` appends an encrypted proposal-rejected event without changing canonical Markdown. Its JSON response is compact and does not echo the rejected Markdown body.
- `patch` is a compatibility wrapper around `propose`.
- `--json` emits stable schema identifiers for agent workflows:
  - `fold.publish.result.v1`
  - `fold.export.result.v1`
  - `fold.status.result.v1`
  - `fold.propose.result.v1`
  - `fold.proposals.result.v1`
  - `fold.comments.result.v1`
  - `fold.comment.result.v1`
  - `fold.reply.result.v1`
  - `fold.resume.result.v1`
  - `fold.context.result.v1`
  - `fold.show-proposal.result.v1`
  - `fold.accept.result.v1`
  - `fold.reject.result.v1`
  - `fold.patch.result.v1`
  - `fold.room.create.result.v1`

Routine JSON results such as `status`, `export`, `resume`, `propose`, `proposals`, `comments`, `context`, `show-proposal`, `accept`, and `reject` include safe room routing fields (`roomId`, `serverRoomUrl`, `appUrl`, `syncUrl`) but omit decryption-capable `room.url`, `room.token`, and `roomSecret` fields. Secret-bearing room access material is only emitted by explicit create, publish, add/show profile, and invite workflows.

## Agent Workflow

Cold agents should prefer the pinned package runner from the copied handoff:

```bash
npx --yes fold-agent@0.1.2 bootstrap --room "fold:v1:..." --alias launch --output ./accepted-project --json
```

Inside this repository during development, use the local wrapper. Agents should
still prefer JSON output and saved aliases:

```bash
ROOM_JSON=$(npm run --silent cli -- publish ./project --app-url http://127.0.0.1:3000 --sync-url http://127.0.0.1:8787 --alias launch --json)
ROOM_URL=$(node -e 'let s=""; process.stdin.on("data", d => s += d); process.stdin.on("end", () => console.log(JSON.parse(s).room.url));' <<< "$ROOM_JSON")
npm run --silent cli -- bootstrap --room "$ROOM_URL" --alias launch --output ./accepted-project --json
npm run --silent cli -- comments --room launch --json
npm run --silent cli -- requests --room launch --json
npm run --silent cli -- post ./accepted-project/NEW_FILE.md --room launch --path NEW_FILE.md --json
npm run --silent cli -- propose ./accepted-project --room launch --title "Tighten plan" --comment "Proposed by agent workflow." --json
npm run --silent cli -- proposals --room launch --json
```

For warm repeat work in the same project, use the saved alias from `.fold/rooms.json`:

```bash
npx --yes fold-agent@0.1.2 resume --room launch --output ./accepted-project --json
```

Repeat users can optionally install the CLI when their environment keeps global
tools:

```bash
npm install -g fold-agent@0.1.2
fold-agent skill status
fold-agent resume --room launch --output ./accepted-project --json
```

Skill installation is bundled into `fold-agent bootstrap`. Live project memory
still comes from encrypted room replay through `resume` or `context`.

If the agent is creating the project room for a human, run `fold room invite <alias> --for human` after publish and send that invite text back to the user. The invite contains the browser room link and client-side key, so treat it as secret.

If the agent has no source file yet, use `fold room create --alias <name>` instead of `publish`. When humans will join through the web app and the sync server is on a different origin, pass both `--app-url` and `--sync-url`.

When testing the development CLI from another project directory, call the entrypoint directly so `.fold/rooms.json` is written in that project instead of this repo:

```bash
/path/to/fold/node_modules/.bin/tsx /path/to/fold/src/cli/bin.ts publish ./plan.md --app-url http://127.0.0.1:3000 --sync-url http://127.0.0.1:8787 --json
```

Use `--no-save` for stateless automation that should not write `.fold/rooms.json`:

```bash
npm run --silent cli -- publish ./plan.md --app-url http://127.0.0.1:3000 --sync-url http://127.0.0.1:8787 --no-save --json
```

## Room URLs And Tokens

A room URL uses the product shape:

```text
https://example.test/room/:roomId#key=:roomSecret
```

The fragment key is client-side key material. Parsing always separates `serverRoomUrl` from `url`, and `serverRoomUrl` never contains `#key=...`.

The CLI token shape is:

```text
fold:v1:<base64url-json>
```

The decoded token contains `v`, `roomId`, `roomSecret`, `appUrl`, and `syncUrl`. Older compatibility tokens may contain `serverUrl`. Treat any token like a secret because it grants local decryption access.

`.fold/rooms.json` is a local access-token store. It can contain room URLs and tokens with client-side key material so agents can reuse a room alias without prompting. Do not commit or share it unless you intentionally want to share room access.

The CLI creates `.fold` as owner-only (`0700`) and writes `.fold/rooms.json` as owner-read/write (`0600`) where POSIX file modes are supported. The browser workspace is different: its recent-project list stores non-secret convenience metadata such as room id, display name, source, last visit time, and review counts by default. Browser access still comes from a `#key=...` URL fragment or a pasted key/link; opening a recent project without a key shows the room access gate.

Room profiles store separate URLs:

- `appUrl`: the web app origin humans open.
- `syncUrl`: the append-log API/WebSocket origin clients call.
- `serverUrl`: compatibility alias for `syncUrl`.

When `--app-url`, `--sync-url`, and `--server` are omitted, `publish` and `room create` use `FOLD_PUBLIC_APP_URL` / `FOLD_PUBLIC_SYNC_URL`, then `FOLD_PUBLIC_URL`, then common provider public URL variables, then local development defaults.

`fold room invite` warns when `appUrl` or `syncUrl` looks local-only, such as `localhost`, `127.0.0.1`, or private LAN addresses.

## Agent Skill

The web app exposes an agent skill at:

```text
/.well-known/fold/agent-skill.md
```

Agent invites point to this skill and instruct the agent to run `npx --yes fold-agent@0.1.2 bootstrap --room ... --alias ... --output ./fold-project-<room-alias> --json`. Use `fold-agent post` for fresh Markdown files and `fold-agent propose` for existing-file changes.

## Append-Log API Contract

The CLI talks to the append-log sync API. Room contents are encrypted before any request leaves the CLI:

- `POST /rooms/:roomId/updates` appends encrypted payloads and broadcasts them to WebSocket subscribers.
- `GET /rooms/:roomId/updates` replays encrypted append-log records.
- `GET /rooms/:roomId/status` returns non-sensitive room metadata.
- `GET /rooms/:roomId/ws` remains the WebSocket stream for live encrypted updates.

Records have plaintext routing metadata (`roomId`, `seq`, `senderId`) and encrypted payload material (`nonce`, `ciphertext`). Clients validate contiguous delivered sequences before replaying room state, but the current alpha still does not provide malicious-server fork/truncation proofs, append-log compaction, access control, or key rotation.

Accepted document updates, project snapshots, proposals, proposal decisions, comments, versions, persona records, and timeline events are typed encrypted payloads in the same room log. Presence updates are broadcast live and are not persisted as durable append-log records.

## Fresh Verification Notes

The current fresh local workflow has been verified with:

- `publish --json`
- `room create --json`
- `room add --json`
- `room invite`
- `resume --json`
- `status --json`
- `export --json`
- `context --json`
- `propose --json`
- `proposals --json`
- `show-proposal --json`
- `accept --json`
- `reject --json`
- `export --output --json`
- `publish --no-save --json`
- `comments --json`
- `requests --json`
- `comment --json`
- `reply --json`

The verification also checked that fresh test Markdown phrases were not present as plaintext in `./data` or `.fold`.
