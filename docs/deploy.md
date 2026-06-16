# Deploy Fold

Fold's recommended hosted alpha shape is one public origin serving the web app,
HTTP sync, and WebSocket sync:

```text
https://your-fold.example/room/:roomId#key=...
https://your-fold.example/rooms/:roomId/updates
https://your-fold.example/rooms/:roomId/ws
```

The same-origin shape keeps human room links and agent handoffs simple. The
server stores encrypted room payloads plus minimal plaintext routing metadata;
clients decrypt and replay room state.

## Deployment Contract

Fold is cloud-agnostic. Any host can run it if the host provides:

- Node.js 22 or a container runtime.
- A long-lived process that can bind to `0.0.0.0`.
- A `PORT` environment variable, or an equivalent configured port.
- HTTPS for shared deployments.
- WebSocket upgrades for `/rooms/:roomId/ws`.
- Persistent disk or volume storage for encrypted append-log records.
- One running Fold instance for the current file-backed append log.
- A health check against `/health`.

The portable environment contract is:

```bash
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
FOLD_PUBLIC_URL=https://your-fold.example
FOLD_DATA_DIR=/persistent/fold/append-log
```

Most cloud hosts set `PORT` automatically. `FOLD_PUBLIC_URL` is the public
origin copied into room links and CLI invites. `FOLD_DATA_DIR` must point at
storage that survives restarts and redeploys. Without persistent storage, room
history can disappear.

Pure serverless-only hosting is not the recommended path for the current alpha
because Fold needs WebSockets and durable append-log storage.

## Deployment Matrix

| Path | Best for | Required storage | Notes |
| --- | --- | --- | --- |
| Docker Compose | local self-hosting | named Docker volume | local unless exposed through LAN, tunnel, or reverse proxy |
| Railway | easiest hosted alpha | attached volume | keep one replica |
| Render, Northflank, DigitalOcean App Platform | generic Node/container cloud | persistent disk or supported external durable storage | same env contract |
| Fly.io or VPS | technical self-hosting | mounted volume | configure HTTPS and one app instance |
| Split web/sync | advanced deployments | sync host only | requires build-time browser sync URL |

## Generic Node Or Container Host

Use these commands on hosts that support Node build/start commands:

```bash
npm install
npm run build
npm start
```

`npm start` runs the hosted Fold process. It serves Next.js pages plus the
encrypted append-log API from the same port.

Set:

```bash
FOLD_PUBLIC_URL=https://your-public-fold-url.example
FOLD_DATA_DIR=/persistent/fold/append-log
```

Fold recognizes provider public URL variables as convenience fallbacks when
`FOLD_PUBLIC_URL` is missing, but the portable contract is still
`FOLD_PUBLIC_URL`.

## Docker Compose

For local self-hosting from a clean checkout:

```bash
FOLD_PUBLIC_URL=http://localhost:3000 docker compose up --build
```

The compose file stores append-log data in the `fold-append-log` Docker volume
at `/data/append-log` inside the container.

`http://localhost:3000` links are same-machine links. They are not shareable
with humans on other machines unless you expose Fold through a LAN address, a
public tunnel, a VPS, or a cloud deployment and set `FOLD_PUBLIC_URL` to that
reachable origin.

For a direct Docker run:

```bash
docker build -t fold .
docker run --rm \
  -p 3000:3000 \
  -e FOLD_PUBLIC_URL=http://localhost:3000 \
  -v "$PWD/data:/data" \
  fold
```

For hosted containers, mount `/data` to persistent storage and set
`FOLD_PUBLIC_URL` to the public HTTPS origin.

See [deploy-docker.md](deploy-docker.md) for the Docker-focused recipe.

## Provider Recipes

- [Railway](deploy-railway.md)
- [Render-style Node/container hosts](deploy-render.md)
- [Docker and Docker Compose](deploy-docker.md)
- [Fly.io or VPS](deploy-vps.md)

Each recipe is a thin wrapper around the same contract: `PORT`,
`FOLD_PUBLIC_URL`, `FOLD_DATA_DIR`, HTTPS, WebSockets, persistent storage, and
one running instance.

