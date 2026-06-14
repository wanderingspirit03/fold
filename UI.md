# Fold UI Direction

## Decision

Use a Markdown-canonical web stack that feels calm, fast, and document-native without making editor-owned block JSON the durable source of truth.

Recommended stack:

- App framework: Next.js App Router.
- UI shell: Tailwind CSS, shadcn/ui, and Radix primitives.
- Icons: lucide-react.
- Motion: Motion for React for subtle panel, menu, and command transitions only.
- Read mode: `react-markdown` with the remark/rehype stack documented in `PLAN.md`.
- Edit mode: source-only Markdown until Milkdown proves lossless import/export. Start the Milkdown work with core/preset fidelity checks; evaluate `@milkdown/crepe` later only if it stays quiet and source-faithful.
- Collaboration: Yjs plus the custom encrypted append-log provider.

## Rationale

The product goal is not just a nice rich editor. The product goal is a private room where agent-created Markdown remains portable, reviewable, encrypted, and exportable.

That means raw Markdown in `Y.Text("markdown")` remains the durable document model for v1. Editor-native structures may help the UI, but they should not become the canonical room state unless they prove lossless Markdown fidelity.

Block-doc-first tools can feel polished out of the box, but they create exactly the wrong risk for this product: lossy Markdown import/export. Milkdown is the better first candidate because it is Markdown-native, ProseMirror-based, and closer to the existing Markdown-canonical plan. Crepe may become a UX candidate later, but it should not be the first fidelity proof.

The UI primitive layer should provide a quiet polished application shell: dialogs, menus, command palette, tabs, side panels, tooltips, dropdowns, and accessible primitives. Fold's feel should come from its own composition, spacing, keyboard flow, and review ergonomics rather than from replacing the document model.

## First Web Room Shape

The first browser room should open at:

```text
/room/:roomId#key=...
```

The room key lives in the URL fragment and must never be sent to the server.

Initial web room behavior:

- Parse `roomId` from the route and room key from the URL fragment.
- Fetch encrypted append-log records from the sync server.
- Decrypt records locally in the browser.
- Render accepted Markdown in a polished read mode.
- Show non-sensitive room status.
- Show participant/persona metadata only after local decryption.
- Show lightweight review surfaces for encrypted proposals, comments, versions, and timeline events.
- Support Markdown export/download.
- Keep edit mode source-only until a hidden Milkdown fidelity prototype passes.

## Design Feel

Aim for a quiet, document-first collaboration surface:

- Large readable document canvas.
- Minimal chrome until review or editing tools are needed.
- Clear read/edit/review modes.
- Lightweight drawer or inline surfaces for proposals, timeline, comments, and agent context.
- Command palette for room actions.
- Small, legible agent badges and personas.
- Soft focus states and restrained motion.
- Dense enough for repeated work, but not a heavy enterprise dashboard.

Avoid:

- Marketing-style hero pages as the first app screen.
- Decorative gradients, oversized cards, or visual noise.
- UI cards inside other cards.
- Editor behavior that makes Markdown export surprising.
- Unsanitized raw HTML rendering.

## Required Fidelity Spike

Before replacing the source editor, run a small Milkdown fidelity spike against realistic agent-authored Markdown.

Must test:

- Frontmatter.
- Headings.
- Lists and task lists.
- Tables.
- Code fences.
- Mermaid fences.
- Math.
- Links and images.
- Long agent plans and reports.
- Import/export round-trip quality.
- Behavior when connected to Yjs document state.

If Milkdown loses required Markdown fidelity, keep it as an editing candidate only and revisit the editor integration before making it canonical. Evaluate Crepe after the core fidelity path is understood, not before.

## Security Notes

- Never render unsanitized raw HTML from shared rooms.
- Keep Mermaid rendering disabled or placeholder-only until an isolated/sanitized renderer is implemented.
- Keep document body, proposals, comments, personas, and timeline payloads encrypted room data.
- Treat `roomId`, `seq`, and `senderId` as plaintext routing metadata only.
- Keep WebSocket, WebCrypto, URL fragment parsing, and editor initialization inside client-only boundaries.

## Open UI Questions

- Should the first room viewer include proposal accept/reject controls, or only list proposals until the review UI is richer?
- Should the first comment model be document-level only, or should it include simple line/heading anchors?
- How much of the personal workspace should exist before the single-room experience feels solid?
- Should room mood/persona styling be generated from encrypted metadata, document type, or user choice?
