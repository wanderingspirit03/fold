# Deploy Fold On Generic Node Or Container Clouds

This recipe covers Render-style hosts: platforms that run a long-lived Node or
Docker service, provide HTTPS, support WebSockets, and can attach persistent
storage. The same contract also applies to Northflank and similar container
clouds.

Official docs worth checking before deploy:

- Render web services: https://render.com/docs/web-services
- Render persistent disks: https://render.com/docs/disks
- Render health checks: https://render.com/docs/health-checks
- Render WebSockets: https://render.com/docs/websocket
- Northflank volumes: https://northflank.com/docs/v1/application/databases-and-persistence/add-a-volume

## Fold Contract

Your host must provide:

- build command: `npm install && npm run build`;
- start command: `npm start`;
- public HTTPS origin;
- WebSocket support for `/rooms/:roomId/ws`;
- persistent disk or volume mounted into the service;
- health check path: `/health`;
- one running instance with the current file-backed append log.

In provider dashboards and docs, treat that as Fold's single instance rule:
do not configure multiple replicas or autoscaling for one append-log volume.

Environment:

```bash
NODE_ENV=production
HOST=0.0.0.0
FOLD_PUBLIC_URL=https://your-fold-host.example
FOLD_DATA_DIR=/persistent/fold/append-log
```

Most providers set `PORT` automatically. Do not hard-code the port in Fold.

## Render Notes

Use a Web Service, not a static site. Attach a persistent disk on a paid service
and set `FOLD_DATA_DIR` to the disk mount path plus `/append-log`. Render free
web services do not preserve local filesystem changes with persistent disks, so
they are not appropriate for durable Fold rooms.

Set the health check path to `/health`.

## Northflank Notes

Attach a persistent volume to the deployment service and mount it at a stable
path, then set `FOLD_DATA_DIR` to that mounted path plus `/append-log`.

## DigitalOcean App Platform Note

Fold's current file append-log requires persistent local storage. DigitalOcean
App Platform has documented limits around local filesystem persistence, so use a
provider mode with durable mounted storage, a VPS/Droplet, or wait for a future
Fold durable-store backend before treating App Platform as a durable target.

## First Room

Verify the service:

```bash
curl https://your-fold-host.example/health
npm run smoke:deploy -- --base-url https://your-fold-host.example
```

Create and invite:

```bash
FOLD_PUBLIC_URL=https://your-fold-host.example \
npm run --silent cli -- room create --alias launch --json
npm run --silent cli -- room invite launch --for human
npm run --silent cli -- room invite launch --for agent
```

The human invite and agent invite are secret-bearing outputs. Keep the `#key`
fragment, `fold:v1:` token, and copied handoffs out of public logs.

## Notes

- Keep one instance.
- Back up the persistent disk or volume, and export accepted Markdown with
  `npm run --silent cli -- export --room <alias> --output ./export` before risky
  redeploys or storage changes.
- If the copied URL starts with `localhost`, it is local-only and remote humans
  cannot use it.
