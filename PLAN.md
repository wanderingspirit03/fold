# Agent MD Rooms Plan

## Summary

Build an OSS, self-hostable collaboration platform for agent-created `.md` files. The first product should feel like a Notion-leaning document editor for Markdown, with Excalidraw-style encrypted room links, live collaboration, inline comments, agent-friendly CLI workflows, and durable Markdown export.

The core collaboration unit is one Markdown document. Folders, workspaces, full agent-run archives, and SaaS-style account systems are intentionally deferred.

## Product Goals

- Let a coding agent publish a Markdown file into a collaborative room with one CLI command.
- Let humans read, edit, comment, and resolve threads in a polished web UI.
- Let agents submit follow-up edits or comments through the CLI.
- Keep Markdown portable: users can always export the current accepted document as raw `.md`.
- Make self-hosting easy enough for OSS users to deploy without heavy infrastructure.

## Core User Experience

- A room URL looks like `/room/:roomId#key=...`.
- The room key lives in the URL fragment or a local CLI token and is never sent to the server.
- The document opens in a beautiful read mode, with a clear switch into edit mode.
- Editing is rich and Markdown-backed, not a raw textarea by default.
- Inline comments attach to selected text or document blocks.
- Comments support replies, presence, and resolved state.
- Named versions capture important checkpoints such as initial publish, accepted agent patches, and manual saves.

## Safety Model

Prototype true end-to-end encryption before committing to the v1 architecture.

Spike result: a minimal custom encrypted Yjs append-log provider in `spikes/e2ee-yjs-append-log/` passed local verification. The current verdict is `viable_with_constraints` for v1, using client-side encrypted Yjs payloads instead of ordinary server-readable Yjs persistence. The server still stores plaintext routing metadata (`roomId`, `seq`, `senderId`). A file-backed JSONL append-log extension now proves basic durable replay after server restart.

- The server stores encrypted document state and encrypted room payloads.
- The server must not need plaintext document body, comments, or agent patches.
- The client and CLI decrypt locally using the room key.
- Server-side global search, admin recovery, and plaintext analytics are out of scope.
- Losing the room key means losing access unless the user has exported or backed up the document.
- Link revocation is not available in the simple room-link model. Revocation would require rotating the room key and re-encrypting room state.

This is deliberately closer to Excalidraw-style trust than classic SaaS document storage.

The first technical spike proved the basic Yjs encryption shape for a single Markdown text document: all document semantics remain client-side, and the sync server persists opaque encrypted Yjs payloads without inspecting Markdown, comments, or patch content. It also validates WebSocket backlog replay for joining clients, AES-GCM authentication of client-known metadata, and basic file-backed restart/replay. This does not yet prove production-grade durability, compaction, awareness encryption, editor integration, comments, suggestions, or named versions.

## Collaboration Model

Use Yjs as the real-time collaboration layer.

- Use Yjs for document state, presence, cursors, and conflict-free collaborative edits.
- Use a custom WebSocket sync provider for strict E2EE v1.
- Start from an encrypted append-log model: clients encrypt Yjs updates locally, the server stores and broadcasts opaque `{ roomId, seq, senderId, nonce, ciphertext }` records, and fresh clients replay the encrypted log after local decryption.
- Subscribe over WebSocket before replaying backlog. The server sends encrypted backlog records over the newly subscribed socket, then streams live records, avoiding the race where updates can land between HTTP history load and WebSocket subscription.
- Treat `roomId`, `seq`, and `senderId` as routing metadata, not private document content. Client-known metadata is bound to ciphertext with AES-GCM additional authenticated data; server-assigned sequence integrity, drop detection, and replay protection remain future protocol work.
- Do not start v1 with normal Hocuspocus persistence, because server-side `Y.Doc` or state-vector persistence conflicts with strict server-unreadability. Hocuspocus can be reconsidered only as a non-decrypting transport layer or for a weaker private-link model.
- Avoid `y-webrtc` as the default provider because self-hosted persistence and deployment should be predictable.

Important caveat: Yjs solves real-time synchronization, not review workflows by itself. Inline comments, anchors, suggestions, accept/reject flows, and named versions need explicit product and data modeling.

The canonical document representation must be decided before implementation. Candidate models are:

- Yjs/ProseMirror document state as canonical, with Markdown as import/export.
- Markdown text as canonical, with editor state derived from it.
- Hybrid model with editor state canonical during collaboration and Markdown snapshots at named checkpoints.

The current default to validate is the hybrid model, because it protects collaborative editing ergonomics while preserving Markdown portability.

## Editor Strategy

Prototype two editor paths before committing:

- Milkdown: MIT licensed, Markdown-native, ProseMirror-based, and Yjs-ready. Best default if Markdown fidelity and permissive licensing matter most.
- BlockNote: more Notion-like out of the box, but core licensing is MPL-2.0 and some adjacent packages/features may have GPL, premium, or commercial constraints.

The prototype should compare both on the same real agent-generated Markdown examples:

- Headings
- Lists and task lists
- Tables
- Code fences
- Links and images
- Frontmatter
- Mermaid
- Math
- Long agent plans and reports
- Markdown import/export fidelity
- Real-time editing behavior
- Inline comment anchoring

Default recommendation after verification: start implementation with Milkdown unless the prototype proves the Notion-like UX gap is too expensive.

Markdown round-tripping is a product risk, not a solved assumption. The prototype must measure how much formatting and structure survive import/export, especially for frontmatter, tables, Mermaid, math, code fences, and long agent reports.

