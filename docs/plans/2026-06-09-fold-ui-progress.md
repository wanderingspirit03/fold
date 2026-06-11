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
- Made the mobile project file drawer focus the file filter on open for faster project navigation.
- Increased mobile project drawer create/import/search-clear tap targets while keeping desktop sidebar controls dense.
- Increased mobile project drawer file and folder row tap targets while preserving compact desktop row density.
- Improved sidebar file search with path-aware and simple fuzzy matching for larger projects.
- Hid legacy seeded/mock folders and routine `synced` badges so the file tree reads like a real project.
- Kept raw Markdown canonical while rendering read mode with sanitized `react-markdown`.
- Embedded frontmatter/properties as metadata inside the document/editor surface instead of rendering them as body text.
- Kept edit mode as Markdown source only; removed extra rich/source controls.
- Added inline selected-text comment composer and clickable inline comment markers.
- Added invisible mobile tap halos to inline annotation markers so comments/suggestions are easier to open without louder document styling.
- Added a lightweight selection anchor so selecting text first shows a compact comment action before opening the full composer.
- Increased mobile selection-anchor and inline composer action tap targets while preserving compact desktop sizing.
- Made inline comment markers persistently visible as soft document annotations.
- Added encrypted comment resolve/reopen events with resolved notes hidden behind a compact review-drawer section.
- Simplified comments to one comment type.
- Made file-level comment controls flow above properties so they do not overlap metadata.
- Added compact file-level review counts in the toolbar for comments and pending suggestions.
- Increased mobile document comment/review control tap targets while preserving compact desktop document chrome.
- Added a quiet document-surface pending suggestion control so review work is discoverable from the Markdown page itself.
- Made pending inline suggestion anchors persistently visible with a soft midnight-blue document mark.
- Added a compact dot and stronger underline cue to pending inline suggestion anchors.
- Added a compact review-drawer state for comments and suggestions whose saved text anchor no longer appears in the current Markdown.
- Made detached text anchors explicit in the review drawer with a quiet detached count and `Anchor needs review` state.
- Tuned bright-theme annotation fills so comments and suggestions stay discoverable without louder chrome.
- Added a dedicated `midnight-mark` token for soft annotation fills instead of stacking opacity modifiers on alpha tokens.
- Moved review/proposals into a lightweight drawer instead of a permanent heavy rail.
- Added encrypted named file versions in the review drawer with compact save and restore controls.
- Added Escape dismissal for lightweight project and review overlays.
- Flattened the review drawer scope header so it reads as editor chrome instead of a nested summary card.
- Flattened suggestion rows so review items read more like compact document annotations than PR cards.
- Enlarged/cropped collaborator avatars and kept E2EE as quiet inline file metadata instead of boxed toolbar chrome.
- Reduced top-toolbar chrome by changing Connect agent to an icon+tooltip action and removing the filled theme-toggle hover box.
- Split the mobile workspace header into file/context and document-action rows with 44px touch targets through tablet widths.
- Verified the long agent handoff report with a real encrypted file comment and named version, then adjusted mobile review sheet height for the two-row header.
- Tightened suggestion rows further and sorted pending suggestions first in the review drawer.
- Clarified pending suggestion actions with compact labeled pills and larger touch targets for mobile review.
- Added command palette / quick switcher and made the header filename open it.
- Grouped command palette results into create/files/actions with active-file and review-count metadata.
- Added a recent-file section to the empty quick switcher so project navigation starts from recently opened Markdown files.
- Expanded the seeded project with nested architecture, runbook, research, and notes files so navigation is exercised against a realistic project shape.
- Kept default command palette results focused on recent files and commands before the broader file list.
- Added the secure agent handoff to the command palette so agent collaboration is reachable from the project workflow.
- Matched the review command to unresolved comments so the palette finds the intended document-review workflow.
- Improved quick-switcher search ranking with path-aware and simple fuzzy file matching for larger projects.
- Added quiet saved/checkpoint timestamps to file chrome, sidebar rows, and quick-switch metadata.
- Simplified the blank Markdown document state and added a direct edit affordance.
- Fixed blank project files so an intentionally empty Markdown file does not fall back to missing-file copy.
- Made sidebar search-created files show their full target path without adding empty-state prose.
- Removed duplicate root-file path text from the top file header and command palette while preserving full-path search.
- Added agent connection handoff in the top chrome and removed the large onboarding block.
- Added a room-first CLI path so agents can create encrypted rooms without an existing Markdown file, then invite humans or agents.
- Made web-created starter projects persist as encrypted project snapshots so fresh agents export the same files humans see.
- Renamed the encrypted room-link action to `Invite human` and surfaced it near `Connect agent` while keeping the command palette path.
- Wired collaborator avatars to deterministic shadcn avatar images with initials fallbacks and calmer Fold persona names.
- Expanded deterministic persona name combinations so room-sized human/agent groups are less likely to show duplicate collaborator names.
- Added encrypted live presence snapshots with a compact collaborator stack for the selected Markdown file.
- Added quiet per-file presence indicators in the project sidebar so collaboration is visible across the file tree.
- Added encrypted typing/commenting activity hints to presence records with quiet toolbar and sidebar indicators.
- Removed boxed collaborator avatar chrome and moved the E2EE signal into quiet file metadata instead of a right-toolbar pill.
- Added a seeded long agent handoff report for desktop/mobile readability and annotation QA, including readable horizontal table scrolling on mobile.
- Fixed random/repeated frontmatter key log noise by using stable React keys.
- Verified recent UI slices with Playwright screenshots on desktop and mobile because `iab` is unavailable in this session.
- Continue verifying substantial slices with a separate reviewer/subagent before pushing.

## In Progress

- Keep reducing visible text and secondary chrome while preserving accessible labels/tooltips.
- Keep checking whether the command palette feels like an Obsidian-style quick switcher under larger project file sets.
- Continue checking mobile widths for overlap and horizontal scroll.
- Keep collaboration objects streaming through the encrypted room pipeline; avoid designs that depend on manual refresh or static server-readable fetches.
- Keep live presence quiet and useful without turning the chrome into a people dashboard.

## Next

- Keep proposal/review drawer controls compact while testing action clarity on mobile.
- Keep tuning inline annotation contrast across dark and bright themes without making the document feel marked up.
- Keep richer presence hints useful without revealing document content to the server.
- Keep named versions lightweight and verify restore clarity against long documents.
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
