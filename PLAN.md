# Fold Plan

## Summary

Build an OSS, self-hostable collaboration platform for `.md` files created by humans and agents. The first product should feel like a private encrypted Markdown project room: instant share links, polished reading and editing, distinct human and agent personas, reviewable agent changes, inline comments, agent-friendly CLI workflows, and durable Markdown export.

The core collaboration unit is a Markdown project room: one or more Markdown files addressed by project-relative paths. A lightweight personal workspace helps each user find their rooms, agents, pending reviews, and recent Markdown artifacts. Heavy team workspaces, full agent-run archives, billing, and enterprise account systems are intentionally deferred.

## Product Goals

- Let any human or autonomous agent turn a Markdown file or small Markdown project tree into a private collaborative room with one command or upload.
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

Agent identities should be distinct, memorable, and slightly playful by default, similar to platforms that assign random names. Avoid making every agent feel like a generic bot, but keep the names calm enough for a focused collaboration tool. Examples:

- `Patch Pilot` — proposes mechanical doc fixes and cleanup patches.
- `Diff Lantern` — explains larger change sets and highlights risk.
- `Merge Signal` — coordinates accepted suggestions and follow-up work.
- `Token Loom` — rewrites dense agent notes into clearer Markdown.
- `Branch Echo` — carries context across related project files.
- `Commit Atlas` — turns plans into release and checkpoint summaries.

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

This is deliberately a private-link trust model rather than classic account-gated document storage.

The first technical spike proved the basic Yjs encryption shape for a single Markdown text document: all document semantics remain client-side, and the sync server persists opaque encrypted Yjs payloads without inspecting Markdown, comments, or patch content. It also validates WebSocket backlog replay for joining clients, AES-GCM authentication of client-known metadata, client-side sequence validation for delivered records, and basic file-backed restart/replay. That spike alone did not prove production-grade durability, compaction, awareness encryption, editor integration, comments, suggestions, or named versions; later alpha implementation covers some collaboration surfaces, while the production hardening items remain open.

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

Important caveat: Yjs solves real-time synchronization, not review workflows by itself. The alpha now has early comments, proposal review, accept/reject, and file restore points, but robust inline anchoring, richer suggestion semantics, and production-grade version modeling still need explicit product and data modeling.

V1 canonical document representation is raw Markdown text in `Y.Text`.

Editor-native structures may be used as UI helpers, but they must not become the durable source of truth unless they prove lossless Markdown fidelity for agent-authored files. The document-model comparison spike showed that Markdown-canonical preserves sample files byte-for-byte, while plain `prosemirror-markdown` loses frontmatter, task-list syntax, and pipe table structure.

## Markdown Rendering and Editor Strategy

Lock the v1 web surface to a Markdown-canonical stack: raw Markdown remains the durable room document, read mode renders that Markdown directly, and edit mode uses a Markdown-native editor surface. Do not switch the v1 plan to a block-doc-first editor unless Markdown round-tripping evidence forces it.

### Locked read-mode renderer

Use `react-markdown` with the remark/rehype ecosystem for the default read-only Markdown renderer.

Required packages and roles:

- `react-markdown`: React renderer for Markdown AST to React components.
- `remark-gfm`: GitHub-flavored Markdown support for tables, task lists, strikethrough, autolinks, and footnotes.
- `remark-math`: Parse inline and block math syntax.
- `rehype-katex`: Render parsed math with KaTeX.
- `katex`: Math CSS/assets for `rehype-katex`.
- `rehype-raw`: Allow controlled embedded HTML only if the room policy permits it; keep disabled by default for untrusted rooms.
- `rehype-sanitize`: Sanitize any raw HTML path before rendering.
- `shiki`: Syntax highlighting engine for code fences.
- `rehype-pretty-code`: Bridge Shiki into rehype-rendered code blocks.

Read-mode defaults:

