# Lost-Key UX Improvement Plan

Fold uses strict client-side encryption. The server cannot recover room keys,
decrypt project contents, or reconstruct a missing `#key=...` fragment. The
lost-key UX should therefore help users understand, prevent, and repair access
loss without weakening the E2EE model.

## Product Goal

Make missing or wrong project keys feel understandable and recoverable through
human workflow, while being clear that Fold itself cannot recover encrypted
content.

The experience should answer three user questions:

- Why can I not open this project?
- What exactly do I need?
- What can I do next?

## Non-Goals

- Do not add server-side key recovery.
- Do not store room keys in browser recent-project metadata by default.
- Do not imply Fold support, admins, or the host can recover content.
- Do not add account-gated recovery until the product has a designed key
  escrow, device trust, or rotation model.
- Do not weaken current token, URL fragment, or routine JSON redaction rules.

## Current State

- Full room URLs use `/room/:roomId#key=...`.
- Browser recent projects store non-secret convenience metadata only.
- Opening a room without a key shows `RoomAccessGate`.
- Opening a room with a bad key now returns to the access gate with a decrypt
  error instead of rendering the room shell.
- Docs warn that losing the room key means losing access.

Current weakness: the access gate is technically correct but thin. It does not
yet help users paste a full invite link, request the key from a collaborator, or
save access at creation time.

## User Segments

### Creator

Creates a project and may later return from the home screen or a bookmark. They
need a gentle reminder to keep the private link or an export.

### Invited Human

Receives a link from another person. They may paste only `/room/:id`, lose the
fragment through chat/email formatting, or open a recent project without the
key.

### Agent Operator

Copies agent handoffs and may need to rejoin through CLI aliases. They need
clear separation between browser keys, `fold:v1:` tokens, and `.fold/rooms.json`.

### Self-Host Admin

May expect server admin powers. They need clear wording that hosting the server
does not grant plaintext recovery.

## UX Principles

- Be calm and direct. Do not scare users with cryptographic jargon first.
- Always say what to do next.
- Explain that the `#key=...` fragment is the missing secret, not the room id.
- Keep advanced E2EE detail available but not in the first sentence.
- Prefer copyable request messages and paste helpers over long explanations.
- Make prevention visible at room creation, not only after failure.

## Proposed Experience

### 1. Stronger Access Gate

When the user opens a room without key material:

Title:

```text
Project key required
```

Primary copy:

```text
This project is encrypted before it reaches the server. Paste the full Fold
invite link or the project key to open it.
```

Actions:

- `Paste full invite link`
- `Paste project key`
- `Copy request message`

Secondary copy:

```text
Fold cannot recover this key. Ask the project owner to resend the full link,
including the #key=... part.
```

When a bad key is provided:

```text
That key could not decrypt this project. Check that the full #key=... fragment
was included.
```

The form should keep the attempted sync server visible, but the secret input
should be focused.

### 2. Full Invite Link Parser

Allow users to paste a full room URL into the access gate. If it contains:

- `/room/:roomId#key=...` for the current room: fill the key and open.
- `/room/:otherRoomId#key=...`: show a mismatch warning and offer to navigate
  to that room instead.
- `fold:v1:` token: explain that this is an agent/CLI token and offer a short
  CLI command hint, but do not silently import it in the browser yet.
- no `#key`: keep the form in missing-key state.

This is the highest-leverage first implementation because it fixes the common
copy/paste failure without adding new storage.

### 3. Copy Request Message

Add a one-click request message from the access gate and recent-room cards:

```text
Can you resend the Fold project link for "<project name>"?
I need the full link including the #key=... part.
```

For unknown project names:

```text
Can you resend the Fold project link?
I need the full link including the #key=... part.
```

This turns a dead end into a human recovery flow while preserving E2EE.

### 4. Post-Creation Save Access Nudge

After a user creates a project, add a checklist item in the existing onboarding
surface:

```text
Save your private link
```

Body:

```text
Fold cannot recover this key later. Keep the private link somewhere safe.
```

Actions:

- `Copy private link`
- `Download access note`

The downloaded note should be plaintext by design and clearly named, for
example `fold-project-access.txt`. It should contain:

- project name
- room URL with `#key=...`
- sync server URL
- short warning that anyone with the link can decrypt the project

This should be optional. Do not auto-download or nag repeatedly.

