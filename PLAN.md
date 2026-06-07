# Agent MD Rooms Plan

## Summary

Build an OSS, self-hostable collaboration platform for `.md` files created by humans and agents. The first product should feel like an Excalidraw-style private room plus a Notion-leaning Markdown workspace: instant encrypted sharing links, polished reading and editing, distinct human and agent personas, reviewable agent changes, inline comments, agent-friendly CLI workflows, and durable Markdown export.

The core collaboration unit is one Markdown document in a room. A lightweight personal workspace helps each user find their rooms, agents, pending reviews, and recent Markdown artifacts. Heavy team workspaces, full agent-run archives, billing, and enterprise account systems are intentionally deferred.

## Product Goals

- Let any human or autonomous agent turn a Markdown file into a private collaborative room with one command or upload.
- Let humans read, edit, comment, and resolve threads in a polished web UI.
- Let agents submit follow-up edits, review comments, and change explanations through the CLI or future webhooks.
- Keep Markdown portable: users can always export the current accepted document as raw `.md`.
- Make self-hosting easy enough for OSS users to deploy without heavy infrastructure.
- Make human and agent participation legible: who changed what, why they changed it, and what still needs review.

## Core User Experience

- A room URL looks like `/room/:roomId#key=...`.
- The room key lives in the URL fragment or a local CLI token and is never sent to the server.
- The document opens in a beautiful read mode, with a clear switch into edit mode.
- Editing is rich and Markdown-backed, not a raw textarea by default.
- Inline comments attach to selected text or document blocks.
- Comments support replies, presence, and resolved state.
- Named versions capture important checkpoints such as initial publish, accepted agent patches, and manual saves.
- Each room has recognizable human and agent personas, so collaborators are visually distinct and agent actions do not appear as anonymous writes.
- Agent changes appear like lightweight commits: a title, summary/comment, diff, status, discussion thread, and resulting version if accepted.
- A personal workspace shows recent rooms, rooms shared with the user, rooms created by agents, pending suggestions, unresolved comments, and archived rooms.

## Personal Workspace and Personas

The product should feel like a lightweight personal Markdown workspace, not a heavy enterprise suite. Users get a home base for rooms and agent collaborators, while individual rooms remain share-link-first.

Workspace views:

- `Recent rooms`: rooms the user created, opened, or edited recently.
- `Shared with me`: rooms opened from share links and optionally saved locally.
- `Created by agents`: rooms published by autonomous agents or agent workflows.
- `Needs review`: rooms with pending suggestions, unresolved comments, or explicit decision requests.
- `Archive`: rooms the user wants out of the active workspace.

Room cards should show the document title, short Markdown preview, privacy/sharing mode, pending suggestions, unresolved comments, latest accepted version, and the last active human or agent persona.

### Human and Agent Personas

Humans and agents should be first-class participants. Every participant gets a display name, avatar/color, and presence identity. Agents are clearly marked as agents and can include role metadata such as `Research Agent`, `Copy Editor`, `Implementation Agent`, or `QA Agent`.

Agent identities should be distinct, memorable, and a little funny by default, similar to platforms that assign random playful names. Avoid making every agent feel like a generic bot. Examples:

- `Patch Goblin` — proposes mechanical doc fixes and cleanup patches.
- `Captain Diffbeard` — submits larger change sets with detailed explanations.
- `Markdown Ferret` — finds broken links, formatting issues, and stale sections.
- `Professor Breadcrumbs` — leaves context notes and decision trails.
- `Lint Gremlin` — nitpicks tables, headings, task lists, and frontmatter.
- `Source Raccoon` — asks for citations and flags unsupported claims.
- `Tiny Scribe` — writes concise summaries and changelog notes.
- `Diagram Badger` — comments on Mermaid, architecture, and visual explanations.
- `Release Pixie` — turns plans into launch/release checklists.
- `Uncertainty Otter` — marks low-confidence claims and open questions.

Persona rules:

- Agent personas must be visibly different from humans, for example with a bot badge, hexagon avatar, or `Agent` label.
- The UI should distinguish autonomous agents from human-triggered agents, for example `autonomous` vs `run by Nick`.
- Users can rename personas, but random defaults should make rooms feel alive immediately.
- The default tone should be charming but restrained; funny names should not make serious review workflows feel unserious.
- Persona data is room metadata and should follow the E2EE model where it reveals sensitive role or project context.

### Room Persona and Mood