- Enable GFM by default.
- Enable math rendering when the document contains math syntax.
- Render Mermaid fences as explicit diagram placeholders first; add live Mermaid rendering only behind a sanitized/isolated component.
- Never render unsanitized raw HTML from shared rooms.
- Use custom React components for links, images, code blocks, tables, task lists, headings, and proposal/comment anchors.
- Preserve Markdown portability: renderer enhancements must not require custom Markdown syntax for ordinary documents.

### Deferred rich edit-mode evaluation

Current implementation note: edit mode is source-only Markdown. Do not add a nested rich/source toggle inside edit mode while the room-level Read/Edit switch is the active interaction model.

Milkdown remains the deferred v1 polished Markdown editor candidate, and BlockNote should stay out of the first-line prototype path unless Markdown round-tripping evidence forces a plan change.

Milkdown rationale:

- MIT licensed.
- Markdown-native enough for the product direction.
- ProseMirror-based, giving a serious extension model for comments, selections, and future suggestions.
- Better aligned with durable `.md` export than block-doc-first editors.

Milkdown packages to evaluate/install for the web app:

- `@milkdown/core`
- `@milkdown/react`
- `@milkdown/preset-commonmark`
- `@milkdown/preset-gfm`
- `@milkdown/plugin-listener`
- `@milkdown/plugin-history`
- `@milkdown/plugin-clipboard`
- `@milkdown/plugin-cursor`
- `@milkdown/plugin-prism` or a Shiki-compatible code highlighting integration if preferred
- `@milkdown/prose`
- Yjs/ProseMirror bridge packages only after the single-user Markdown round-trip prototype passes

The Milkdown prototype must run on the same real agent-generated Markdown examples:

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

Default recommendation after verification: keep Markdown-canonical as the durable v1 model. Milkdown is the editing surface, not the source of truth, unless it proves lossless Markdown fidelity for required Markdown features.

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
fold publish file.md
fold patch file.md --room <url-or-token>
fold resume --room <url-or-token> --alias <name> --output ./fold-project-<name>
fold propose file.md --room <url-or-token> --title "Tighten positioning" --comment "I made the opening sharper and added a concrete ICP section."
fold proposals --room <url-or-token>
fold show-proposal <proposal-id> --room <url-or-token>
fold accept <proposal-id> --room <url-or-token>
fold reject <proposal-id> --room <url-or-token>
fold patch file.md --room <url-or-token> --summary "Tighten positioning"
fold comment --room <url-or-token> --text "..."
fold export --room <url-or-token>
fold status --room <url-or-token>
fold context --room <url-or-token>
```

Current proposal command behavior to preserve:

2. `fold propose file.md --room <url-or-token> --title "..." --comment "..."` submits `file.md` as an encrypted whole-document proposal against the current accepted Markdown. The CLI should create a pending proposal record, assign the proposer a room/system-generated persona, store the title/comment as review metadata, and leave the accepted document unchanged until a human accepts it.
3. `fold proposals --room <url-or-token>` lists decrypted proposal summaries for the room, including proposal id, status, title, and persona. Status should be derived by replaying encrypted room records, not by trusting mutable plaintext server-side state.

CLI requirements:

- Print useful human output by default.
- Support `--json` on every command from day one with documented, stable response schemas for agent workflows.
- Store room profiles project-locally by default in `.fold/` so an agent can retrieve the current room key by alias without repeated prompting.
- Keep the metadata format explicit and portable, for example `.fold/rooms.json`, while ensuring generated files are easy to add to `.gitignore`.
- Accept an explicit room URL or token for stateless automation.
- Store encrypted-room access tokens locally only when the user or agent opts into local metadata for that room.
- Never send the room key to the server.
- Assign visible agent personas by room/system logic from stable participant fingerprints. Agents should not self-declare their visible room persona through user-facing CLI flags.
- Support patch metadata flags from day one: `--title`, `--comment`, and `--json` fields that make the patch reviewable like a commit.
- Support `fold resume` as the fresh-agent entry point: import secret room access into an alias, export accepted Markdown, print a redacted context packet, list open requests/comments/proposals, and provide next commands without echoing room tokens or `#key` fragments.