## Agent CLI

Create a TypeScript/Node CLI that is pleasant for humans and predictable for coding agents.

Implementation defaults:

- Use `@bloomberg/stricli` for an async-first, type-safe, composable command structure.
- Keep all file, network, storage, and crypto operations async.
- Implement commands as reusable modules with shared output, config, room-token, and API-client utilities.
- Use the strategy pattern for branching workflows such as suggestion versus direct patch mode.
- Format human output with clear text, Unicode status symbols such as `✓`, `✗`, `→`, and `⚠`, and color that respects `NO_COLOR`.
- Do not use emoji in CLI output by default.

Proposed commands:

```bash
mdroom publish file.md
mdroom patch file.md --room <url-or-token>
mdroom comment --room <url-or-token> --text "..."
mdroom export --room <url-or-token>
mdroom status --room <url-or-token>
```

CLI requirements:

- Print useful human output by default.
- Support `--json` on every command from day one with documented, stable response schemas for agent workflows.
- Store room metadata project-locally by default in `.mdroom/` so an agent can retrieve the current room token without repeated prompting.
- Keep the metadata format explicit and portable, for example `.mdroom/rooms.json`, while ensuring generated files are easy to add to `.gitignore`.
- Accept an explicit room URL or token for stateless automation.
- Store encrypted-room access tokens locally only when the user or agent opts into local metadata for that room.
- Never send the room key to the server.

## Agent Edit Modes

Rooms support an edit-mode policy:

- `suggestions`: agent patches appear as reviewable diffs or suggested changes that humans accept or reject.
- `direct`: trusted agents can patch the live collaborative document immediately.

Default room mode should be `suggestions`.

Suggested changes are modeled separately from Yjs document sync. The agent can submit proposed Markdown or structured patches, and the client renders them as encrypted review items before applying accepted changes to the live document.

The first patch format should be whole-document Markdown replacement plus a generated diff for review. `mdroom patch file.md` should submit a reviewable suggestion by default; trusted direct edits require an explicit room policy and CLI intent such as `--direct`. Structured AST patches or editor-native transaction proposals can come later if whole-document diffs feel too blunt.

## OSS and Deployment

The repo should become a monorepo with:

- Web app
- Sync server
- CLI package
- Shared encryption and Markdown utilities

Deployment goals:

- One-command local development.
- Docker Compose for self-hosting.
- Clear deployment notes for simple public hosting.
- Minimal required services for the first version.

Dependency policy:

- Prefer MIT, Apache-2.0, BSD, and similarly permissive licenses.
- Treat MPL-2.0, GPL, AGPL, commercial, or source-available packages as explicit approval items, not default dependencies.
- Do not copy source from other repos without explicit license review and attribution.
- Borrow patterns and interaction ideas freely, but keep source-code borrowing deliberate.

## Hard Technical Risks

- True E2EE plus Yjs persistence may require a custom sync/persistence design, because ordinary collaboration servers often expect readable update semantics.
- Inline comment anchoring can break under collaborative edits unless anchors use robust positions such as block IDs, Yjs relative positions, or a tested hybrid.
- Markdown import/export may not preserve every detail of agent-generated files, especially when rich editing abstractions differ from raw Markdown.
- Suggested changes are a separate review system, not a built-in property of CRDT sync.

## First Implementation Milestones

1. Complete the E2EE plus Yjs persistence spike. Current result: `viable_with_constraints` for a custom encrypted append-log provider.
2. Extend the spike with durable disk/database persistence, append-log replay after server restart, update compaction strategy, and encrypted awareness/presence assumptions. Current result: minimal file-backed replay is proven; production durability, compaction, and awareness assumptions remain open.
3. Decide the canonical document representation.
4. Create the Milkdown versus BlockNote editor prototype comparison.
5. Pick the editor based on Markdown fidelity, UX, license fit, and implementation complexity.
6. Implement encrypted single-room document creation and loading.
7. Add WebSocket-based Yjs sync and encrypted or non-sensitive presence.
8. Add CLI publish and export.
9. Validate inline comment anchoring with collaborative edits.
10. Add agent patch suggestions using whole-document Markdown diffs.
11. Add direct agent patch mode.
12. Add named versions.
13. Add Docker Compose and self-hosting docs.

## Test Plan

- Verify import/export fidelity on realistic agent Markdown files.
- Verify two-browser real-time editing and presence.
- Verify comments stay anchored after nearby edits.
- Verify encrypted persistence by confirming the server cannot read document body, comments, or patch content.
- Verify the E2EE append-log provider with `npm run spike:e2ee`, `npm test`, and `npm run typecheck`.
- Verify joining clients receive backlog over WebSocket without missing records created before subscription completes.
- Verify the chosen canonical document model preserves acceptable Markdown export quality.
- Verify CLI publish, patch, comment, export, status, and `--json` output.
- Verify suggestion mode never overwrites human edits without acceptance.
- Verify Docker Compose works from a clean checkout.

## Open Questions

- How much Markdown extension support is required on day one: Mermaid, math, footnotes, embeds, and generated tables of contents may each carry separate editor complexity.
- Should comments attach to exact text ranges, block IDs, or both?
- Should CLI comments initially be document-level only, or support anchors such as `--line 42` and `--heading "Plan"` in v1?
- Should the first hosted demo use a simple ephemeral server or persistent storage from the start?
