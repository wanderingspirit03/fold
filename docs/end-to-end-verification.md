# End-to-End Verification Plan

This plan defines how Fold should be verified across humans, agents, project
rooms, comments, review workflows, deployment, storage, and security boundaries.
It is intentionally broader than `npm run check`: the automated suite proves
many invariants, while this document maps the complete product behavior we need
confidence in before calling a release production-ready.

## Verification Principles

- Verify the actual user paths, not only helper functions.
- Treat humans and agents as separate personas with separate failure modes.
- Test copied handoffs exactly as users and agents receive them.
- Confirm strict E2EE boundaries: Markdown, comments, proposals, versions,
  personas, and project snapshots stay client-side encrypted.
- Keep secret-bearing outputs explicit. Routine JSON must not emit `#key=`,
  `fold:v1:`, or `roomSecret`.
- Verify local, hosted same-origin, and split web/sync deployment shapes.
- Record alpha constraints honestly instead of hiding known product risks.

## Release Gates

Run these gates for every release candidate:

```bash
npm run check
mkdir -p /tmp/fold-agent-pack
npm pack --json --workspace=fold-agent --pack-destination /tmp/fold-agent-pack
npm exec --yes --package /tmp/fold-agent-pack/fold-agent-<version>.tgz -- fold-agent --help
npm exec --yes --package /tmp/fold-agent-pack/fold-agent-<version>.tgz -- fold-agent skill status --json
```

After publishing, verify the registry package separately:

```bash
npx --yes fold-agent@<version> --help
npx --yes fold-agent@<version> skill status --json
```

For a release-quality local browser pass, build the web app and run the browser
surface in production mode. Use `npm run web:dev` only for exploratory UI work;
the smoke scripts treat browser console errors as fatal, so Next development
overlays and hydration diagnostics can make dev-mode runs noisy.

```bash
npm run server -- --port 8787 --data ./data
npm run web:build
npm run start --workspace=apps/web -- --port 3000
```

Then run the smoke suite that matches the changed area:

```bash
npm run web:smoke:onboarding
npm run web:smoke:navigation
npm run web:smoke:agent-comment
npm run web:smoke:proposal
npm run web:smoke:collab
npm run web:smoke:hosted-create -- --base-url <origin>
npm run smoke:deploy -- --base-url <origin>
```

For hosted verification, always include at least one copied agent handoff from
the deployed web app and run it from a fresh temp directory.

## Scenario Matrix