## Agent Edit Modes

Rooms support an edit-mode policy:

- `suggestions`: agent patches appear as reviewable diffs or suggested changes that humans accept or reject.
- `direct`: trusted agents can patch the live collaborative document immediately.

Default room mode should be `suggestions`.

Suggested changes are modeled separately from Yjs document sync. The agent can submit proposed Markdown or structured patches, and the client renders them as encrypted review items before applying accepted changes to the live document.

The first patch format should be whole-document Markdown replacement plus a generated diff for review. `fold patch file.md` should submit a reviewable suggestion by default; trusted direct edits require an explicit room policy and CLI intent such as `--direct`. Structured AST patches or editor-native transaction proposals can come later if whole-document diffs feel too blunt.

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
fold context --room <url-or-token>
```

The context packet should include the accepted Markdown, room instructions, unresolved comments, pending suggestions, accepted/rejected patch summaries, open decisions, and any safe persona metadata needed for continuation. This makes the room useful as an agent-to-agent handoff layer without scraping chat history.

### Room Access and Project CLI

The product-facing CLI name is `fold`. Keep the CLI lean by reusing the same verbs for single files and project directories:

```bash
fold publish <file-or-directory> --alias <name>
fold room add <room-url-or-token> --alias <name>
fold room invite <name> --for human|agent
fold status --room <name> --json
fold export --room <name> [--path docs/PLAN.md] --output <file-or-directory>
fold propose <file-or-directory> --room <name> [--path docs/PLAN.md] --title "..." --comment "..."
```

Room profiles store `appUrl`, `syncUrl`, `roomId`, and client-side key material. `appUrl` is the browser/web app origin; `syncUrl` is the append-log HTTP/WebSocket origin. They may be identical on Railway or a reverse-proxied deployment, but they can differ for local development and self-hosting. Invites should warn when either URL appears local-only, such as `localhost`, `127.0.0.1`, or private LAN addresses.

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

### Deployment Contract

Fold's hosted alpha should be cloud-agnostic: any provider can run it if the
provider satisfies Fold's contract instead of Fold depending on provider-specific
runtime behavior.

- Run one long-lived Node process that binds to `0.0.0.0` and reads `PORT`.
- Serve the web app, HTTP append-log API, and WebSocket sync from one same-origin
  process by default.
- Set `FOLD_PUBLIC_URL` to the public HTTPS origin that humans and agents open
  for shared hosted rooms.
- Set `FOLD_DATA_DIR` to persistent storage for encrypted append-log records.
- Keep the current file append-log deployment to a single instance; horizontal
  scaling requires a different durability/write-safety design.
- Expose `/health` for provider health checks and deployment smoke tests.
- Treat split web/sync hosting as an advanced path using
  `FOLD_PUBLIC_APP_URL`, `FOLD_PUBLIC_SYNC_URL`, and
  `NEXT_PUBLIC_FOLD_SYNC_URL`.

This contract makes Railway, Render, Fly.io, VPS, Docker, and similar platforms
recipes over the same runtime. It does not make Fold production-complete:
account auth, append authorization, multi-writer durability, fork/truncation
proofs, compaction, key rotation, and revocation remain future hardening work.

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

Status note: this roadmap mixes completed alpha work with planned hardening. `Done` means the repo has an alpha implementation; `Partial` means a usable path exists but the product or protocol is not mature; `Planned` means the section is still mostly future direction.

### Phase 1: Server Ergonomics (Done)

Make the encrypted append-log server easy to run locally.

- Add a proper server entrypoint such as `npm run server -- --port 8787 --data ./data`.
- Use file-backed encrypted append-log persistence by default.
- Print clear server startup and shutdown messages.
- Support graceful shutdown.
- Document the local publish, patch, status, and export flow.

Goal: no one should need a one-off `tsx -e` command to start the server.

### Phase 2: Self-Hosting (Partial)

Make deployment boring for OSS users.

- Add a Dockerfile for the sync server.
- Add `docker-compose.yml` with a persistent append-log volume.
- Add a health check endpoint.
- Document Docker, VPS, and simple hosted deployment paths.
- Keep required infrastructure minimal.

Goal: a self-hoster can run the encrypted sync server in minutes.

### Phase 3: Web Room Viewer (Done)

Build the first browser room experience.

- Open room URLs with `#key=...`.
- Fetch encrypted append-log records.
- Decrypt room content locally in the browser.
- Render Markdown in read mode.
- Show non-sensitive room status.
- Show room title, generated room mood/persona, participant personas, and agent badges when available.
- Support Markdown export/download.

