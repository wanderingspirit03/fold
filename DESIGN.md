# Fold Design Direction

## Decision

Move the web product toward a Fold-native collaborative project workspace for encrypted Markdown files.

The product should no longer feel like a single-document SaaS review room with a heavy side panel. It should feel like a calm Markdown workspace for a full project: users can browse many `.md` files, open one file, edit or read it, and collaborate directly inside the document with other humans and coding agents.

The durable product identity is Fold: E2EE project rooms, human-and-agent collaboration, agent-friendly Markdown workflows, reviewable suggestions, and portable exports.

## Product Shape

### Project, Not Just Room

Think in terms of an encrypted collaborative project.

- A project contains many Markdown files and folders.
- A user can open one file, but the workspace should make the whole project visible.
- The current file is selected from a project file tree.
- Collaboration, comments, suggestions, versions, and agent activity attach to files and project state.
- Humans and agents should both feel like first-class collaborators, with distinct identities and clear authorship.
- The single-file room remains a valid share target, but it is no longer the only mental model.

### Core Layout

Default desktop layout:

```text
left project files | center Markdown editor/reader | lightweight contextual overlays
```

The permanent right margin thread rail should not be the default. Collaboration appears when needed:

- selected-text comment popover
- inline comment marker
- compact thread bubble
- command palette
- small activity drawer
- file-level status button

Mobile layout:

- selected file first
- file tree as a drawer
- comments/actions as bottom sheets or anchored popovers
- no long secondary panel below the entire document unless explicitly opened

## UI Principles

### 1. The Markdown File Is The Product

The center surface should feel like opening and shaping a real `.md` file.

- Show the filename clearly.
- Prefer document-native editing/read affordances over dashboard controls.
- Keep Markdown export expectations obvious.
- Treat frontmatter/properties as document metadata, not as ugly rendered body text.

### 2. Project Navigation Comes First

Use a file tree as the main navigation pattern.

Expected V1 surfaces:

- project name
- folder tree
- selected file row
- recent files
- search or quick switcher
- create/import Markdown affordance
- room/project security status in compact chrome

### 3. Collaboration Is Inline

Default verb:

```text
select text -> type a comment/request -> see a small inline mark
```

Comments and agent requests should attach to the selected range, insertion point, block, or whole file. The UI should not force users to mentally jump from the document to a heavy side rail.

Thread types:

- comment
- request
- agent reply
- suggestion
- resolved note

Suggestion actions can still use proposal records under the hood:

- preview
- accept
- reject
- ask again
- edit before accepting

But the visible object should feel like a document annotation first, not a PR card first.

### 4. Quiet Power Tool, Not Dashboard

Avoid:

- big beige review rails
- badge soup
- nested cards
- generic AI panels
- marketing-style empty states
- full-width explanatory text inside the app
- decorative gradients or visual effects that do not help the workflow

Prefer:

- compact icon controls with tooltips
- subtle separators
- command palette
- tabs only when they are truly useful
- low-chrome panels
- dense but readable file lists
- status in a bottom bar or compact top strip

## Visual System

### Theme Direction

Start with dark-first or dark-capable styling using Fold's own quiet layered chrome:

- near-black app background
- slightly lighter sidebar panels
- subtle borders between panes
- midnight blue accent for selected state, links, comments, and primary action
- calm white or near-white document surface when reading long documents
- optional dark editor surface for users who prefer full dark mode

Light mode can exist, but it should still feel like a tool surface, not a bright SaaS dashboard.

### Suggested Tokens

Use semantic tokens in CSS/Tailwind rather than scattering raw hex values in components.

```text
app-bg: near-black shell
pane-bg: dark sidebar/editor chrome
pane-bg-raised: active tab/sidebar row
document-bg: readable paper surface
document-text: high-contrast body text
muted-text: secondary labels
hairline: subtle pane border
accent: restrained midnight blue
accent-soft: midnight blue selection/comment background
success/warning/danger: semantic only, not decorative
```

Approximate color direction:

```text
app-bg: #0d0d0f
pane-bg: #171719
pane-bg-raised: #242428
document-bg: #f7f5ef or #202124 depending theme
document-text: #f2f2f4 on dark, #242428 on light
muted-text: #a6a6ad
hairline: rgba(255,255,255,0.08) on dark, rgba(0,0,0,0.10) on light
accent: #1e3a8a
accent-soft: rgba(30,58,138,0.22)
accent-strong: #3b82f6
```