| Area | Scenario | Setup And Steps | Expected Result | Edge Cases To Include | Current Coverage |
| --- | --- | --- | --- | --- | --- |
| Agent package | Packed artifact | Build and dry-run pack `fold-agent`. Inspect package files. | Package includes `bin/fold-agent.js`, compiled CLI/runtime modules, and bundled `skills/fold`; excludes app build output, data, `.fold`, and repo-only files. | Missing dist files, non-executable bin, stale skill copy, version drift. | Manual dry-run; needs package allowlist test. |
| Agent handoff | Copy drift | Compare CLI invite, web invite, public well-known skill, root skill, and packaged skill. | All use pinned `npx --yes fold-agent@<version> bootstrap`, alias-specific output dirs, `post` for fresh files, and `propose` for existing files. | Stale package version, old skill-only install instructions, `/usr/bin/fold` ambiguity. | `src/web/agent-handoff-drift.test.ts`; still needs real copied-handoff smoke. |
| Cold agent | Fresh bootstrap | In empty cwd, run copied `fold-agent bootstrap --room <token> --alias <name> --output ./fold-project-<name> --json`. | Skill installs or updates, alias saved in `.fold/rooms.json`, accepted files export as project directory, next commands use alias, output redacts secrets. | Missing alias, output path collision, unmanaged skill dir, permission denied, hosted token with split URLs. | Direct operation tests; needs packed or `npx` route test. |
| Warm agent | Resume alias | After bootstrap, run `fold-agent resume --room <alias> --output ./fold-project-<alias> --json`. | No skill reinstall required, alias resolves, output redacts secrets, project refreshes from encrypted replay. | Alias plus `--alias` rejected, alias collision/overwrite policy, no `--output` should not print stale edit commands. | CLI operation tests; alias collision gap. |
| Agent continuity | Long-lived work | Create room, bootstrap, propose, close session, start fresh agent with only alias and local `.fold`. | Fresh agent can recover accepted project, requests, comments, proposals, and next commands from room replay. | Deleted `.fold`, moved project directory, stale exported files, changed room URL via `room set-url`. | Partial docs/tests; needs full cold/warm scripted run. |
| Room references | URL/token parsing | Parse browser URL, `fold:v1:` token, base-path URL, split app/sync token. | `serverRoomUrl` excludes fragment key; URL without key is rejected; token preserves room id, secret, app URL, and sync URL. | Malformed token, legacy `serverUrl`, query/hash ordering. | `src/rooms/room-reference.test.ts`. |
| CLI room management | Alias commands | Exercise `room create/add/list/show/set-url/forget/invite`. | Secret-bearing commands are limited to create/add/show/invite; routine list/status/resume/export/context stay redacted; POSIX metadata perms are restrictive. | Forget missing alias, set only app URL, split URL migration, alias overwrite. | Metadata tests; direct command coverage gaps. |
| Human create/join | Web room access | Clear local storage; create project from `/`; open full room URL; reopen from recent room without key; try missing/bad key. | New room has `#key`; recent rooms store non-secret metadata only; missing key opens access gate; bad key does not leak plaintext. | Custom sync URL, malformed fragment, corrupted recent-room storage. | Smoke for hosted create; no stable UI e2e for join/access gate. |
| Human workspace | Recent rooms | Seed `fold:recent-rooms`; switch Recent, Shared, Agents, Review, Archive; archive/restore. | Rooms sort by visit time, invalid storage clears, archive state persists, review counts display from local metadata. | Review count drift, stale room names, archived-only state. | No UI test. |
| Onboarding | First-time checklist | Clear `fold:onboarding:web-room:v1`; open room; use welcome, checklist, skip/done, command palette, query overrides. | Welcome traps focus; checklist persists completed/skipped state; command palette can reopen; no horizontal overflow. | Mobile layout, dark theme, query override after completion. | `web:smoke:onboarding`; no component test. |
| Theme/design | Dark mode and contrast | Toggle theme on home and room; inspect read mode, editor, review drawer, popovers, invites, disabled states. | Theme persists, no flash, controls remain visible with focus rings and sufficient contrast. | Light document surface inside dark shell, disabled text, local-warning banners. | Smoke/design scripts; no automated contrast threshold. |
| Project files | Navigation/import/create | Use multi-file nested project; switch sidebar/mobile drawer/command palette; follow relative Markdown links; import duplicate filenames. | Paths normalize, active folders open, recent files persist, duplicate import becomes unique, internal links navigate. | `..` segments, case-sensitive duplicates, search-created arbitrary path. | `web:smoke:navigation`; helper tests only. |
| Project naming | Rename room | Rename with whitespace, empty name, long name, and second client reload. | H1-derived name is replaced by encrypted profile name; whitespace collapses; empty becomes `Untitled project`; max length clamps. | Failed save after optimistic update, concurrent rename ordering. | No test. |
| Read/edit | Markdown editing | Switch read/edit, edit source, blur, save, switch file, reload/export. | Markdown remains source of truth; properties/frontmatter preserve; snapshots flush before leaving file; read mode sanitizes render. | Empty doc, Tab/Escape, legacy Y.Text room vs project snapshots. | Indentation helper tests; needs UI persistence test. |
| Renderer security | Unsafe Markdown | Render raw HTML, dangerous links, math, Mermaid, tables in document and proposal preview. | Raw HTML stripped, dangerous href removed, KaTeX sanitized, Mermaid source placeholder shown. | Future `rehype-raw` policy gate, proposal preview parity. | `src/web/markdown-renderer-security.test.tsx`. |
| Comments | File and inline comments | Human adds file comment, inline quote comment, and agent request; agent replies by CLI; human replies in web. | Encrypted replay shows all threads; request/comment counts separate; replies sort oldest-first; personas remain visible. | Empty text, missing file path, duplicate quote, detached anchor after edits. | `web:smoke:agent-comment`, room tests. |
| Comment state | Resolve/reopen | Resolve in web, attempt CLI reply, reopen in web, reply again. | Resolved threads hide from active markers; CLI rejects replies to resolved threads; reopened threads accept replies. | CLI has no resolve/reopen command despite replay support. | Web-level behavior needs stronger test. |
| Agent requests | Request queue | Human creates request; agent runs `requests --open`, replies or proposes change. | Agent sees unresolved requests without scanning ordinary comments; context output includes them without secrets. | Resolved requests, path-filtered requests, request with detached anchor. | CLI tests cover request listing/reply. |
| Proposals | Non-mutating submit | Agent proposes existing file or project; export before accept. | Accepted Markdown is unchanged; compact JSON omits proposed body; `show-proposal` can decrypt proposed Markdown. | Whole-project diff size, no semantic merge hunks, duplicate proposals. | CLI proposal tests. |
| Proposals | Accept/reject lifecycle | Submit two proposals from same base; accept first; try second; reject; replay/export. | CLI accept appends encrypted decision and accepted project; stale second accept is rejected; final status derives from encrypted replay. | Duplicate accept/reject, event-only accepted recovery, latest seq reporting. | CLI tests; browser stale-accept gap. |
| Browser review | Web proposal dialog | Open pending suggestion, reply, ask again, edit accepted Markdown, cancel/confirm accept, reject another proposal. | Dialog is usable on desktop/mobile; edited accept updates accepted project; reject does not change export. | Stale proposal acceptance in browser, horizontal overflow, discussion replay. | `web:smoke:proposal`. |
| Fresh files | `post` vs `propose` | Use `post` for `NEW.md`; try proposing a fresh path; propose existing path. | Fresh files are direct accepted posts; existing file changes are reviewable proposals; proposing new path is rejected clearly. | Docs drift saying empty rooms add files through proposals, duplicate post path, directory post. | CLI tests; docs should stay aligned. |
| Multi-file projects | Project replacement | Publish directory; propose directory; accept; propose one file with `--path`. | Project replacement updates all files; single-file proposal preserves other files and primary path. | Delete semantics, new files inside proposal, primary path drift. | CLI tests. |
| Conflict handling | Web file snapshots | Two browser clients edit same project file while snapshots arrive. | Remote snapshot defers into conflict UI; user can keep local or use incoming; CLI replay uses append-log sequence. | Clock/timestamp skew, unsaved local draft, mobile conflict UI. | `web:smoke:collab`; needs targeted assertions. |
| Personas/timeline | Identity and events | Create human comments, agent comments, proposals, accept/reject. | Personas are room/system assigned, stable, and visibly human/agent distinct; timeline events decrypt from append log. | CLI agents share stable reviewer/commenter fingerprints; timeline-only replay lacks sequence validation. | Persona/timeline tests. |
| Local dev deploy | Split web/sync | Start sync on `8787`, web on `3000`, publish with explicit app/sync URLs, use browser plus CLI. | Token carries split URLs; browser connects to sync; reload/export works. | `localhost` vs `127.0.0.1`, private LAN warnings, CORS/WebSocket upgrade. | Smoke scripts assume running sync; no single full scripted pass. |
| Hosted deploy | Same-origin app | Start `NODE_ENV=production FOLD_PUBLIC_URL=<origin> FOLD_DATA_DIR=<persistent-dir> npm start`; call `/health`; create/open room. | Next app, HTTP sync, and WebSocket sync share one origin; runtime validation rejects missing public URL/storage in production mode. | Platform env fallback, persistent disk not actually mounted, backup missing. | Runtime tests and `smoke:deploy`; hosted write/replay smoke gap. |
| Provider URLs | Cloud agnostic origins | Test Railway, Render, Fly, Vercel-style env vars without `FOLD_PUBLIC_URL`. | Fallback detects public origin and warns to set explicit portable URL. | Real provider WebSocket behavior, split deployments via `NEXT_PUBLIC_FOLD_SYNC_URL`. | Unit tests only. |
| Health | Health endpoint | Run `/health` and `smoke:deploy` against local and hosted origin. | Reports `ok`, `service: fold`, store info, uptime, version, and single-instance warning for file store. | Does not prove write/replay, WebSocket, or persistence. | `scripts/hosted-deployment-smoke.ts`. |
| Persistence | File-backed restart | Append encrypted records, stop server, restart with same data dir, list/export. | Records replay in order after restart; non-contiguous JSONL fails. | Corrupt single line lacks quarantine/recovery; fsync/atomic append not proven. | Server append-log tests. |
| Multi-instance | Single-writer hazard | Point two processes at one data dir and concurrently append. | Not supported; docs/health should warn one instance only. | Duplicate seq/corrupt replay; no lock file or advisory lock. | Known alpha gap. |
| WebSocket replay | Backlog/live stream | Join room with existing records, receive backlog, `sync-complete`, then live updates. | Client validates contiguous sequence and halts on missing/duplicate/reordered records. | Cannot detect silent truncation, forked history, or withheld future records. | Spike, server tests, sequence tests. |
| Presence | Ephemeral awareness | Two clients send encrypted presence updates; inspect durable log/status. | Presence broadcasts live only and is not appended durably. | Timing/sender metadata leaks, no rate limiting. | Server tests. |
| Security/redaction | Secret allowlist | Run create/publish/show/invite and routine commands; inspect JSON and storage. | Only explicit secret-bearing workflows emit room access material; storage contains ciphertext plus plaintext routing metadata. | No central result allowlist beyond tests/types; context includes decrypted Markdown but no keys. | CLI tests and docs. |
| Lost access | No room key | Delete `.fold/rooms.json`, remove URL fragment/token, try open/export with only room id. | Access cannot be recovered by server; user must keep invite/token/export. | Web UX for lost key is minimal. | Docs only. |
| Abuse boundary | Garbage append | POST syntactically valid encrypted-looking payload without room key. | Server accepts opaque append today; legitimate clients fail/ignore decrypt. | Append-log pollution, DoS, storage growth; no write auth/rate limit. | Known alpha gap. |

