# Deploy Fold On Fly.io Or A VPS

Use this path when you want a more explicit self-hosted setup: a Docker image or
Node process behind HTTPS with a mounted persistent disk.

Official docs worth checking:

- Fly app configuration: https://fly.io/docs/reference/configuration/
- Fly volumes: https://fly.io/docs/volumes/overview/
- Fly health checks: https://fly.io/docs/reference/health-checks/

## Fold Contract

Your host must provide:

- one long-lived Node or Docker process;
- HTTPS termination;
- WebSocket upgrades for `/rooms/:roomId/ws`;
- persistent mounted storage;
- health check path `/health`;
- one running instance with the current file-backed append log.

That is Fold's single instance rule: do not run multiple Fold processes against
one append-log directory.

Environment:

```bash
NODE_ENV=production
HOST=0.0.0.0
FOLD_PUBLIC_URL=https://your-fold.example
FOLD_DATA_DIR=/data/append-log
```

## Fly.io Notes

Use the repository Dockerfile or Node build path.

Node build command:

```bash
npm install
npm run build
```

Node start command:

```bash
npm start
```

Docker build command:

```bash
docker build -t fold .
```

Docker start command:

```bash
docker run --rm \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e FOLD_PUBLIC_URL=https://your-fold.example \
  -e FOLD_DATA_DIR=/data/append-log \
  -v fold-data:/data \
  fold
```

Create and mount a Fly volume, then set `FOLD_DATA_DIR` to the mounted path plus
`/append-log`. Keep one machine for the current file-backed append log unless a
later Fold storage backend supports multiple writers.

Configure an HTTP health check for `/health`.

## VPS Notes

On a VPS, use Docker Compose or a process manager. Put a reverse proxy such as
Caddy, nginx, or your platform load balancer in front of Fold for HTTPS and
WebSocket upgrades.

Node build command:

```bash
npm install
npm run build
```

Node start command:

```bash
npm start
```

Use a persistent directory such as:

```bash
FOLD_DATA_DIR=/var/lib/fold/append-log
```

Restrict filesystem permissions so only the Fold service user can read or write
the append-log directory.

## First Room

Verify:

```bash
curl https://your-fold.example/health
npm run smoke:deploy -- --base-url https://your-fold.example
```

Create and invite:

```bash
FOLD_PUBLIC_URL=https://your-fold.example \
npm run --silent cli -- room create --alias launch --json
npm run --silent cli -- room invite launch --for human
npm run --silent cli -- room invite launch --for agent
```

The human invite contains `#key=...`; the agent invite contains a `fold:v1:`
token. Treat both as secrets.

## Notes

- Back up `/var/lib/fold/append-log`, the mounted Fly volume, or whichever
  durable path you configure. Export accepted Markdown with
  `npm run --silent cli -- export --room <alias> --output ./export` before risky
  deploys or storage changes.
- Local-only URLs are not shareable with remote humans.
- The server stores encrypted room records plus plaintext routing metadata.
