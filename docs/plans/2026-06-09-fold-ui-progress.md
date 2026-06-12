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
- Added Markdown source editor Tab/Shift+Tab indentation so list and code editing feels closer to a real Markdown workspace.
- Softened the Markdown source editor stats into a quiet in-surface overlay instead of a bordered footer bar.
- Added inline selected-text comment composer and clickable inline comment markers.
- Added invisible mobile tap halos to inline annotation markers so comments/suggestions are easier to open without louder document styling.
- Made mouse text selection open the inline comment composer directly while preserving keyboard selection.
- Increased mobile inline composer action tap targets while preserving compact desktop sizing.
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
- Removed missing-file implementation copy from the Markdown surface so stale project-file state falls back to the quiet writing prompt.
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
- Calmed sync error presentation into a compact E2EE status strip so offline/local development does not dominate the document.
- Added conditional Active and Review file sections to the project sidebar, with full-tree timestamps kept quiet so live collaborators and files needing attention are discoverable without a permanent review rail.
- Made Review sidebar summary files open the lightweight review drawer directly after selecting the file.
- Made collaborator avatars smaller and added quiet per-file activity labels for typing/commenting/editing.
- Matched compact avatar sizing across comment chips and the review drawer participant stack.
- Added a seeded long agent handoff report for desktop/mobile readability and annotation QA, including readable horizontal table scrolling on mobile.
- Fixed random/repeated frontmatter key log noise by using stable React keys.
- Tightened the command palette quick-switcher: tested Arrow/Home/End navigation, ranked files and commands together during search, and removed repeated group headers from filtered results.
- Calmed review-drawer suggestion rows by using desktop icon actions, keeping labeled mobile actions, and hiding the empty comments section when there is no comment work.
- Added an inline confirmation step for named-version restores so checkpoints stay lightweight but are harder to roll back accidentally.
- Tuned inline annotation markers with wrapped-line-safe decoration, softer comment underlines, and clearer pending suggestion cues.
- Reworked blank Markdown files into a quiet document-native writing prompt instead of a centered empty-state island.
- Hid zero-count review commands from the default quick switcher while keeping them searchable on demand.
- Hid the already-active read/edit mode from the default quick switcher while preserving mode search.
- Removed zero-count review drawer chrome from empty project states while keeping versions and activity available.
- Made web human personas stable per browser profile and deduped same-persona presence avatars across tabs.
- Removed visible shortcut/tutorial chrome from the source editor footer and command palette while preserving accessible keyboard context.
- Replaced the agent handoff modal with a direct top-chrome and command-palette copy action so agent onboarding stays lightweight.
- Polished sidebar file creation into a compact project-tree row with normalized Markdown paths, confirm/cancel controls, and duplicate-path feedback.
- Hid the routine empty-room creation event from the review drawer so first-open rooms stay focused on document work.
- Hid the empty-file checkpoint form from the review drawer until a file has content or saved versions.
- Hardened encrypted project-file replay so stale delayed web snapshots do not overwrite newer local or remote Markdown state in the web app or CLI export.
- Added encrypted leave-presence records so collaborators disappear promptly on pagehide/room teardown while normal file/mode/activity updates do not flicker presence.
- Added a local incoming-edit safeguard for encrypted web file snapshots: if a remote file update arrives while the browser has an unsaved debounced edit, Fold pauses the incoming snapshot, keeps the local draft visible, and surfaces compact `Incoming edit` review actions.
- Extended the incoming-edit safeguard to encrypted full-project snapshots so untouched files update normally while files with local unsaved edits stay visible and reviewable file-by-file.
- Added deletion-aware full-project snapshot handling so stale deletions do not remove newer local files, and fresh deletions during unsaved local edits become compact `Incoming edit` review actions.
- Routed the empty toolbar comment action directly to the document file-comment composer instead of opening a blank review drawer.
- Made the file-comment composer cancel action touch-sized and cleared stale draft text after cancel/post.
- Opened the file-comment list immediately after posting so comment feedback stays in the document surface.
- Floated desktop document comment controls into quiet page chrome with reserved title space while keeping mobile controls touch-sized and in-flow.
- Reduced the top collaborator avatar stack and removed boxed command-palette result icons so quick switching feels closer to editor chrome than cards.
- Tuned bright theme shell tokens and document elevation so light mode feels like a calm editor workspace instead of a high-shadow dashboard.
- Expanded the document-model fidelity spike with a long agent handoff sample before swapping in a polished editor surface.
- Added a Milkdown readiness gate so a richer editor must prove Markdown fidelity, quiet UX, and collaboration mapping before replacing the source editor.
- Audited current Milkdown package metadata and narrowed the next editor prototype to core/preset fidelity checks before Crepe or collab packages.
- Added a hidden Milkdown CommonMark/GFM fidelity harness; wrapping Fold properties preserves frontmatter, but exact Markdown bytes still fail.
- Strengthened the Milkdown harness with structural task-list and table semantics checks.
- Classified Milkdown source rewrites so the remaining editor gate can separate acceptable formatting normalization from unexplained Markdown churn.
- Added compact named-version size metadata and a restore confirmation delta so long-document checkpoint restores show their line/word impact without adding review-drawer prose.
- Added a compact encrypted proposal diff panel to the suggestion preview dialog so whole-document and file replacement proposals can be reviewed before accepting.
- Added a compact two-step accept confirmation in the suggestion preview dialog so agent proposals are harder to apply accidentally.
- Added the same compact two-step accept confirmation to review-drawer proposal rows so quick actions cannot apply agent changes in one click.
- Cleaned up the file-header quick switcher semantics so its accessible label names the file, location, saved state, and E2EE status without reading decorative metadata twice.
- Verified recent UI slices with Playwright screenshots on desktop and mobile because `iab` is unavailable in this session.
- Continue verifying substantial slices with a separate reviewer/subagent before pushing.

## In Progress

- Keep reducing visible text and secondary chrome while preserving accessible labels/tooltips.
- Keep checking whether the command palette feels like an Obsidian-style quick switcher under larger project file sets.
- Continue checking mobile widths for overlap and horizontal scroll.
- Keep collaboration objects streaming through the encrypted room pipeline; avoid designs that depend on manual refresh or static server-readable fetches.
- Keep live presence quiet and useful while preserving prompt leave behavior and avoiding people-dashboard chrome.
- Keep conflict handling honest and compact: current web and project snapshots can pause and resolve incoming edits, while true Markdown merge/rebase remains future work.

## Next

- Keep proposal/review drawer controls compact while continuing to test action clarity on mobile.
- Keep tuning inline annotation contrast across dark and bright themes without making the document feel marked up.
- Keep richer presence hints useful without revealing document content to the server or relying on server-readable awareness state.
- Continue hardening multi-user project-file conflicts beyond stale snapshot rejection and incoming-edit pause; richer Markdown merge/rebase semantics are still open.
- Keep named versions lightweight while continuing to verify restore clarity against long documents.
- Keep empty states sparse and document-native as more project creation/import states are added.
- Continue measuring long-document readability against the Obsidian reference screenshots.
- Prototype Milkdown behind the readiness gate before replacing the source editor.

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
