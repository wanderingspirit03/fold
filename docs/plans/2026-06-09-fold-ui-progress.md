# Fold UI Progress Tracker

This tracks the current Obsidian-inspired Fold web UI work on `feat/agent-studio-room-ui`.

## Direction

Fold should feel like a calm encrypted Markdown project workspace:

- project-first file navigation
- Markdown read/edit surface at the center
- inline comments and file-level review affordances
- lightweight review/proposal overlays
- live encrypted room records for comments, suggestions, project files, and future presence
- midnight-blue accents on dark layered chrome
- no heavy permanent review rail, dashboard framing, badge soup, or AI-styled decoration

Primary reference: `DESIGN.md`.

## Done

- Renamed the visible product language toward Fold and removed vault wording.
- Added dark-first layered studio tokens with midnight-blue accent and light theme support.
- Added Fold logo assets in the app chrome and browser tab.
- Built a project file sidebar with folder expand/collapse, recent files, search, create, and import.
- Hid legacy seeded/mock folders and routine `synced` badges so the file tree reads like a real project.
- Kept raw Markdown canonical while rendering read mode with sanitized `react-markdown`.
- Embedded frontmatter/properties as metadata inside the document/editor surface instead of rendering them as body text.
- Kept edit mode as Markdown source only; removed extra rich/source controls.
- Added inline selected-text comment composer and clickable inline comment markers.
- Added a lightweight selection anchor so selecting text first shows a compact comment action before opening the full composer.
- Made inline comment markers persistently visible as soft document annotations.
- Added encrypted comment resolve/reopen events with resolved notes hidden behind a compact review-drawer section.
- Simplified comments to one comment type.
- Made file-level comment controls flow above properties so they do not overlap metadata.
- Added compact file-level review counts in the toolbar for comments and pending suggestions.
- Added a quiet document-surface pending suggestion control so review work is discoverable from the Markdown page itself.
- Made pending inline suggestion anchors persistently visible with a soft midnight-blue document mark.
- Added a compact dot and stronger underline cue to pending inline suggestion anchors.
- Tuned bright-theme annotation fills so comments and suggestions stay discoverable without louder chrome.
- Added a dedicated `midnight-mark` token for soft annotation fills instead of stacking opacity modifiers on alpha tokens.
- Moved review/proposals into a lightweight drawer instead of a permanent heavy rail.
- Flattened the review drawer scope header so it reads as editor chrome instead of a nested summary card.
- Flattened suggestion rows so review items read more like compact document annotations than PR cards.
- Tightened suggestion rows further and sorted pending suggestions first in the review drawer.
- Added command palette / quick switcher and made the header filename open it.
- Grouped command palette results into create/files/actions with active-file and review-count metadata.
- Improved quick-switcher search ranking with path-aware and simple fuzzy file matching for larger projects.
- Added quiet saved/checkpoint timestamps to file chrome, sidebar rows, and quick-switch metadata.
- Simplified the blank Markdown document state and added a direct edit affordance.
- Fixed blank project files so an intentionally empty Markdown file does not fall back to missing-file copy.
- Removed duplicate root-file path text from the top file header and command palette while preserving full-path search.
- Added agent connection handoff in the top chrome and removed the large onboarding block.
- Fixed random/repeated frontmatter key log noise by using stable React keys.
- Verified recent UI slices with Playwright screenshots on desktop and mobile because `iab` is unavailable in this session.
- Continue verifying substantial slices with a separate reviewer/subagent before pushing.

## In Progress

- Keep reducing visible text and secondary chrome while preserving accessible labels/tooltips.
- Keep checking whether the command palette feels like an Obsidian-style quick switcher under larger project file sets.
- Continue checking mobile widths for overlap and horizontal scroll.
- Keep collaboration objects streaming through the encrypted room pipeline; avoid designs that depend on manual refresh or static server-readable fetches.

## Next

- Keep proposal/review drawer controls compact while testing action clarity on mobile.
- Keep tuning inline annotation contrast across dark and bright themes without making the document feel marked up.
- Make future multi-user presence and typing/editing states stream from encrypted room/awareness data without revealing document content to the server.
- Expand saved/checkpoint affordances into named versions when the product needs explicit restore points.
- Keep empty states sparse and document-native as more project creation/import states are added.
- Continue measuring long-document readability against the Obsidian reference screenshots.
- Eventually replace the textarea editor candidate with the planned Milkdown prototype after Markdown round-trip verification.

## Verification Baseline

Run before reporting a UI slice complete:

```bash
npm test
npm run typecheck
npm run web:build
npm run spike:e2ee
npm run spike:document-model
npm run spike:document-model:report
```

Visual verification should include at least:

- desktop room workspace
- mobile/narrow room workspace
- drawer or popover touched by the change
- console/page error capture
- horizontal overflow check on mobile
