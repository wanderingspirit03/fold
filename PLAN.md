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

- The server stores encrypted document state and encrypted room payloads.
- The server must not need plaintext document body, comments, or agent patches.
- The client and CLI decrypt locally using the room key.
- Server-side global search, admin recovery, and plaintext analytics are out of scope.
- Losing the room key means losing access unless the user has exported or backed up the document.
- Link revocation is not available in the simple room-link model. Revocation would require rotating the room key and re-encrypting room state.

This is deliberately closer to Excalidraw-style trust than classic SaaS document storage.

The first technical spike must prove the exact Yjs encryption shape. The intended direction is that all document semantics remain client-side: the sync server persists opaque encrypted room payloads or encrypted update bundles and never inspects Markdown, comments, or patch content. If that cannot support reliable collaboration and persistence, the plan must explicitly choose between a weaker private-link model or a narrower E2EE feature set.

## Collaboration Model

Use Yjs as the real-time collaboration layer.

- Use Yjs for document state, presence, cursors, and conflict-free collaborative edits.
- Use a WebSocket sync provider for v1.
- Prefer Hocuspocus for a more production-shaped sync server; use `y-websocket` only if the first prototype needs maximum simplicity.
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

Create a CLI that is pleasant for humans and predictable for coding agents.

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
- Support `--json` for machine-readable agent workflows.
- Store room metadata locally so an agent can retrieve the current room token without repeated prompting.
- Accept an explicit room URL or token for stateless automation.
- Never send the room key to the server.

## Agent Edit Modes

Rooms support an edit-mode policy:

- `suggestions`: agent patches appear as reviewable diffs or suggested changes that humans accept or reject.
- `direct`: trusted agents can patch the live collaborative document immediately.

Default room mode should be `suggestions`.

Suggested changes are modeled separately from Yjs document sync. The agent can submit proposed Markdown or structured patches, and the client renders them as encrypted review items before applying accepted changes to the live document.

The first patch format should be whole-document Markdown replacement plus a generated diff for review. Structured AST patches or editor-native transaction proposals can come later if whole-document diffs feel too blunt.

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

1. Spike E2EE plus Yjs persistence and decide whether true E2EE is viable for v1.
2. Decide the canonical document representation.
3. Create the Milkdown versus BlockNote editor prototype comparison.
4. Pick the editor based on Markdown fidelity, UX, license fit, and implementation complexity.
5. Implement encrypted single-room document creation and loading.
6. Add WebSocket-based Yjs sync and presence.
7. Add CLI publish and export.
8. Validate inline comment anchoring with collaborative edits.
9. Add agent patch suggestions using whole-document Markdown diffs.
10. Add direct agent patch mode.
11. Add named versions.
12. Add Docker Compose and self-hosting docs.

## Test Plan

- Verify import/export fidelity on realistic agent Markdown files.
- Verify two-browser real-time editing and presence.
- Verify comments stay anchored after nearby edits.
- Verify encrypted persistence by confirming the server cannot read document body, comments, or patch content.
- Verify the chosen canonical document model preserves acceptable Markdown export quality.
- Verify CLI publish, patch, comment, export, status, and `--json` output.
- Verify suggestion mode never overwrites human edits without acceptance.
- Verify Docker Compose works from a clean checkout.

## Open Questions

- How much Markdown extension support is required on day one: Mermaid, math, footnotes, embeds, and generated tables of contents may each carry separate editor complexity.
- Should comments attach to exact text ranges, block IDs, or both?
- Should the CLI local metadata live in the project directory, user config directory, or both?
- Should the first hosted demo use a simple ephemeral server or persistent storage from the start?
