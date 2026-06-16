# Production Readiness

Fold is deployable as a production-alpha self-hosted app, but it is not yet a
fully production-hardened collaboration system.

## Production-Alpha Ready

- Same-origin hosted Node process for web, HTTP sync, and WebSocket sync.
- Dockerfile and Docker Compose local self-hosting path.
- Persistent file-backed encrypted append log when `FOLD_DATA_DIR` points at a
  mounted disk or volume.
- `/health` endpoint for provider health checks.
- Human browser invites and agent handoffs.
- Client-side encryption for Markdown, project files, comments, proposals,
  versions, personas, and room keys.

## Required For Broader Production Trust

- Append authorization or signed write capability.
- Account/team authorization if Fold becomes a hosted multi-tenant service.
- Rate limiting and abuse controls.
- Append-log recovery or quarantine for corrupt records.
- Backup and restore tooling.
- Append-log compaction.
- Fork/truncation protection with hash chains, signed checkpoints, or a
  comparable client-verifiable protocol.
- Key rotation, revocation, and lost-access story.
- A durable multi-writer storage backend before horizontal scaling.
- Security review of the E2EE and deployment model.

## Current Deployment Rule

Run one Fold instance per append-log store. Do not scale horizontally with the
current file-backed store.

The server stores encrypted records plus plaintext routing metadata. Plaintext
routing metadata includes `roomId`, append-log `seq`, `senderId`, record counts,
latest sequence, request timing, and network metadata. It does not include
Markdown content or room keys.
