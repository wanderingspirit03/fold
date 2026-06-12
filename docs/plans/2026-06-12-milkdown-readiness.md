# Milkdown Readiness Gate

This is the gate before Fold swaps the current source-only Markdown editor for a polished Milkdown editor surface.

## Current Decision

Raw Markdown remains the durable v1 document state.

- The room document stays Markdown-canonical in encrypted `Y.Text`.
- Read mode renders Markdown directly through the locked sanitized renderer stack.
- Edit mode stays source-only until a richer editor proves lossless import/export on real agent-authored files.
- The app must not add a nested Rich/Source toggle. The room-level Read/Edit switch is the mode boundary.
- Milkdown can be an editing surface, but it is not the source of truth unless it proves the required Markdown fidelity.

## What We Know

The document-model spike now includes a realistic long agent handoff report.

Markdown-canonical preserves every sample byte-for-byte:

- frontmatter
- task lists
- tables
- fenced code
- Mermaid fences
- math fences and inline math
- links and images
- inline code
- long agent reports

The current ProseMirror/CommonMark proxy still fails exact round-trip on the required sample set:

- YAML frontmatter becomes ordinary Markdown and does not survive as frontmatter.
- GFM task-list markers are escaped instead of preserved as task items.
- Pipe tables flatten into paragraph text.
- The long handoff sample repeats the same losses in a realistic project/report shape.

This does not disqualify Milkdown as an editor. It means a plain ProseMirror Markdown parse/serialize path is not enough for Fold's canonical document model.

The first hidden Milkdown CommonMark/GFM harness improved the result: task-list
Markdown syntax and table Markdown survive, and frontmatter survives if Fold
keeps properties outside the editor body and reattaches them afterward. The
candidate also preserves task-list checked/unchecked attrs and table row/cell
nodes in the current fixtures. It still fails exact byte-for-byte round-trip
because Milkdown normalizes Markdown source formatting.

The report now classifies those rewrites instead of treating them as one vague
diff. With Fold properties wrapped around the editor body, current fixture
changes are categorized as task-list marker style, pipe-table formatting, and
blank-line spacing. Categorized does not mean accepted: blank-line changes can
affect Markdown semantics, so they still need a product/editor decision before a
swap. Raw Milkdown still produces frontmatter-loss churn, which is why editable
frontmatter remains outside the first editor swap.

## Candidate Package Scope

Evaluate Milkdown as the first polished Markdown editor candidate with the package set already listed in `PLAN.md`:

- `@milkdown/core`
- `@milkdown/react`
- `@milkdown/preset-commonmark`
- `@milkdown/preset-gfm`
- `@milkdown/plugin-listener`
- `@milkdown/plugin-history`
- `@milkdown/plugin-clipboard`
- `@milkdown/plugin-cursor`
- `@milkdown/plugin-prism` or a Shiki-compatible code highlight bridge
- `@milkdown/prose`

Do not add Yjs/ProseMirror bridge packages until the single-user Markdown fidelity prototype passes.

## Prototype Acceptance Criteria

The Milkdown prototype must run the same fixture set used by `spikes/document-model` and report exact Markdown import/export results.

Minimum pass criteria before product UI integration:

- No loss of frontmatter via the Fold properties wrapper, task-list markers, pipe tables, code fence info strings, Mermaid fences, math fences, links, images, inline code, or long handoff formatting.
- Exported Markdown is byte-for-byte identical or every difference is deliberately accepted in this file and `PLAN.md`.
- Any accepted difference has a named normalization category in the
  document-model report and does not create noisy review diffs for agents or
  humans.
- Markdown remains the persisted encrypted room payload.
- Any editor state is derived/helper state and can be rebuilt from the Markdown string.
- Undo/redo, clipboard, selection, and indentation feel materially better than the current source textarea.
- No extra visible Rich/Source mode is introduced.
- Inline comment and suggestion anchors can be mapped back to Markdown text ranges without leaking content to the server.
- The prototype handles large agent reports without blocking typing or scrolling.

## UX Bar

Milkdown should earn its place by making Markdown editing feel calmer and more capable, not by making Fold look like a block editor.

The editor surface should keep the current product direction:

- Obsidian-like calm document surface
- source-faithful Markdown behavior
- minimal chrome
- clear focus and selection states
- no toolbar-heavy writing UI
- no badge soup around comments or proposals
- midnight-blue accent only where it helps interaction clarity
- bright and dark themes designed together

If Milkdown needs prominent formatting chrome, Fold should keep the source editor until a quieter configuration is proven.

## Implementation Phases

1. Package/API and license check
   - Verify current Milkdown packages and licenses before installing.
   - Confirm React 19 and Tailwind 4 compatibility in the web app.
   - Document any package that is not permissive OSS.

2. Hidden fidelity prototype
   - Build a non-product script or isolated harness that imports and exports every document-model fixture through Milkdown.
   - Compare output against the original Markdown.
   - Add the results to the document-model report.

3. Isolated editor route or fixture page
   - Render the long handoff sample in Milkdown without replacing the main editor.
   - Check dark and bright themes, keyboard behavior, selection, scroll performance, and mobile width.
   - Verify there is no nested Rich/Source control.

4. Collaboration mapping
   - Only after the single-user prototype passes, test how selections, comments, and suggestions map to Markdown text positions.
   - Keep encrypted room records as the collaboration source.
   - Add Yjs/ProseMirror bridge work only if it preserves the Markdown-canonical model.

5. Product swap decision
   - Replace the source textarea only if fidelity, UX, and collaboration mapping pass.
   - Otherwise keep source edit mode and continue improving it.

## Verification Commands

Run before calling this gate healthy:

```bash
npm test
npm run typecheck
npm run web:build
npm run spike:e2ee
npm run spike:document-model
npm run spike:document-model:report
git diff --check
```

Visual verification for the isolated editor route must include:

- desktop dark theme
- desktop bright theme
- mobile dark theme
- mobile bright theme
- long document scrolling
- table overflow
- code fence readability
- selection and inline comment affordances
- console/page error capture
