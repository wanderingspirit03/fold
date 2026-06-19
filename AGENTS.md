# Agent Notes

## Project Scope

Fold is an OSS, self-hostable collaboration platform for Markdown files created and edited by humans and coding agents. The target product is a collaborative encrypted project workspace with file-first navigation, calm document collaboration, private share links, strict E2EE constraints, real-time editing, inline comments, reviewable suggestions, and a machine-friendly CLI.

The product language should emphasize projects, files, humans, and agents. Describe Fold in its own terms; avoid positioning it as a clone or blend of other products.

Start with `PLAN.md` before making product or architecture changes.

## Current Implementation State

- The active spikes are `spikes/e2ee-yjs-append-log/` and `spikes/document-model/`.
- V1 canonical document state is raw Markdown in `Y.Text`; editor-native structures are helper/derived state unless they prove lossless Markdown fidelity.
- The E2EE spike validates encrypted Yjs update payloads, WebSocket backlog replay, same-client reconnect, basic file-backed JSONL restart/replay, metadata authentication for client-known fields, and delivered-record sequence/replay detection.
- The document-model spike compares Markdown-canonical `Y.Text` against a non-UI ProseMirror/CommonMark editor-canonical proxy and records the v1 Markdown-canonical decision.
- The repo has a server-backed TypeScript CLI, file-backed append-log server, hosted same-origin Node entrypoint, Docker/Compose deployment files, and an early Next.js web room app.
- Local development usually starts with `npm run server -- --port 8787 --data ./data`, `npm run web:dev`, then `npm run --silent cli -- publish ./notes.md --app-url http://127.0.0.1:3000 --sync-url http://127.0.0.1:8787 --json`.
- Hosted alpha deployment usually starts with `npm run build`, `npm start`, `FOLD_PUBLIC_URL`, and a persistent `FOLD_DATA_DIR`.
- Current CLI room workflow includes `publish`, `resume`, `room create/add/list/show/set-url/forget/invite`, `status`, `export`, `context`, `comment`, `reply`, `comments`, `requests`, `propose`, `proposals`, `show-proposal`, `accept`, `reject`, and legacy `patch` as a compatibility wrapper around proposal submission.
- Proposal records, proposal status/timeline events, comments, file versions, persona metadata, project snapshots, and document Markdown are encrypted room payloads decrypted/replayed client-side. Proposal status is derived by replaying encrypted room records, not by trusting mutable plaintext server state.
- Presence payloads are encrypted client-side and broadcast over WebSocket only; they are not persisted in the durable append log.
- Routine JSON command outputs must stay redacted: only explicit create, publish, room profile, and invite workflows should emit decryption-capable room URLs, tokens, or secrets.
- Agent personas should be assigned by the room/system, not self-selected by agents. Preserve distinct, memorable agent personas and visible agent-vs-human identity.
- The server still stores plaintext routing metadata: `roomId`, `seq`, and `senderId`.
- Production-grade durability, append-log compaction, fork/truncation detection, hash chains or signed checkpoints, presence/awareness protocol hardening, key rotation/revocation, account authorization, robust inline anchoring, and richer editor integration remain open.

## Renderer and Editor Direction

- Keep raw Markdown as the durable source of truth for v1.
- Read mode is locked to `react-markdown` with remark/rehype: `remark-gfm`, `remark-math`, `rehype-katex`, `katex`, `rehype-raw` only behind policy, `rehype-sanitize`, `shiki`, and `rehype-pretty-code`.
- Never render unsanitized raw HTML from shared rooms.
- Render Mermaid fences as placeholders first; add live Mermaid only behind a sanitized/isolated component.
- Edit mode is currently source-only Markdown. Do not add a nested rich/source toggle inside edit mode; the room-level Read/Edit switch is enough.
- A polished rich Markdown editor such as Milkdown can be revisited only after it proves lossless Markdown import/export fidelity and does not add extra UI mode clutter.
- Do not reintroduce BlockNote or block-doc-first editors as first-line v1 dependencies unless Markdown round-tripping evidence forces a plan change.

## Working Rules

- Do not build or change UI unless the user explicitly asks; another model may prototype UI separately. If building UI, follow the locked renderer/editor direction above.
- Preserve the strict E2EE direction: document payloads must stay unreadable to the server.
- Be precise about what is encrypted. Plaintext routing metadata is acceptable for the current spike only when documented.
- Prefer permissive OSS dependencies. Treat MPL, GPL, AGPL, source-available, commercial, or premium packages as explicit approval items.
- Use web search/current docs lookup when dependency or API details may have changed.
- After implementation, verify with a separate subagent before calling the work done.

## Checks

Run these before reporting completion:

```bash
npm run check
```

`npm run spike:document-model:report` is a non-mutating freshness check. Use
`npm run spike:document-model:report:update` only when intentionally
regenerating the tracked comparison report artifacts.
