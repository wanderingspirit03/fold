# E2EE Yjs Append-Log Spike

This spike tests the strict E2EE direction from `PLAN.md`: clients exchange Yjs updates, but the server only stores and broadcasts opaque encrypted records.

## Architecture tested

- The room secret represents the URL fragment key (`/room/:roomId#key=...`) and is never sent to the server.
- Each client derives an AES-GCM room key locally with HKDF using the room id as salt context.
- Local Yjs updates are encrypted before they are sent over WebSocket.
- The server appends `{ roomId, seq, senderId, nonce, ciphertext }` records and broadcasts them without decrypting or inspecting Yjs semantics.
- The Yjs payload is opaque to the server, while `roomId`, `seq`, and `senderId` remain plaintext routing metadata.
- Client-known metadata is authenticated with AES-GCM additional authenticated data, so tampering with `roomId` or `senderId` breaks decryption.
- Fresh clients subscribe over WebSocket, receive encrypted backlog records over the subscribed socket, decrypt locally, and replay updates into a Yjs document.
- Clients require delivered records to have contiguous increasing sequence numbers, rejecting gaps, duplicates/replays, and reordered records.
- The server can use either an in-memory store or a minimal file-backed JSONL store that persists encrypted records across process restarts.

## Verification

Run from the repo root:

```bash
npm install
npm run spike:e2ee
npm test
npm run typecheck
```

The spike passes only if:

- two connected clients converge on the same Markdown text;
- a fresh client can reconstruct the document from persisted encrypted updates;
- a fresh WebSocket subscriber receives existing backlog records without the old history/subscription race;
- tampering with authenticated metadata prevents decryption;
- delivered append-log sequence gaps, duplicates/replays, and reordered records are rejected;
- a restarted server can replay file-backed encrypted updates from disk;
- serialized server storage does not contain the plaintext Markdown or room secret;
- serialized disk storage does not contain the plaintext Markdown or room secret;
- a wrong room key cannot decrypt persisted updates.

## What this proves

This proves that a custom encrypted Yjs append-log provider is viable as a starting v1 spike for a single Markdown room, including basic durable replay from an opaque encrypted append log and client-side detection for delivered sequence gaps, duplicates/replays, and reordering.

## What this does not prove yet

- Large-room performance or append-log compaction.
- Cryptographic integrity for server-assigned `seq`, malicious-server fork detection, suffix truncation detection, signed checkpoints, or hash-chain validation.
- Offline edits and conflict-heavy reconnect behavior.
- Awareness/presence encryption.
- Comment anchoring, suggestions, or named versions.
- Browser editor integration with Milkdown or BlockNote.
- Production-grade durability, crash recovery, file locking, database migrations, or multi-process writes.
