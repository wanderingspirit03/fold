# Fold CLI

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
fold export --room <alias-or-url-or-token> [--path <room-path>] [--output <file-or-directory>] [--json]
fold status --room <alias-or-url-or-token> [--json]
fold propose <file-or-directory> --room <alias-or-url-or-token> [--path <room-path>] [--title <text>] [--comment <text>] [--json]
fold proposals --room <alias-or-url-or-token> [--json]
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
npm run --silent cli -- publish ./notes.md --server http://127.0.0.1:8787 --alias notes --json
```

Use `--silent` with `npm run` when parsing JSON. Without it, npm can print its run banner before the CLI output.

When an agent creates a room first, the non-JSON `publish` output prints the next human and agent invite commands:

```bash
fold publish ./project --server http://127.0.0.1:8787 --alias launch
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
- Unless `--no-save` is passed, room profiles are written to `.fold/rooms.json`.
- `export` fetches encrypted records from `GET /rooms/:roomId/updates`, decrypts and replays accepted project records locally, and writes one Markdown file or a project directory.
- `status` calls `GET /rooms/:roomId/status`, which returns metadata only: `roomId`, `recordCount`, and `latestSeq`.
- `propose` submits an encrypted whole-file or whole-project replacement proposal. It does not mutate accepted Markdown. Its JSON response is compact and returns proposal ids, status, persona, hashes, and project summaries, not full proposed Markdown.
- `proposals` lists decrypted proposal summaries by replaying encrypted room records.
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
  - `fold.show-proposal.result.v1`
  - `fold.accept.result.v1`
  - `fold.reject.result.v1`
  - `fold.patch.result.v1`
  - `fold.room.create.result.v1`

## Agent Workflow

Agents should prefer JSON output and explicit room references:

```bash
ROOM_JSON=$(npm run --silent cli -- publish ./project --server http://127.0.0.1:8787 --alias launch --json)
ROOM_URL=$(node -e 'let s=""; process.stdin.on("data", d => s += d); process.stdin.on("end", () => console.log(JSON.parse(s).room.url));' <<< "$ROOM_JSON")
npm run --silent cli -- room add "$ROOM_URL" --alias launch
npm run --silent cli -- status --room launch --json
npm run --silent cli -- export --room launch --output ./accepted-project --json
npm run --silent cli -- propose ./accepted-project --room launch --title "Tighten plan" --comment "Proposed by agent workflow." --json
npm run --silent cli -- proposals --room launch --json
```

If the agent is creating the project room for a human, run `fold room invite <alias> --for human` after publish and send that invite text back to the user. The invite contains the browser room link and client-side key, so treat it as secret.

If the agent has no source file yet, use `fold room create --alias <name>` instead of `publish`. When humans will join through the web app and the sync server is on a different origin, pass both `--app-url` and `--sync-url`.

When testing the development CLI from another project directory, call the entrypoint directly so `.fold/rooms.json` is written in that project instead of this repo:

```bash
/path/to/fold/node_modules/.bin/tsx /path/to/fold/src/cli/bin.ts publish ./plan.md --server http://127.0.0.1:8787 --json
```

Use `--no-save` for stateless automation that should not write `.fold/rooms.json`:

```bash
npm run --silent cli -- publish ./plan.md --server http://127.0.0.1:8787 --no-save --json
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

Room profiles store separate URLs:

- `appUrl`: the web app origin humans open.
- `syncUrl`: the append-log API/WebSocket origin clients call.
- `serverUrl`: compatibility alias for `syncUrl`.

`fold room invite` warns when `appUrl` or `syncUrl` looks local-only, such as `localhost`, `127.0.0.1`, or private LAN addresses.

## Agent Skill

The web app exposes an agent skill at:

```text
/.well-known/fold/agent-skill.md
```

Agent invites point to this skill and then instruct the agent to run `fold room add ... --alias ...`.

## TODO: Server Integration

The current HTTP spike contract is:

- `POST /rooms/:roomId/updates` appends encrypted payloads and broadcasts them to WebSocket subscribers.
- `GET /rooms/:roomId/updates` replays encrypted append-log records.
- `GET /rooms/:roomId/status` returns non-sensitive room metadata.
- `GET /rooms/:roomId/ws` remains the WebSocket stream for live encrypted updates.

Future production work should split accepted document updates and review suggestions into clearer room namespaces or typed encrypted envelopes. This spike keeps suggestions in the encrypted append log and identifies them by sender id prefix so export can validate sequence continuity while ignoring unaccepted suggestions.

## Fresh Verification Notes

The current fresh local workflow has been verified with:

- `publish --json`
- `status --json`
- `export --json`
- `propose --json`
- `proposals --json`
- `show-proposal --json`
- `accept --json`
- `export --output --json`
- `publish --no-save --json`

The verification also checked that fresh test Markdown phrases were not present as plaintext in `./data` or `.fold`.