Goal: humans can view what agents publish.

### Phase 4: Web Editing (Partial)

Add collaborative editing for the accepted document.

- Connect to the encrypted WebSocket room stream.
- Edit Markdown-backed `Y.Text`.
- Encrypt outgoing Yjs updates locally.
- Preserve the Markdown-canonical source of truth.
- Add presence only if it is encrypted or explicitly non-sensitive.

Goal: humans can edit the accepted room document collaboratively.

### Phase 5: Patch Review UI (Partial)

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

### Phase 6: Comments (Partial)

Add review discussion around documents and patches.

- Start with encrypted document-level comments.
- Support agent comments and typed review notes such as question, blocker, source-needed, uncertainty, and decision.
- Add replies and resolved state.
- Later validate anchored comments using robust positions such as block IDs, Yjs relative positions, or a hybrid.
- Keep comment payloads unreadable to the server.

Goal: humans and agents can discuss the document without leaving the room.

### Phase 7: Versions (Partial)

Add understandable checkpoints.

- Capture the initial publish.
- Capture accepted patch versions.
- Name accepted agent patch versions from the patch title and author persona.
- Support manual saved versions.
- Export any named version.
- Keep version metadata safe under the E2EE model.

Goal: room history becomes recoverable and explainable.

### Phase 8: Product Polish (Planned)

Make the platform feel cohesive and reliable.

- Improve CLI errors, JSON schemas, and room metadata management.
- Improve personal workspace room cards, random persona naming, agent badges, and review-mode ergonomics.
- Add example agent workflows.
- Finish license and dependency audits.
- Improve onboarding docs.
- Split packages only when the repo shape needs it.

Goal: move from promising spike to usable OSS product.

## First Implementation Milestones

Status note: these are historical milestones, kept so future agents understand how the alpha got here.

1. Done: complete the E2EE plus Yjs persistence spike. Current result: `viable_with_constraints` for a custom encrypted append-log provider.
2. Partial: extend the spike with protocol and durability hardening. Current result: minimal file-backed replay, WebSocket backlog replay, AAD metadata authentication, same-client reconnect, and delivered-record sequence/replay detection are proven; production durability, compaction, awareness assumptions, hash chains, signed checkpoints, and fork/truncation detection remain open.
3. Done: use Markdown-canonical `Y.Text` as the v1 document representation.
4. Deferred: create the Milkdown versus BlockNote editor prototype comparison.
5. Deferred: pick the rich editor based on Markdown fidelity, UX, license fit, and implementation complexity.
6. Done: implement encrypted single-room document creation and loading.
7. Partial: add WebSocket-based Yjs sync and encrypted or non-sensitive presence. Presence is encrypted and ephemeral; deeper awareness hardening remains open.
8. Done: add CLI publish and export.
9. Planned: validate robust inline comment anchoring with collaborative edits.
10. Done: add agent proposal suggestions using whole-document or whole-project Markdown diffs.
11. Planned: add direct trusted-agent patch mode.
12. Partial: add file restore points and version-like checkpoints; richer named-version export remains open.
13. Done: add Docker Compose and self-hosting docs.

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
