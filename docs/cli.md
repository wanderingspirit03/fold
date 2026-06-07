# mdroom CLI Skeleton

This first CLI pass is intentionally bounded. It creates a stable local foundation for agent workflows without pretending the production room server exists yet.

## Commands

```bash
mdroom publish <file.md> [--server <url>] [--json] [--no-save]
mdroom export --room <url-or-token> [--output <file>] [--json]
mdroom status --room <url-or-token> [--json]
```

During development, run the CLI through:

```bash
npm run cli -- publish README.md --json
```

## Current Behavior

- Markdown is canonical as raw text in `Y.Text` named `markdown`.
- `publish` creates a local room id and client-side room secret.
- The initial Markdown state is encoded as a Yjs update and encrypted with the existing E2EE append-log spike crypto.
- Unless `--no-save` is passed, metadata is written to `.mdroom/rooms.json`.
- `export` and `status` read `.mdroom/rooms.json`; they do not contact a server yet.
- `--json` emits stable schema identifiers for agent workflows:
  - `mdroom.publish.result.v1`
  - `mdroom.export.result.v1`
  - `mdroom.status.result.v1`

## Room URLs And Tokens

A room URL uses the product shape:

```text
https://example.test/room/:roomId#key=:roomSecret
```

The fragment key is client-side key material. Parsing always separates `serverRoomUrl` from `url`, and `serverRoomUrl` never contains `#key=...`.

The CLI token shape is:

```text
mdroom:v1:<base64url-json>
```

The decoded token contains `v`, `roomId`, `roomSecret`, and `serverUrl`. Treat it like a secret because it grants local decryption access.

## TODO: Server Integration

The production path should replace the local encrypted snapshot with real append-log room creation and replay:

- Create a server room without sending `roomSecret` or URL fragments.
- Send encrypted Yjs updates only, using plaintext routing metadata allowed by the spike: `roomId`, `seq`, and `senderId`.
- Export by replaying encrypted append-log records locally and reading the `markdown` Y.Text.
- Keep `--json` schemas backwards-compatible or introduce explicit `v2` schema names.
