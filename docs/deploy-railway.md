# Deploy Fold On Railway

Railway is a good hosted alpha path for Fold when you attach persistent storage
and keep one running instance.

Official docs:

- Railway volumes: https://docs.railway.com/volumes
- Railway health checks: https://docs.railway.com/deployments/healthchecks
- Railway public networking: https://docs.railway.com/networking/public-networking

## Fold Contract

Railway must satisfy the same Fold deployment contract as any other host:

- long-lived Node or Docker service;
- HTTPS public origin;
- WebSocket support for `/rooms/:roomId/ws`;
- persistent volume mounted into the service;
- `FOLD_PUBLIC_URL` set to the public HTTPS origin;
- `FOLD_DATA_DIR` set to a path on the mounted volume;
- `/health` configured as the health check path;
- one running instance with the current file-backed append log.

## Settings

Use either the Node build path or the repository Dockerfile.

Node build path:

```bash
npm install
npm run build
npm start
```

Environment:

```bash
NODE_ENV=production
HOST=0.0.0.0
FOLD_PUBLIC_URL=https://your-railway-domain.example
FOLD_DATA_DIR=/data/append-log
```

Railway provides `PORT` at runtime. Set `FOLD_DATA_DIR` to the volume mount
path you choose. If your volume is mounted at `/data`, use
`/data/append-log`.

`RAILWAY_PUBLIC_DOMAIN` may let Fold infer a public URL, but
`FOLD_PUBLIC_URL` is the portable contract and should be set explicitly.

## First Room

After deploy, verify the service:

```bash
curl https://your-railway-domain.example/health
npm run smoke:deploy -- --base-url https://your-railway-domain.example
```

Create a room:

```bash
FOLD_PUBLIC_URL=https://your-railway-domain.example \
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

Human invites contain a `#key=...` fragment. Agent invites contain a
`fold:v1:` token. Treat both as secrets.

## Notes

- Keep one replica. The current file append-log store is single-writer only.
- Back up the Railway volume if room history matters, and export accepted
  Markdown with `npm run --silent cli -- export --room <alias> --output ./export`
  before risky redeploys or storage changes.
- Localhost URLs are local-only and are not shareable with humans outside the
  same machine.
- The server stores encrypted records plus plaintext routing metadata, not
  Markdown content or room keys.
