# Milkdown Package Audit

Audit date: 2026-06-12.

This checks the current package shape before Fold installs or prototypes Milkdown in the web app.

## Current App Compatibility

The web app already matches the planned platform baseline:

- Next.js `^16.2.7`
- React `^19.2.7`
- TypeScript `^5.7.2`
- Tailwind CSS `^4.3.0`
- Radix/shadcn-compatible component structure in `apps/web/components.json`

No setup migration is required before a hidden editor prototype.

The hidden Node/Vitest fidelity harness also uses `jsdom` plus `@types/jsdom`
as dev-only dependencies because Milkdown initializes browser editor-view and
timer APIs even when the test only needs parser/serializer contexts.

## Registry Findings

Current npm metadata shows Milkdown `7.21.2` across the evaluated package family. The evaluated Milkdown packages are MIT licensed.

Core fidelity-harness candidates:

| Package | Current version | License | Notes |
| --- | ---: | --- | --- |
| `@milkdown/core` | `7.21.2` | MIT | Pulls `remark-parse`, `remark-stringify`, `unified`, and Milkdown transformer/prose packages. |
| `@milkdown/prose` | `7.21.2` | MIT | Pulls ProseMirror packages including model, state, view, history, tables, commands, and transforms. |
| `@milkdown/preset-commonmark` | `7.21.2` | MIT | CommonMark baseline. |
| `@milkdown/preset-gfm` | `7.21.2` | MIT | Adds GFM path and depends on `remark-gfm`; required for task lists and tables. |
| `@milkdown/plugin-listener` | `7.21.2` | MIT | Useful for import/export and change observation. |
| `@milkdown/plugin-history` | `7.21.2` | MIT | Undo/redo behavior. |
| `@milkdown/plugin-clipboard` | `7.21.2` | MIT | Clipboard behavior. |
| `@milkdown/plugin-cursor` | `7.21.2` | MIT | Cursor/drop affordances. |
| `@milkdown/plugin-prism` | `7.21.2` | MIT | Uses `refractor`; optional because the app read renderer already uses Shiki. |
| `@milkdown/transformer` | `7.21.2` | MIT | Directly relevant to Markdown import/export checks. |
| `@milkdown/utils` | `7.21.2` | MIT | Helper package used by plugins/presets. |

Dev-only harness support:

| Package | Current version | License | Notes |
| --- | ---: | --- | --- |
| `jsdom` | `^29.1.1` | MIT | Provides browser globals for the hidden Node/Vitest Milkdown harness. |
| `@types/jsdom` | `^28.0.3` | MIT | Type declarations for the harness. |

React and UI wrapper candidates:

| Package | Current version | License | Notes |
| --- | ---: | --- | --- |
| `@milkdown/react` | `7.21.2` | MIT | Peer deps are `react: *` and `react-dom: *`, so React 19 is not blocked by package metadata. It currently depends on `@milkdown/crepe` and `@milkdown/kit`, which makes it heavier than the smallest fidelity harness path. |
| `@milkdown/kit` | `7.21.2` | MIT | Bundles many Milkdown plugins, including block, slash, streaming, tooltip, upload, GFM, and commonmark. Useful later, but too broad for the first fidelity proof. |
| `@milkdown/crepe` | `7.21.2` | MIT | Pulls CodeMirror packages, DOMPurify, KaTeX, `remark-math`, `prosemirror-virtual-cursor`, and `vue`. Treat as a later UX candidate, not the first fidelity harness dependency. |

Collaboration candidates to postpone:

| Package | Current version | License | Notes |
| --- | ---: | --- | --- |
| `@milkdown/plugin-collab` | `7.21.2` | MIT | Requires `y-prosemirror`, `y-protocols`, and `yjs`. Do not add until single-user Markdown fidelity passes. |
| `y-prosemirror` | `1.3.7` | MIT | Peer deps include ProseMirror model/state/view, `y-protocols`, and `yjs`. |
| `y-protocols` | `1.0.7` | MIT | Peer dependency on `yjs`. |

## Recommendation

Start with a hidden fidelity harness using the smallest non-React package set:

```bash
npm install \
  @milkdown/core \
  @milkdown/prose \
  @milkdown/preset-commonmark \
  @milkdown/preset-gfm \
  @milkdown/plugin-listener \
  @milkdown/plugin-history \
  @milkdown/plugin-clipboard \
  @milkdown/plugin-cursor \
  @milkdown/transformer \
  @milkdown/utils \
  --workspace=apps/web
```

Hold these packages until later:

- `@milkdown/react`
- `@milkdown/kit`
- `@milkdown/crepe`
- `@milkdown/plugin-prism`
- `@milkdown/plugin-collab`
- `y-prosemirror`
- `y-protocols`

This keeps the first prototype focused on the risky question: can Milkdown import and export Fold's required Markdown fixtures without loss?

## Risks To Recheck During Install

- `@milkdown/react` currently pulls Crepe and Kit, so a React prototype may bring more editor chrome than Fold wants.
- Crepe is more Notion-like, but its dependency surface is wider and may push the UI toward toolbar/block-editor behavior.
- GFM handling must be proven with task lists and pipe tables, not assumed from package names.
- Frontmatter support is still unproven by this audit; the fidelity harness must test it directly.
- The first hidden harness proved frontmatter is still lost with CommonMark plus GFM, even though task-list Markdown syntax and table Markdown survive.
- Wrapping Fold properties around the Milkdown editor body preserves frontmatter in the current sample set and matches the web app's current edit-mode strategy.
- Milkdown normalizes Markdown formatting, so exact byte-for-byte export still fails on the current fixture set.
- Collaboration packages must not become the document source of truth or leak plaintext through server-side state.

## Sources Checked

- `npm view @milkdown/core version license peerDependencies dependencies --json`
- `npm view @milkdown/react version license peerDependencies dependencies --json`
- `npm view @milkdown/preset-commonmark version license peerDependencies dependencies --json`
- `npm view @milkdown/preset-gfm version license peerDependencies dependencies --json`
- `npm view @milkdown/prose version license peerDependencies dependencies --json`
- `npm view @milkdown/plugin-listener version license peerDependencies dependencies --json`
- `npm view @milkdown/plugin-history version license peerDependencies dependencies --json`
- `npm view @milkdown/plugin-clipboard version license peerDependencies dependencies --json`
- `npm view @milkdown/plugin-cursor version license peerDependencies dependencies --json`
- `npm view @milkdown/plugin-prism version license peerDependencies dependencies --json`
- `npm view @milkdown/kit version license peerDependencies dependencies --json`
- `npm view @milkdown/crepe version license peerDependencies dependencies --json`
- `npm view @milkdown/plugin-collab version license peerDependencies dependencies --json`
- `npm view y-prosemirror version license peerDependencies dependencies --json`
- `npm view y-protocols version license peerDependencies dependencies --json`
- `npm view jsdom version license peerDependencies dependencies --json`
- `npm view @types/jsdom version license --json`
