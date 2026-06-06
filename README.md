# Agent MD Rooms

Agent MD Rooms is an early OSS product plan and spike repo for a real-time collaboration platform around Markdown files created by coding agents.

The goal is a Notion-leaning editor and reader where agents can publish Markdown, humans can review and comment, and both sides can collaborate through encrypted shareable rooms.

Start with [PLAN.md](PLAN.md).

## Current Status

This repository currently contains the product/technical plan plus the first executable spike: `spikes/e2ee-yjs-append-log/`.

The E2EE Yjs append-log spike currently passes local verification and supports the v1 direction of a custom encrypted WebSocket provider where the server stores opaque encrypted Yjs payloads plus plaintext routing metadata (`roomId`, `seq`, `senderId`). It includes WebSocket backlog replay to avoid the history/subscription race, metadata authentication for client-known fields, delivered-record sequence/replay detection, and a file-backed append-log restart test.

## Guiding Principles

- Markdown stays portable and exportable.
- Agent workflows should be CLI-first and machine-friendly.
- Sharing should feel lightweight, like Excalidraw room links.
- Editing should feel polished, closer to Notion than a raw text editor.
- OSS dependencies should be permissive by default and license-reviewed before adoption.
