# Shadcn Space Room UI Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Redesign the current Agent MD Rooms web room into a quiet encrypted Markdown studio using existing shadcn/Radix primitives plus selective Shadcn Space components.

**Architecture:** Keep the current Markdown-canonical/E2EE room behavior intact. Refactor the monolithic room page into domain-named UI components, use Shadcn Space only as a copy/paste/registry source for interaction primitives and variants, and preserve a project-specific visual system instead of adopting generic templates wholesale.

**Tech Stack:** Next.js App Router, React 18, Tailwind CSS, shadcn/Radix primitives, Shadcn Space registry components, react-markdown, Yjs, WebCrypto.

---

## Taste Brief

**Product category:** encrypted collaborative Markdown editor/review room for humans and AI agents.

**Primary object:** a portable Markdown document, with encrypted anchored conversations and review artifacts around it.

**Emotional contract:** calm, private, legible, laptop-night studio; agents can help, but the document remains the center.

**Reference set:**

- Notion: document rhythm, low-chrome editing, calm whitespace.
- Google Docs comments: highlighted text becomes a contextual thread with resolve/reopen behavior.
- Notion comments: cursor-position comments and selected-text comments, including “add something here” insertion anchors.
- Figma comments: pinned spatial comments as a metaphor for document-margin anchors.
- GitHub PR review: keep explicit accept/reject and diff/review semantics as the underlying safety model, not the dominant UI metaphor.
- Linear: dense tasteful rails, compact status language, disciplined hierarchy.
- Excalidraw: private room/link mental model, lightweight share-first collaboration.
- Raycast: command palette as primary action surface.

**Non-goals:** marketing homepage, generic SaaS dashboard, AI assistant chatbot shell, purple/glowing AI visuals, component-gallery look.

**Signature components:**

- `RoomShell`
- `SecurityStrip`
- `DocumentSurface`
- `AgentBench`
- `MarginThread`
- `SelectionAnchor`
- `ProposalSlip`
- `RoomTimeline`
- `PersonaChip`
- `CommandMenu`

**Forbidden AI tells:** Lucide icon spam, badge soup, nested cards, decorative gradients, fake glassmorphism, equal-weight tabs everywhere, generic “AI magic” panels.

---

## Collaboration Model: Comment-first, Proposal-backed

The room should feel less like writing PRs and more like writing in the margins of a living document.

**Default user verb:** select text, place the cursor, or click a document margin spot, then write a comment/request/suggestion.

**Core principle:** proposals are safety payloads inside anchored threads. They remain useful for encryption, auditability, accept/reject, and agent submissions, but the main human-facing object is the contextual thread.

Reference behaviors:

- **Google Docs:** highlight text → comment thread → reply/resolve/reopen.
- **Notion:** cursor-position comments and selected text comments; selected text can become a thread, while an empty cursor location can mean “add something here.”
- **Figma:** pinned comments attached to a precise region; translate this into margin pins and block/range anchors in Markdown.
- **Liveblocks / Tiptap / BlockNote:** useful implementation references for threads, selections, presence, and editor-integrated comments.

Anchor types to support in the product model:

1. **Text range anchor** — comment on selected Markdown/rendered text, e.g. “tighten this paragraph.”
2. **Insertion point anchor** — cursor between paragraphs or on an empty line, e.g. “add examples here.”
3. **Block anchor** — paragraph, heading, list item, code block, or table, e.g. “this section needs evidence.”
4. **Whole-document anchor** — general room-level review, summary, or agent status.

Thread types:

- **Comment:** plain discussion attached to an anchor.
- **Request:** asks a human or agent to do something at the anchor.
- **Suggestion:** includes a proposed replacement/insertion payload with `Accept`, `Edit before accepting`, `Reject`, and `Ask again` actions.
- **Agent reply:** an agent response inside the same thread, not a separate chatbot panel.

Technical notes for Markdown/E2EE:

- Do not rely only on fragile absolute character offsets.
- Store encrypted anchor metadata with selected quote, nearby before/after context, block/heading context, and editor-relative/Yjs-relative positions where available.
- If the anchor drifts after edits, show a calm re-anchor state rather than silently attaching to the wrong text.
- Keep accepted Markdown as the canonical exported artifact; comments, suggestions, and statuses remain encrypted room records around it.

---

## Shadcn Space Usage Policy

Use Shadcn Space as a source of stronger shadcn-compatible variants, not as a full visual identity.