### 5. Recent-Room Key Status

Recent room cards should make key availability legible:

- `Key in current link` when the current URL has the room key.
- `Key needed` when recent metadata has only the room id.
- `Open` when enough access material is present in the current URL.
- `Paste key` or `Paste full link` when not.

Browser recent metadata should continue to avoid storing room keys by default.

Future optional setting:

```text
Remember this key on this device
```

This should be explicitly opt-in, local-device-only, and documented as changing
the local security posture. It is not part of the first implementation.

## Implementation Plan

### Phase 1: Access Gate Clarity

Files:

- `apps/web/components/room/RoomAccessGate.tsx`
- `apps/web/app/room/[roomId]/page.tsx`

Work:

- Rename access gate heading to `Project key required` when no key is present.
- Use bad-key-specific copy when decryption fails.
- Add helper text explaining that Fold cannot recover the key.
- Add `Paste full invite link` input mode or allow the existing key field to
  accept a full link.
- Parse room URL fragments and fill the key.
- Add `Copy request message`.

Verification:

- Open `/room/:id` without key.
- Open `/room/:id#key=bad` for a room with encrypted records.
- Paste a full valid invite link.
- Paste a valid link for another room and confirm mismatch behavior.
- Confirm the document surface does not render on missing or bad key.

### Phase 2: Creation-Time Prevention

Files:

- `apps/web/components/room/RoomShell.tsx`
- `apps/web/app/room/[roomId]/page.tsx`
- existing onboarding smoke script

Work:

- Add `Save your private link` to the onboarding checklist.
- Reuse existing human invite copy behavior where possible.
- Add optional access-note download.
- Keep copy short and non-alarming.

Verification:

- New room shows checklist item.
- Copy private link includes `#key=...`.
- Access note download contains the full link and warning.
- Reopening onboarding does not repeatedly nag after completion/skipping.

### Phase 3: Recent-Room Re-Entry

Files:

- `apps/web/app/page.tsx`
- `apps/web/components/room/RoomAccessGate.tsx`

Work:

- Show `Key needed` on recent cards when opening would require a key.
- Add `Paste key` or `Paste full link` affordance.
- Add `Copy request message`.
- Keep recent storage secret-free.

Verification:

- Recent-room localStorage contains no `#key`, `fold:v1:`, or `roomSecret`.
- Recent room without key opens access gate.
- Request message includes project name when known.
- Corrupted recent-room storage still clears safely.

### Phase 4: Agent/CLI Continuity Copy

Files:

- `docs/agent-continuity.md`
- `docs/cli.md`
- `skills/fold/SKILL.md`
- `packages/fold-agent/skills/fold/SKILL.md`

Work:

- Clarify browser lost-key flow versus agent saved alias flow.
- Explain that `.fold/rooms.json` can preserve agent access locally.
- Make handoffs tell agents to keep the saved alias and avoid printing tokens.

Verification:

- Drift tests still pass.
- Agent handoff does not imply server recovery.
- Routine JSON redaction remains unchanged.

## Copy Bank

Access gate no key:

```text
Project key required
This project is encrypted before it reaches the server. Paste the full Fold
invite link or the project key to open it.
```

Access gate bad key:

```text
That key could not decrypt this project. Check that the full #key=... fragment
was included.
```

Recovery truth:

```text
Fold cannot recover this key. Ask the project owner to resend the full link,
including the #key=... part.
```

Creation nudge:

```text
Save your private link
Fold cannot recover this key later. Keep the private link somewhere safe.
```

Access note warning:

```text
Anyone with this link can decrypt the project. Keep it private.
```

## Open Questions

- Should `Remember this key on this device` exist in alpha, or wait until we
  have a broader local trust model?
- Should access notes be `.txt`, `.md`, or both?
- Should the access gate accept `fold:v1:` tokens for browser unlock, or keep
  those CLI-only for now?
- Should project owners see a periodic save-access reminder, or only the first
  onboarding checklist?
- Should there be a room-level “rotate key” plan before introducing remembered
  keys?

## Recommended First Slice

Build Phase 1 only:

1. Improve access gate copy.
2. Accept full invite links.
3. Add copyable request message.
4. Verify missing-key, bad-key, valid-link, wrong-room-link, and no-shell-render
   states.

This gives the biggest user benefit while preserving Fold's current E2EE and
storage model.
