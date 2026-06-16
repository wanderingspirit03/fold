# Deploy Fold With Docker

The repository includes a Dockerfile and Docker Compose file for local
self-hosting and container hosts.

Docker deployments use the same Fold contract: persistent storage, WebSocket
support for `/rooms/:roomId/ws`, `/health` for health checks, and a single
instance attached to a given append-log volume.

## Local Docker Compose

Run:

```bash
FOLD_PUBLIC_URL=http://localhost:3000 docker compose up --build
```

Open:

```text
http://localhost:3000
```

The compose file stores encrypted append-log records in the `fold-append-log`
volume mounted at `/data/append-log` inside the container.

`localhost` is same-machine only. To share with humans on other machines, expose
Fold through a LAN address, public tunnel, VPS, or cloud host and set
`FOLD_PUBLIC_URL` to that reachable origin.

## Direct Docker Run

```bash
docker build -t fold .
docker run --rm \
  -p 3000:3000 \
  -e FOLD_PUBLIC_URL=http://localhost:3000 \
  -v "$PWD/data:/data" \
  fold
```

For hosted Docker:

```bash
docker run --rm \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e FOLD_PUBLIC_URL=https://your-fold.example \
  -e FOLD_DATA_DIR=/data/append-log \
  -v fold-data:/data \
  fold
```

## Health And Invites

Read-only smoke:

```bash
curl http://localhost:3000/health
npm run smoke:deploy -- --base-url http://localhost:3000
```

Create a local room:

```bash
FOLD_PUBLIC_URL=http://localhost:3000 \
npm run --silent cli -- room create --alias local --json
```

Copy a human invite:

```bash
npm run --silent cli -- room invite local --for human
```

Copy an agent invite:

```bash
npm run --silent cli -- room invite local --for agent
```

Invites contain secret room access material. Do not paste them into public
issues, logs, or docs.

## Notes

- Keep a single instance attached to a given append-log volume.
- Back up the Docker volume if room history matters, and export accepted
  Markdown with `npm run --silent cli -- export --room <alias> --output ./export`
  before risky container or volume changes.
- The server stores encrypted records plus plaintext routing metadata only.