Rooms can also have lightweight generated identities based on the Markdown artifact type, such as `Launch War Room`, `Research Library`, `Design Critique Studio`, `Bug Autopsy Room`, or `Campaign Draft Room`. This can drive iconography, accent color, and empty-state copy without changing the document model.

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

The first technical spike proved the basic Yjs encryption shape for a single Markdown text document: all document semantics remain client-side, and the sync server persists opaque encrypted Yjs payloads without inspecting Markdown, comments, or patch content. It also validates WebSocket backlog replay for joining clients, AES-GCM authentication of client-known metadata, client-side sequence validation for delivered records, and basic file-backed restart/replay. This does not yet prove production-grade durability, compaction, awareness encryption, editor integration, comments, suggestions, or named versions.

## Collaboration Model

Use Yjs as the real-time collaboration layer.

- Use Yjs for document state, presence, cursors, and conflict-free collaborative edits.
- Use a custom WebSocket sync provider for strict E2EE v1.
- Start from an encrypted append-log model: clients encrypt Yjs updates locally, the server stores and broadcasts opaque `{ roomId, seq, senderId, nonce, ciphertext }` records, and fresh clients replay the encrypted log after local decryption.
- Subscribe over WebSocket before replaying backlog. The server sends encrypted backlog records over the newly subscribed socket, then streams live records, avoiding the race where updates can land between HTTP history load and WebSocket subscription.
- Treat `roomId`, `seq`, and `senderId` as routing metadata, not private document content. Client-known metadata is bound to ciphertext with AES-GCM additional authenticated data; server-assigned sequence integrity, drop detection, and replay protection remain future protocol work.
- Validate delivered records client-side with contiguous sequence checks. This catches delivered gaps, duplicates/replays, and reordered records, but does not yet prove the server has not truncated a suffix, forked history, or withheld all future records.
- Do not start v1 with normal Hocuspocus persistence, because server-side `Y.Doc` or state-vector persistence conflicts with strict server-unreadability. Hocuspocus can be reconsidered only as a non-decrypting transport layer or for a weaker private-link model.
- Avoid `y-webrtc` as the default provider because self-hosted persistence and deployment should be predictable.

Important caveat: Yjs solves real-time synchronization, not review workflows by itself. Inline comments, anchors, suggestions, accept/reject flows, and named versions need explicit product and data modeling.

V1 canonical document representation is raw Markdown text in `Y.Text`.

Editor-native structures may be used as UI helpers, but they must not become the durable source of truth unless they prove lossless Markdown fidelity for agent-authored files. The document-model comparison spike showed that Markdown-canonical preserves sample files byte-for-byte, while plain `prosemirror-markdown` loses frontmatter, task-list syntax, and pipe table structure.

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

