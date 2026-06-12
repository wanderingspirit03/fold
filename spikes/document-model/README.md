# Document Model Comparison Spike

This spike compares source-of-truth and editor-surface models before the real
app chooses an editor architecture.

## Candidates

- Markdown canonical: raw Markdown text is the live document, represented as `Y.Text`.
- Editor canonical: structured editor state is the live document, represented here by ProseMirror Markdown parse/serialize as a non-UI proxy for Milkdown/ProseMirror.
- Milkdown candidate: Milkdown CommonMark plus GFM parse/serialize in a hidden
  jsdom harness, used to test the first planned polished editor candidate
  without replacing the product editor.
- Milkdown with Fold properties: the same Milkdown body parse/serialize path,
  but with frontmatter/properties kept outside the editor body and reattached,
  matching the current web edit-mode strategy.

## Decision Criteria

- Markdown import/export fidelity
- Agent CLI friendliness
- Comment anchoring potential
- E2EE payload simplicity
- Editor/UX potential
- Dependency and license risk

## Editor Canonical Result

`editor-canonical.ts` uses `prosemirror-markdown` as a non-UI proxy for a
Milkdown/ProseMirror-style source of truth. The current CommonMark parser is
good at preserving normal headings, paragraphs, inline code, links, images, and
language-tagged code fences, including Mermaid and math fences.

Known losses in the current sample set:

- YAML frontmatter is parsed as ordinary Markdown and does not survive as a
  leading metadata block.
- GFM task-list markers are escaped as text, not preserved as task items.
- Pipe tables flatten into paragraph text instead of table structure.
- The long agent handoff sample repeats those losses in a more realistic report
  shape, so a polished Milkdown/ProseMirror editor still needs explicit
  GFM/frontmatter handling or a hybrid Markdown snapshot strategy.

This means editor-canonical remains promising for rich editing, but it needs
explicit GFM/frontmatter extensions or a hybrid Markdown snapshot strategy
before it is safe as the v1 canonical model for agent-authored `.md` files.

## Milkdown Candidate Result

`milkdown-canonical.ts` initializes Milkdown with CommonMark and GFM in a
hidden jsdom harness. This is closer to the planned editor stack than the plain
`prosemirror-markdown` proxy.

Current results:

- GFM task-list Markdown syntax survives, but list markers are
  normalized from `-` to `*`.
- Pipe tables survive as table Markdown, but spacing and separator rows are
  normalized.
- Code fences, Mermaid fences, math fences, inline math, links, images, and
  inline code survive in the current sample set.
- YAML frontmatter still does not survive as a leading metadata block.
- No fixture currently round-trips byte-for-byte through Milkdown.
- When Fold properties are wrapped around the Milkdown body, frontmatter is
  preserved and no required feature is lost in the current sample set.
- Task lists and tables are preserved as Milkdown/ProseMirror structures in the
  current sample set: task items keep checked/unchecked attrs, and tables keep
  table/header/body-row/cell nodes.
- The properties-wrapped path still does not round-trip byte-for-byte because
  Milkdown normalizes list markers, table spacing, and other Markdown source
  formatting.
- The comparison report now classifies Milkdown source rewrites. In the current
  fixture set, the Fold-properties path categorizes all byte changes as
  task-list marker style, table formatting, or blank-line spacing. Those are
  categorized, not accepted: blank-line changes in particular still need review
  because Markdown can treat spacing as meaningful. The raw Milkdown path still
  has frontmatter-loss churn that remains in the `other` bucket because
  frontmatter is parsed as document content rather than preserved metadata.

This means Milkdown remains a stronger editing-surface candidate than the plain
ProseMirror proxy. Fold's existing properties strategy removes the frontmatter
blocker for the current body-editing flow, but not for native editable
frontmatter. The candidate still fails the current replacement gate for Fold's
source editor because source formatting normalization remains unresolved. The
next editor spike needs a deliberate answer for whether those explained
normalizations are acceptable in review diffs before product integration.

## Markdown Canonical Result

`markdown-canonical.ts` treats the raw Markdown string as the source of truth.
The live document is represented as `Y.Text`, and the sample set round-trips
byte-for-byte. Frontmatter, task-list markers, pipe tables, Mermaid/math fences,
inline math, links, images, code fences, and long agent handoff reports remain
exactly as agents wrote them.

The tradeoff is that rich editor behavior, comments, suggestions, and block
anchors must be layered on top of text/Yjs semantics instead of coming from a
structured editor document.

This model is strongest for agent CLI workflows, E2EE payload simplicity, and
portable Markdown export. It still needs a separate answer for rich editor UX,
inline comment anchors, and suggestion/review semantics.

## Decision

For v1, use Markdown-canonical as the durable source of truth.

Editor-native structures may still help the UI, comments, or block interactions,
but they should remain derived/helper state unless a richer stack proves
lossless fidelity for required Markdown features. Plain `prosemirror-markdown`
is not enough by itself for agent-authored Markdown, and Milkdown CommonMark plus
GFM is not enough yet because byte-level formatting fidelity still fails.
