# Design Audit Evidence

`npm run web:smoke:design` is the current verification gate for the
Obsidian-inspired Fold UI direction in `DESIGN.md`.

The smoke now captures current Fold screenshots and writes two audit artifacts
into the same temporary screenshot directory:

- `design-audit.json`
- `design-audit.md`

The audit records:

- the `DESIGN.md` source being verified
- the Obsidian reference pack directory
- required Obsidian reference screenshot presence and byte sizes
- current Fold screenshot paths for launcher, desktop room, mobile document, and mobile drawer
- the layout and interaction gates asserted by the smoke

The checked assertions intentionally stay structural rather than pixel-identical:
Fold should borrow Obsidian's file-first calm workspace feel without copying its
brand or exact UI. The strongest evidence is the combination of:

- current screenshots from the smoke run
- the required Obsidian reference screenshots in `/tmp/agent-md-obsidian-reference`
- automated checks for file-first navigation, compact editor chrome,
  document-first mobile layout, inline rendered Mermaid, encrypted-content-derived
  project title, and no horizontal overflow

Refresh the public reference pack when it is missing or stale:

```bash
npm run web:reference:capture
```

Run the audit after UI changes:

```bash
FOLD_WEB_URL=http://localhost:3001 npm run web:smoke:design
```

Recent collaboration coverage:

- Edit-mode source selections can create inline comment threads that re-open in read mode.
- Edit-mode cursor-only comments store encrypted insertion-point anchors with nearby Markdown context and appear as minimal file threads.
- Proposal previews now include encrypted discussion replies, keeping suggestions conversational without changing exported Markdown.
- Human invites now copy a browser join handoff with the encrypted link, key-fragment warning, sync server, and local reachability guidance.
- Selected text can now become an encrypted agent request from the command palette and re-open as an inline request thread.
