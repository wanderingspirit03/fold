# Document Model Comparison Spike

This spike compares two possible source-of-truth models before the real app chooses an editor architecture.

## Candidates

- Markdown canonical: raw Markdown text is the live document, represented as `Y.Text`.
- Editor canonical: structured editor state is the live document, represented here by ProseMirror Markdown parse/serialize as a non-UI proxy for Milkdown/ProseMirror.

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

This means editor-canonical remains promising for rich editing, but it needs
explicit GFM/frontmatter extensions or a hybrid Markdown snapshot strategy
before it is safe as the v1 canonical model for agent-authored `.md` files.

## Markdown Canonical Result

`markdown-canonical.ts` treats the raw Markdown string as the source of truth.
The live document is represented as `Y.Text`, and the sample set round-trips
byte-for-byte. Frontmatter, task-list markers, pipe tables, Mermaid/math fences,
inline math, links, images, and code fences remain exactly as agents wrote them.

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
is not enough by itself for agent-authored Markdown.