These are not final brand tokens. They are a starting point for browser verification.

### Typography

- Use the existing app sans stack or Geist/Inter-like system for UI.
- Use a comfortable Markdown reading width, roughly 68-78 characters.
- Body text should feel editor-native: calm line-height, no oversized hero typography inside the app.
- Mono text is reserved for code, room IDs, hashes, CLI commands, and Markdown source.

### Surface Rules

- The file sidebar is a pane, not a card.
- The document surface is the focus.
- Comments are inline marks or lightweight popovers.
- Activity/proposals are drawers or popovers by default.
- No card-inside-card UI.
- No permanent heavy collaboration rail unless the user opens a review drawer.

## Interaction Model

### Opening A Project

The user lands in a project workspace:

```text
Project name
File tree
Selected Markdown file
Read/Edit mode
Encrypted sync status
```

Possible first selected file order:

1. last opened file
2. `PLAN.md`
3. `README.md`
4. first Markdown file
5. project overview empty state

### Opening A File

The selected file opens in the center. File-level controls are compact:

- read/edit toggle
- share/export
- comments count
- suggestions count
- file status
- command palette

Edit mode should be a single Markdown source editor for now. Do not add another Rich/Source choice inside edit mode; the top-level Read/Edit switch is the mode boundary.

### Commenting

User flow:

```text
select text -> floating action appears -> comment/request/ask agent -> inline mark appears
```

If no text is selected, the user can place an insertion-point comment at the cursor or block.

Comment records should remain encrypted room/project payloads, separate from the exported Markdown body.

### Agent Suggestions

Agents should feel like collaborators in the document, not a separate chatbot.

- Agent suggestions appear at the relevant text/block when possible.
- Whole-file suggestions are allowed, but should still be opened from the file context.
- Accepting a suggestion mutates the canonical Markdown only after user approval unless project policy allows direct edits.
- The proposal object can remain whole-document replacement for V1 while the UI presents it as a file-level or range-level review item.

### Command Palette

The command palette should eventually support:

- open file
- search project
- create Markdown file
- export current file
- publish/share project
- add comment
- ask agent at selection
- show unresolved comments
- show pending suggestions
- switch read/edit/source mode

## Data And E2EE Notes

The UI direction must preserve the existing security model.

- Server must not read Markdown bodies, comments, proposals, personas, or timeline payloads.
- Project file tree metadata may reveal sensitive names if sent plaintext; prefer encrypted project index records.
- Routing metadata can remain plaintext only where the current spike already allows it.
- Inline comment anchors should be encrypted.
- Store anchors with selected quote, before/after context, block/heading context, and Yjs-relative/editor-relative positions where possible.
- If anchors drift after edits, show a re-anchor state rather than silently attaching to the wrong text.
- Exported Markdown should not include comment metadata unless the user explicitly chooses an annotated export format.

## Implementation Direction

V1 UI refactor target:

1. Replace the room-first shell with a collaborative project shell.
2. Add a left Markdown file tree using mocked or encrypted project-index data.
3. Keep the current selected document behavior working.
4. Remove the permanent margin thread rail as the default layout.
5. Add selected-text inline comment composer.
6. Move proposals/activity into a compact drawer or popover.
7. Add Fold-native dark layered tokens with midnight blue accents.
8. Treat frontmatter as properties metadata.
9. Verify with desktop and mobile screenshots against the reference pack.

Suggested component names:

- `ProjectShell`
- `ProjectFileSidebar`
- `FileTree`
- `MarkdownWorkspace`
- `DocumentHeader`
- `MarkdownEditorSurface`
- `InlineCommentMark`
- `SelectionCommentPopover`
- `ReviewDrawer`
- `ProjectStatusBar`
- `CommandPalette`

## Open Questions

1. Should V1 show a real folder tree from encrypted project metadata, or a simpler recent-file list?
2. Should the first selected file be last-opened, `PLAN.md`, `README.md`, or a project overview?
3. Should the default app theme be dark-first, light-first, or remember the user's system setting?
4. Should comments appear as margin bubbles, inline annotations, or a hybrid of both?
5. Should agents make one-file suggestions first, or should project-wide multi-file suggestions be visible in V1?