## Split Web And Sync Hosts

Same-origin hosting is recommended. If the web app and append-log sync server
are deployed separately, set both origins:

```bash
FOLD_PUBLIC_APP_URL=https://fold-web.example
FOLD_PUBLIC_SYNC_URL=https://fold-sync.example
NEXT_PUBLIC_FOLD_SYNC_URL=https://fold-sync.example
```

The CLI uses `FOLD_PUBLIC_APP_URL` and `FOLD_PUBLIC_SYNC_URL` when creating
rooms. The browser uses `NEXT_PUBLIC_FOLD_SYNC_URL` because client-side Next.js
code only receives public build-time variables; set it before `npm run build`.

## Creating The First Hosted Room

From the hosted Fold repository or a machine that can reach the hosted URL:

```bash
FOLD_PUBLIC_URL=https://your-public-fold-url.example \
npm run --silent cli -- room create --alias launch --json
```

Copy a human invite:

```bash
npm run --silent cli -- room invite launch --for human
```

Copy an agent invite:

```bash
npm run --silent cli -- room invite launch --for agent
```

The human invite includes a browser URL with `#key=...`. The agent invite
includes a `fold:v1:` token plus CLI commands for joining, exporting, proposing,
and replying. Treat both as secrets.

## Smoke Checks

Read-only smoke for any deployed Fold origin:

```bash
curl https://your-fold.example/health
npm run smoke:deploy -- --base-url https://your-fold.example
```

Write smoke: creates room data and prints secret-bearing invite output.

```bash
FOLD_PUBLIC_URL=https://your-fold.example \
npm run --silent cli -- room create --alias smoke --json
npm run --silent cli -- room invite smoke --for human
```

Delete or forget the local `smoke` alias afterward if you do not need it.

## Production-Alpha Checklist

Before sharing a hosted alpha room outside your own machine:

- Serve Fold over HTTPS.
- Confirm WebSocket upgrades work for `/rooms/:roomId/ws`.
- Attach persistent storage and set `FOLD_DATA_DIR` to that mounted path.
- Keep one running Fold instance with the current file-backed append log.
- Set `FOLD_PUBLIC_URL` to the origin people actually open.
- Back up the append-log volume if room history matters.
- Keep room URLs, `fold:v1:` tokens, copied invites, `.fold/rooms.json`, and
  deployment logs out of public places.
- Restrict filesystem access to the append-log volume to the service account
  that runs Fold.
- Keep an export or saved invite/token if losing access would matter; the
  server cannot recover the room key.

## Environment Variables

| Variable | Use |
| --- | --- |
| `NODE_ENV` | Use `production` for hosted runtime validation and production Next.js behavior. |
| `HOST` | Bind host. Defaults to `0.0.0.0` for the hosted process. |
| `PORT` | Port for the hosted Node process. Most hosts set this automatically. |
| `FOLD_PUBLIC_URL` | Same-origin public HTTPS URL for both web and sync. Preferred alpha setting. |
| `FOLD_DATA_DIR` | Persistent append-log directory. Defaults are suitable only for local/dev use. |
| `FOLD_PUBLIC_APP_URL` | Public browser app origin for split deployments. |
| `FOLD_PUBLIC_SYNC_URL` | Public append-log HTTP/WebSocket origin for split deployments. |
| `NEXT_PUBLIC_FOLD_SYNC_URL` | Browser-visible sync origin for split deployments. Must be set at web build time. |

## E2EE Deployment Caveat

The hosted process stores encrypted room payloads and plaintext routing metadata
only. Plaintext routing metadata includes `roomId`, append-log `seq`,
`senderId`, record counts, latest sequence, request timing, and network
metadata. Markdown content, project files, proposals, comments, versions,
personas, and room keys remain client-side encrypted and are decrypted by the
browser or CLI.

This alpha does not yet include account authentication, ACLs, write
authorization, malicious-server fork/truncation proofs, compaction, key
rotation, or link revocation. Anyone with a valid room URL or token can decrypt
the room, and anyone who can reach the append-log API can currently submit
encrypted records for a known room id.