## Highest-Priority Missing Tests

1. Packed or registry `fold-agent` cold bootstrap from a fresh temp directory
   with no repo context.
2. Hosted copied-handoff smoke: web creates a room, copied handoff bootstraps,
   agent posts/proposes, web shows both.
3. Browser stale-proposal guard parity with CLI accept.
4. Stable UI e2e for home create/join, access gate, recent rooms, project
   naming, project file create/import, and invite clipboard behavior.
5. Alias lifecycle coverage for `room show`, `room set-url`, `room forget`, and
   alias collision/overwrite policy.
6. Skill install status/update coverage for global targets, unmanaged targets,
   stale managed targets, newer managed targets, and permission failures.
7. Split web/sync deployment smoke with `NEXT_PUBLIC_FOLD_SYNC_URL`.
8. Hosted WebSocket write/replay smoke, not only `/health`.
9. Corrupt JSONL behavior and multi-instance duplicate-sequence hazard tests.
10. Malicious/garbage append handling and rate-limit/write-authorization plan.

## Known Alpha Limits To Preserve In Reports

- The server stores plaintext routing metadata: `roomId`, `seq`, `senderId`,
  record counts, latest sequence, request timing, and network metadata.
- The current file-backed store is single-instance only.
- Clients detect delivered sequence gaps, duplicates, and reordering, but not
  malicious-server truncation, forking, or withheld future records.
- Link revocation, key rotation, account authorization, append authorization,
  rate limiting, backup/restore tooling, and compaction are not production
  hardened yet.
- Inline anchoring is quote/context based and can drift when text changes.
- Proposals are whole-file or whole-project replacements, not semantic patch
  hunks.
- Browser accept currently needs the same stale-base protection as CLI accept.
- CLI can reply to comments/requests but does not yet expose resolve/reopen.

## Evidence Sources

- CLI and room logic: `src/cli/`, `src/rooms/`
- Web room UI: `apps/web/app/room/[roomId]/page.tsx`,
  `apps/web/components/room/`
- Deployment/runtime: `src/deploy/`, `src/hosted/`, `src/server/`
- Smoke scripts: `scripts/web-*.ts`, `scripts/hosted-deployment-smoke.ts`
- Public handoffs and skills: `apps/web/public/.well-known/fold/agent-skill.md`,
  `skills/fold/`, `packages/fold-agent/skills/fold/`
- Product constraints: `PLAN.md`, `README.md`, `docs/production-readiness.md`,
  `docs/cli.md`, `docs/deploy.md`
