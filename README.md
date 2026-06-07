# Agent MD Rooms

Agent MD Rooms is an early OSS product plan and spike repo for private collaborative rooms around Markdown files created by humans and agents.

The goal is an Excalidraw-style sharing layer and Notion-leaning reader/editor where any `.md` file can become a room: humans and agents can review, edit, comment, submit proposals, keep distinct personas, and export clean Markdown.

Start with [PLAN.md](PLAN.md).

## Current Status

This repository currently contains the product/technical plan, the executable E2EE/document-model spikes, and an early server-backed CLI.

The E2EE Yjs append-log spike supports the v1 direction of a custom encrypted WebSocket provider where the server stores opaque encrypted Yjs payloads plus plaintext routing metadata (`roomId`, `seq`, `senderId`). Document Markdown, proposal records, proposal status events, timeline events, and persona metadata stay encrypted room payloads that are decrypted and replayed client-side.

## Local Server Flow

Install dependencies:

```bash
npm install
```

Start the append-log server with file-backed persistence:

```bash
npm run server -- --port 8787 --data ./data
```

The server defaults to `--host 127.0.0.1`, `--port 8787`, and `--data ./data/append-log` when flags are omitted. Check it with:

```bash
curl http://127.0.0.1:8787/health
```

Publish a Markdown file into an encrypted room:

```bash
npm run cli -- publish ./notes.md --server http://127.0.0.1:8787
```

The publish output includes a room URL and an `mdroom:v1:` token. Use either as `--room` for follow-up commands:

```bash
npm run cli -- status --room '<room-url-or-token>'
npm run cli -- export --room '<room-url-or-token>' --output ./exported.md
npm run cli -- propose ./proposal.md --room '<room-url-or-token>' --title 'Tighten the draft' --comment 'Clarifies the opening section.'
npm run cli -- proposals --room '<room-url-or-token>'
npm run cli -- show-proposal '<proposal-id>' --room '<room-url-or-token>'
npm run cli -- accept '<proposal-id>' --room '<room-url-or-token>'
npm run cli -- reject '<proposal-id>' --room '<room-url-or-token>'
```

The older `patch` command remains available as a compatibility wrapper around proposal submission:

```bash
npm run cli -- patch ./proposal.md --room '<room-url-or-token>' --summary 'Tighten the draft'
```

The room key stays in the URL fragment or local token and is not sent to the server. The server persists encrypted update payloads plus plaintext routing metadata only. Proposal statuses are not mutable server-side state; clients derive them by decrypting and replaying room records.

## Guiding Principles

- Markdown stays portable and exportable.
- Agent workflows should be CLI-first and machine-friendly.
- Sharing should feel lightweight, like Excalidraw room links.
- Editing should feel polished, closer to Notion than a raw text editor.
- Humans and agents should be legible participants with distinct personas, not anonymous writes.
- Agent changes should carry commit-like explanations, diffs, review status, and comments.
- OSS dependencies should be permissive by default and license-reviewed before adoption.