Preferred uses:

- Button variants that feel more refined than defaults.
- Compact segmented controls/tabs.
- Empty-state blocks.
- Sidebar/rail/panel primitives.
- Command/menu/dropdown variants.
- Small status/pill variants if they reduce badge soup.

Avoid:

- Marketing blocks.
- Full dashboard templates.
- Hero sections.
- Any component with heavy gradients, loud shadows, or unrelated decorative motion.

Before adding a Shadcn Space component, inspect the generated code and dependency list. Prefer components with MIT-compatible dependencies already present in the app. Keep copied components under `apps/web/components/ui/` or `apps/web/components/room/` depending on whether they are generic or product-specific.

---

## Current Slop Diagnosis

From `apps/web/app/room/[roomId]/page.tsx` and `UI.md`:

- The product shape is right: document center + right review rail.
- The implementation is too monolithic: one 800+ line page mixes sync, crypto, domain state, and UI rendering.
- The rail currently feels like generic app tabs: `Proposals`, `Comments`, `Timeline`, `People`.
- Proposal cards are generic bordered cards, not review slips or commit-like objects.
- Header status uses common badge/icon language instead of calm security language.
- The document surface is a white card in a white app; it should feel more like a paper artifact on a warm desk.
- Personas are visible but not yet conceptually strong.
- The existing app is missing `components.json`, so Shadcn CLI/registry usage may need setup before Shadcn Space commands work.

---

## Phase 0: Setup and Dependency Audit

### Task 1: Verify shadcn CLI compatibility

**Objective:** Ensure Shadcn Space registry commands can be run without damaging existing components.

**Files:**

- Inspect: `apps/web/package.json`
- Inspect: `apps/web/tailwind.config.js`
- Inspect: `apps/web/components/ui/*`
- Possibly create: `apps/web/components.json`

**Steps:**

1. Run from repo root:

```bash
npm install
```

2. Check whether shadcn config exists:

```bash
test -f apps/web/components.json && echo exists || echo missing
```

3. If missing, create a minimal `apps/web/components.json` compatible with existing aliases and Tailwind setup. Do not run a destructive init without checking generated diff.

4. Verify no existing UI files were overwritten:

```bash
git diff -- apps/web/components.json apps/web/components/ui
```

**Expected:** shadcn registry commands can target `apps/web` without rewriting current primitives unexpectedly.

### Task 2: Select exact Shadcn Space components

**Objective:** Pick only the Shadcn Space pieces needed for the room UI.

**Files:**

- No code changes unless installing selected components.

**Steps:**

1. Browse https://shadcnspace.com/components and https://shadcnspace.com/blocks.
2. Shortlist components for:
   - refined button variant
   - compact tabs/segmented control
   - empty state
   - sidebar/rail panel
   - command/menu if available
3. For each candidate, record:
   - registry command
   - source URL
   - dependencies
   - why it fits the Taste Brief
   - what to delete or restyle

**Expected:** 3–5 components max. No full template imports.

---

## Phase 1: Design Tokens and Room Shell

### Task 3: Encode room design tokens

**Objective:** Make the room stop looking like default white shadcn.

**Files:**

- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/tailwind.config.js` if tokens are missing
- Modify: `UI.md` or create `DESIGN.md` if needed

**Design direction:**

- App background: warm paper/studio tone, not pure white.
- Document paper: near-white with restrained shadow.
- Rail: either warm bone or dark ink bench; test both, prefer the one with better hierarchy.
- Accent: cyan/network-blue sparingly for selected/review state.
- Status: text-first semantic colors, not colorful badge soup.

**Verification:** run web app, capture screenshot, confirm document and rail separate clearly without gradients.

### Task 4: Extract `RoomShell`

**Objective:** Move page-level layout/header/columns into a domain component.

**Files:**

- Create: `apps/web/components/room/RoomShell.tsx`
- Modify: `apps/web/app/room/[roomId]/page.tsx`

**Component API sketch:**

```tsx
interface RoomShellProps {
  roomId: string;
  connected: boolean;
  ready: boolean;
  recordCount: number;
  pendingCount: number;
  personaName?: string;
  onBack: () => void;
  onExport: () => void;
  mode: "read" | "edit";
  onModeChange: (mode: "read" | "edit") => void;
  document: React.ReactNode;
  bench: React.ReactNode;
  error?: string | null;
}
```

**Verification:** behavior unchanged; page file gets shorter; UI still renders.

### Task 5: Add `SecurityStrip`

**Objective:** Replace generic connection/status badges with clear encrypted-room language.

**Files:**

- Create: `apps/web/components/room/SecurityStrip.tsx`
- Modify: `RoomShell.tsx`

**Copy direction:**

- Connected and synced: `server blind · local key · 12 sealed records`
- Connecting: `syncing encrypted records…`
- Offline: `offline · local document visible`
- Error: show current `syncError` below header with concise text.

**Verification:** status is understandable without icons.

---

## Phase 2: Document Surface

### Task 6: Extract `DocumentSurface`

**Objective:** Make the Markdown document feel like the primary artifact.

**Files:**

- Create: `apps/web/components/room/DocumentSurface.tsx`
- Modify: `page.tsx`

**Component API sketch:**

```tsx
interface DocumentSurfaceProps {
  markdown: string;
  mode: "read" | "edit";
  onMarkdownChange: (value: string) => void;
}
```

**Design requirements:**

- Read mode: paper surface, strong prose rhythm, no nested-card feeling.
- Empty state: product-specific copy: `No Markdown yet. Agent drafts and human edits will land here as encrypted room content.`
- Edit mode: keep current `MarkdownTextareaEditor` until Milkdown/Crepe fidelity work is ready.
- Add a tiny meta row: `MARKDOWN STAGE` / `portable .md` / `export-safe`.

**Verification:** Markdown rendering unchanged; empty document state improved.

### Task 7: Improve Markdown prose styling

**Objective:** Make rendered documents feel editorial and readable.

**Files:**

- Modify: `apps/web/components/MarkdownRenderer.tsx`
- Modify: `apps/web/app/globals.css` if needed

**Requirements:**

- Better heading spacing and weight.
- Tables readable without dashboard chrome.
- Code blocks feel like document code, not cards inside cards.
- Links and task lists remain clear.
- No unsafe raw HTML behavior changes.

**Verification:** render sample markdown with headings, tables, task lists, code fences, math, and long agent report.

---

## Phase 3: Margin Threads and Agent Bench

### Task 8: Replace rail tabs with `MarginThreads` and `AgentBench`

**Objective:** Turn the right side into a document-margin collaboration rail rather than generic tabs or a PR inbox.

**Files:**

- Create: `apps/web/components/room/AgentBench.tsx`
- Create: `apps/web/components/room/MarginThread.tsx`
- Create: `apps/web/components/room/SelectionAnchor.tsx`
- Create: `apps/web/components/room/ProposalSlip.tsx`
- Create: `apps/web/components/room/PersonaChip.tsx`
- Modify: `page.tsx`

**Behavior:**

- Keep existing tab/filter state initially if needed, but reduce visual prominence.
- Default view should prioritize open anchored threads, not pending proposal cards.
- A proposal appears inside a thread as a suggested replacement/insertion payload.
- Timeline and people become lower-priority sections or compact filters.
- Resolved threads are accessible but not visually dominant.

**Visual copy:**

- Header: `Margin Threads`
- Subline: `3 open anchors · 1 suggested edit`
- Empty thread copy: `Select text or place your cursor to start a private thread.`
- Empty proposal copy: `No suggested edits yet. Agents can attach replacements or insertions to a thread.`

**Verification:** comments, proposals, timeline, personas still accessible; proposal accept/reject still works from inside the thread detail.

### Task 9: Add selected-text and insertion-point comment affordances

**Objective:** Make collaboration start from the document, not the right rail.

**Files:**

- Modify: `apps/web/components/room/DocumentSurface.tsx`
- Create or modify: `apps/web/components/room/SelectionAnchor.tsx`
- Modify: `page.tsx`

**Requirements:**

- In read mode, selecting rendered text reveals a small quiet action: `Comment` / `Ask agent` / `Suggest edit`.
- In edit mode, cursor position or selected textarea text can start an insertion-point or text-range thread, even if the first implementation stores a coarse anchor.
- Clicking an anchored highlight/pin opens the matching `MarginThread` in the rail.
- Empty line / between-section affordance copy: `Add note here` or `Ask agent to add here`.
- Do not break native text selection; commenting affordances must not hijack basic copy/paste behavior.

**Verification:** user can select text, create a draft anchored thread, reopen it from the margin rail, and still copy text normally.

### Task 10: Make proposals feel like suggested edits inside threads

**Objective:** Improve proposal cards by making them feel like suggested edits attached to a comment/request, without changing the proposal data model yet.

**Files:**

- Modify: `ProposalSlip.tsx`
- Modify: proposal dialog or future inline detail component

**Requirements:**

- Show persona bead/name/kind.
- Show proposal title and short comment.
- Show anchor preview when present: selected quote, insertion point, block heading, or whole-document.
- Show status text with muted styling.
- Primary actions: `Preview`, then `Accept`, `Edit before accepting`, `Reject`, and `Ask again` in detail state.
- Avoid large colorful badges.

**Verification:** clicking a proposal still opens proposal detail; accept/reject still works.

### Task 11: Replace proposal modal with stronger thread review detail

**Objective:** Make review feel like a contextual thread with an optional suggested edit, not a detached PR modal.

**Files:**

- Create: `apps/web/components/room/ProposalReviewDialog.tsx`
- Create or modify: `apps/web/components/room/ThreadReviewDialog.tsx`
- Modify: `page.tsx`

**Near-term:** keep dialog if needed, but structure it around anchor → conversation → suggested edit.

**Future-ready:** leave room for diff view once diff generation lands.

**Verification:** accept/reject still posts encrypted records and updates proposal status.

---

## Phase 4: Command Surface

### Task 12: Add command menu dependency/component

**Objective:** Make room actions accessible without adding more header buttons.

**Files:**

- Modify: `apps/web/package.json`
- Create or install: `apps/web/components/room/CommandMenu.tsx`
- Modify: `RoomShell.tsx`

**Preferred dependency:** `cmdk` unless Shadcn Space has a better compatible command variant.

**Commands:**

- Export Markdown
- Toggle Read/Edit
- Focus Agent Bench
- Copy room URL without leaking key unexpectedly: label carefully
- Show room security details
- Open pending proposal if one exists

**Verification:** keyboard shortcut works; actions call existing handlers; no key leaks in server requests.

---

## Phase 5: Screenshot QA and Polish

### Task 13: Add screenshot QA script

**Objective:** Make visual verification mandatory for UI claims.

**Files:**

- Create: `apps/web/scripts/screenshot-room.mjs` or `apps/web/tests/room-screenshot.spec.ts`
- Possibly modify: `apps/web/package.json`

**Requirements:**

- Start app or assume app URL.
- Navigate to a local room route with sample content when feasible.
- Capture desktop screenshot.
- Capture narrow/mobile screenshot.
- Save under `design/screenshots/` or `apps/web/test-results/`.

**Verification command:**

```bash
npm run web:build
npm run web:screenshot
```

### Task 14: Final visual critique pass

**Objective:** Judge actual pixels against the Taste Brief.

**Checklist:**

- Does the document clearly dominate?
- Does the collaboration model start from document selection/cursor anchors, not a PR inbox or chatbot/dashboard?
- Is security language understandable?
- Are there fewer generic badges/icons/cards?
- Are Shadcn Space imports restrained and consistent?
- Does mobile avoid rail chaos?

**Expected:** screenshot evidence attached before claiming completion.

---

## Implementation Notes

- Do not change encryption, sync, proposal, or comment data behavior while doing the first visual/refactor pass; introduce anchored thread persistence only in a separate model migration after UI assumptions are validated.
- Keep `page.tsx` as the stateful container initially; extract UI components first, then consider hooks.
- Do not introduce dark mode until the light/warm room is good.
- Do not import Shadcn Space blocks that include marketing copy or unrelated layout assumptions.
- If a registry component adds dependencies beyond Radix/Base UI/Motion/class utilities, review license and need before accepting.

---

## Verification Commands

From repo root:

```bash
npm install
npm run web:build
npm test
npm run typecheck
npm run spike:e2ee
npm run spike:document-model
npm run spike:document-model:report
```

If UI screenshot script is added:

```bash
npm run web:screenshot
```

---

## Ready-to-use Implementation Prompt

```text
Use ui-unsloppify. Implement the Shadcn Space Room UI plan in docs/plans/2026-06-08-shadcn-space-room-ui.md.

Constraints:
- Preserve Markdown-canonical and E2EE behavior.
- Use Shadcn Space selectively; do not import full templates.
- Keep product components domain-named.
- Produce screenshot proof before finalizing.
- Run build/typecheck/tests or explain blockers honestly.

Start with Phase 0 and Phase 1 only unless explicitly told to continue.
```
