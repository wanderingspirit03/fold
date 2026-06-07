# Agent Notes

## Project Scope

Agent MD Rooms is an OSS, self-hostable collaboration platform for Markdown files created by coding agents. The target product is a Notion-leaning Markdown room with Excalidraw-style sharing, strict E2EE constraints, real-time collaboration, inline comments, and a machine-friendly CLI.

Start with `PLAN.md` before making product or architecture changes.

## Current Non-UI State

- The active spikes are `spikes/e2ee-yjs-append-log/` and `spikes/document-model/`.
- V1 canonical document state is raw Markdown in `Y.Text`; editor-native structures are helper/derived state unless they prove lossless Markdown fidelity.
- The E2EE spike validates encrypted Yjs update payloads, WebSocket backlog replay, same-client reconnect, basic file-backed JSONL restart/replay, metadata authentication for client-known fields, and delivered-record sequence/replay detection.
- The document-model spike compares Markdown-canonical `Y.Text` against a non-UI ProseMirror/CommonMark editor-canonical proxy and records the v1 Markdown-canonical decision.
- The server still stores plaintext routing metadata: `roomId`, `seq`, and `senderId`.
- Production-grade durability, append-log compaction, fork/truncation detection, hash chains or signed checkpoints, awareness encryption, editor integration, comments, suggestions, and named versions remain open.

## Working Rules

- Do not build or change UI unless the user explicitly asks; another model may prototype UI separately.
- Preserve the strict E2EE direction: document payloads must stay unreadable to the server.
- Be precise about what is encrypted. Plaintext routing metadata is acceptable for the current spike only when documented.
- Prefer permissive OSS dependencies. Treat MPL, GPL, AGPL, source-available, commercial, or premium packages as explicit approval items.
- Use web search for current docs and Nia for code/docs/research lookup when helpful.
- After implementation, verify with a separate subagent before calling the work done.

## Checks

Run these before reporting completion:

```bash
npm test
npm run typecheck
npm run spike:e2ee
npm run spike:document-model
npm run spike:document-model:report
```