Default recommendation after verification: keep Markdown-canonical as the durable v1 model. Explore Milkdown/ProseMirror as an editing surface only if it can operate as a helper over raw Markdown or prove lossless fidelity for required Markdown features.

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
mdroom patch file.md --room <url-or-token> --agent "Captain Diffbeard" --title "Tighten positioning" --comment "I made the opening sharper and added a concrete ICP section."
mdroom comment --room <url-or-token> --text "..."
mdroom export --room <url-or-token>
mdroom status --room <url-or-token>
mdroom agent create --name "Patch Goblin" --role "Copy Editor"
mdroom context --room <url-or-token>
```

CLI requirements:

- Print useful human output by default.
- Support `--json` on every command from day one with documented, stable response schemas for agent workflows.
- Store room metadata project-locally by default in `.mdroom/` so an agent can retrieve the current room token without repeated prompting.
- Keep the metadata format explicit and portable, for example `.mdroom/rooms.json`, while ensuring generated files are easy to add to `.gitignore`.
- Accept an explicit room URL or token for stateless automation.
- Store encrypted-room access tokens locally only when the user or agent opts into local metadata for that room.
- Never send the room key to the server.
- Support agent identity flags on agent-originated commands, such as `--agent`, `--agent-role`, or locally configured default agent personas.
- Support patch metadata flags from day one: `--title`, `--comment`, and `--json` fields that make the patch reviewable like a commit.

## Agent Edit Modes

Rooms support an edit-mode policy:

- `suggestions`: agent patches appear as reviewable diffs or suggested changes that humans accept or reject.
- `direct`: trusted agents can patch the live collaborative document immediately.

Default room mode should be `suggestions`.

Suggested changes are modeled separately from Yjs document sync. The agent can submit proposed Markdown or structured patches, and the client renders them as encrypted review items before applying accepted changes to the live document.

The first patch format should be whole-document Markdown replacement plus a generated diff for review. `mdroom patch file.md` should submit a reviewable suggestion by default; trusted direct edits require an explicit room policy and CLI intent such as `--direct`. Structured AST patches or editor-native transaction proposals can come later if whole-document diffs feel too blunt.

### Agent Change Objects

Agent changes should be modeled as explicit encrypted room objects, separate from accepted Yjs document sync. Each agent change should behave like a lightweight commit/review request.

Required fields:

- `id`: stable patch/change identifier.
- `authorPersonaId`: human or agent persona that created the change.
- `authorKind`: `human`, `agent`, or `autonomous_agent`.
- `title`: short human-readable change title.
- `comment`: agent or human explanation of why the change exists.
- `baseVersionId`: accepted document version the change was prepared against.
- `proposedMarkdown`: whole-document Markdown replacement for v1.
- `diff`: generated display diff from base Markdown to proposed Markdown.
- `status`: `pending`, `accepted`, `rejected`, or `superseded`.
- `createdAt` and `updatedAt`.
- `discussionThreadIds`: comments attached to the change.

Review behavior:

- Default agent patches create pending suggestions, never silent overwrites.
- Accepting a change applies the proposed Markdown to the canonical document and creates a named version.
- Rejecting a change preserves the discussion and marks the suggestion rejected.
- `Accept with edits` should eventually let a human modify the proposed Markdown before creating the accepted version.
- Direct mode remains explicit and should still create a timeline event with the agent's change comment.

### Agent Comments and Review Notes

Agents must be able to comment independently of document changes. Comments can be document-level in v1 and anchored later.

Comment types:

- `note`: general explanation or context.
- `question`: asks a human to decide something.
- `blocker`: marks something that should not ship unresolved.
- `suggestion`: proposes a local improvement without submitting a full patch.
- `source_needed`: flags unsupported claims.
- `uncertainty`: marks a low-confidence area.
- `decision`: records a human or agent decision.

Agent self-comments are encouraged on every patch. If a CLI patch omits `--comment`, the CLI can prompt interactively for humans or accept an explicit `--comment ""` in non-interactive automation.

Future browser interactions can support `@agent` summons, such as `@copy-editor make this less corporate` or `@research-agent verify these claims`, with agents replying as suggestions rather than direct mutations by default.

### Agent Handoff Context

Rooms should eventually provide a clean context packet for another agent:

```bash
mdroom context --room <url-or-token>
```

The context packet should include the accepted Markdown, room instructions, unresolved comments, pending suggestions, accepted/rejected patch summaries, open decisions, and any safe persona metadata needed for continuation. This makes the room useful as an agent-to-agent handoff layer without scraping chat history.

### Room Instructions

Each room may include visible or hidden instructions for agents, such as `Keep edits concise`, `Preserve Markdown tables`, `Do not alter frontmatter`, or `Marketing tone: sharp, not hypey`. These instructions should be part of encrypted room state.

## Review, Timeline, and Versions

The room should make collaboration legible through explicit review surfaces.

Review mode should show pending agent suggestions, unresolved comments, confidence/uncertainty flags, human decisions needed, and accept/reject controls.

The room timeline records meaningful events:

- Room created from a Markdown file.
- Human joined or saved the room locally.
- Agent persona created or connected.
- Agent suggested changes.
- Human commented, resolved, accepted, rejected, or edited a suggestion.
- Direct edit applied.
- Version created.
- Markdown exported.

Named versions should be human-readable, such as `Initial agent draft`, `After Sarah review`, `Accepted research pass`, `Final launch copy`, or `Pre-meeting version`. Accepting an agent patch should create a version named from the patch title by default.

Export should support both the current accepted Markdown and an optional room bundle:

```text
document.md
comments.json
versions/
patches/
timeline.json
personas.json
```

All non-public bundle contents must respect the room encryption model.

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
- Current sequence hardening is detection-only for delivered records. Stronger malicious-server protection still needs a client-authenticated envelope, hash chain, signed checkpoints, or comparable protocol design.

## Phased Roadmap

### Phase 1: Server Ergonomics

Make the encrypted append-log server easy to run locally.

- Add a proper server entrypoint such as `npm run server -- --port 8787 --data ./data`.
- Use file-backed encrypted append-log persistence by default.
- Print clear server startup and shutdown messages.
- Support graceful shutdown.
- Document the local publish, patch, status, and export flow.

Goal: no one should need a one-off `tsx -e` command to start the server.

### Phase 2: Self-Hosting

Make deployment boring for OSS users.

- Add a Dockerfile for the sync server.
- Add `docker-compose.yml` with a persistent append-log volume.
- Add a health check endpoint.
- Document Docker, VPS, and simple hosted deployment paths.
- Keep required infrastructure minimal.

Goal: a self-hoster can run the encrypted sync server in minutes.

### Phase 3: Web Room Viewer

Build the first browser room experience.

- Open room URLs with `#key=...`.
- Fetch encrypted append-log records.
- Decrypt room content locally in the browser.
- Render Markdown in read mode.
- Show non-sensitive room status.
- Show room title, generated room mood/persona, participant personas, and agent badges when available.
- Support Markdown export/download.

Goal: humans can view what agents publish.

### Phase 4: Web Editing

Add collaborative editing for the accepted document.

- Connect to the encrypted WebSocket room stream.
- Edit Markdown-backed `Y.Text`.
- Encrypt outgoing Yjs updates locally.
- Preserve the Markdown-canonical source of truth.
- Add presence only if it is encrypted or explicitly non-sensitive.

Goal: humans can edit the accepted room document collaboratively.

### Phase 5: Patch Review UI

Make agent patch suggestions useful.

- List encrypted patch suggestions.
- Decrypt suggestions client-side.
- Show whole-document diffs.
- Show agent persona, patch title, patch comment, status, and discussion thread.
- Support accept and reject.
- Support timeline events for suggested, accepted, rejected, and superseded changes.
- Apply accepted patches as real document updates.
- Keep rejected or pending suggestions separate from accepted Markdown export.

Goal: agents can propose changes and humans can review them safely.

### Phase 6: Comments

Add review discussion around documents and patches.

- Start with encrypted document-level comments.
- Support agent comments and typed review notes such as question, blocker, source-needed, uncertainty, and decision.
- Add replies and resolved state.
- Later validate anchored comments using robust positions such as block IDs, Yjs relative positions, or a hybrid.
- Keep comment payloads unreadable to the server.

Goal: humans and agents can discuss the document without leaving the room.

### Phase 7: Versions

Add understandable checkpoints.

- Capture the initial publish.
- Capture accepted patch versions.
- Name accepted agent patch versions from the patch title and author persona.
- Support manual saved versions.
- Export any named version.
- Keep version metadata safe under the E2EE model.

Goal: room history becomes recoverable and explainable.

### Phase 8: Product Polish

Make the platform feel cohesive and reliable.

- Improve CLI errors, JSON schemas, and room metadata management.
- Improve personal workspace room cards, random persona naming, agent badges, and review-mode ergonomics.
- Add example agent workflows.
- Finish license and dependency audits.
- Improve onboarding docs.
- Split packages only when the repo shape needs it.

Goal: move from promising spike to usable OSS product.

## First Implementation Milestones

1. Complete the E2EE plus Yjs persistence spike. Current result: `viable_with_constraints` for a custom encrypted append-log provider.
2. Extend the spike with protocol and durability hardening. Current result: minimal file-backed replay, WebSocket backlog replay, AAD metadata authentication, same-client reconnect, and delivered-record sequence/replay detection are proven; production durability, compaction, awareness assumptions, hash chains, signed checkpoints, and fork/truncation detection remain open.
3. Use Markdown-canonical `Y.Text` as the v1 document representation.
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
- Verify delivered append-log sequence gaps, duplicates/replays, and reordered records are rejected.
- Verify the chosen canonical document model preserves acceptable Markdown export quality.
- Verify CLI publish, patch, comment, export, status, and `--json` output.
- Verify suggestion mode never overwrites human edits without acceptance.
- Verify Docker Compose works from a clean checkout.

## Open Questions

- How much Markdown extension support is required on day one: Mermaid, math, footnotes, embeds, and generated tables of contents may each carry separate editor complexity.
- Should comments attach to exact text ranges, block IDs, or both?
- Should CLI comments initially be document-level only, or support anchors such as `--line 42` and `--heading "Plan"` in v1?
- Should the first hosted demo use a simple ephemeral server or persistent storage from the start?
- How playful should random agent persona names be by default, and should serious teams be able to switch to conservative naming?
- Which persona fields are safe as plaintext routing/display metadata, if any, versus encrypted room state?
- Should workspace membership be purely local/link-based in v1, or should users have optional lightweight accounts for syncing their room list across devices?
