# Agent MD Rooms — Agent Studio Design Research

## Working thesis

Agent MD Rooms should become an **Agent Studio**: a private, encrypted workspace where agent-created Markdown feels alive, reviewable, and worth keeping.

The product should not feel like a generic SaaS dashboard. It should feel like a room where AI work is staged, inspected, annotated, and shaped into a final artifact.

> Calm like Notion. Tactile like Raycast. Precise like Linear. Collaborative like Miro. Slightly cinematic like Superhuman. Original in its agent personas and encrypted-room trust model.

## Desired user feeling

- **Arrival:** “I’m entering a focused studio, not opening another admin panel.”
- **Trust:** “I can tell what the agent did, why, and whether I should accept it.”
- **Delight:** “The agents have presence, but they are not childish.”
- **Control:** “The Markdown is portable. The room is private. The server cannot read the work.”
- **Momentum:** “Reviewing agent work feels faster than reading raw terminal output.”

## Product metaphor

**Agent Studio**

A studio has a central artifact, side benches, working notes, collaborators, and tools that appear when needed. This maps cleanly to Agent MD Rooms:

- Main canvas: the Markdown artifact.
- Right bench: proposals, comments, timeline, personas.
- Top shelf: room identity, encryption state, share/export.
- Agent cast: memorable contributors with visible roles.
- Review moments: accept/reject/compare, like a soft PR flow.

## Reference brands and what we steal

### Notion

Steal:
- Warm paper canvas.
- Quiet document-first hierarchy.
- Minimal chrome.
- Soft borders and readable Markdown typography.

Avoid:
- Cloning Notion’s workspace sidebar.
- Generic emoji/block-handle personality.
- Making the document model block-native if Markdown fidelity suffers.

### Linear

Steal:
- Precision, density, restrained motion.
- Low-noise dark surfaces for review/metadata panels.
- One strong accent used sparingly.
- Command-first confidence.

Avoid:
- Overly cold issue-tracker feel.
- Making the main document look like an engineering dashboard.

### Raycast

Steal:
- Tactile depth: inset highlights, keyboard-like controls, pressed states.
- Command palette energy.
- “Power tool with personality.”

Avoid:
- Too much black/red gamer energy.
- Making the room feel like a launcher instead of a document studio.

### Superhuman

Steal:
- Premium restraint.
- Cinematic dark-to-light contrast.
- Confidence through typography rather than decoration.

Avoid:
- Luxury emptiness that sacrifices product clarity.
- Over-polished marketing mood inside the actual work surface.

### Miro

Steal:
- Collaborative warmth.
- Colored participant/persona presence.
- Spatial feeling of a shared creative room.

Avoid:
- Too many bright pastels.
- Whiteboard chaos.

## Proposed visual system

### Palette direction

- **Studio Ink:** `#141316` — primary deep text/dark panel.
- **Paper:** `#fbfaf7` — warm main canvas.
- **Parchment:** `#f0ede6` — secondary surfaces.
- **Rail Dark:** `#101114` — right rail / studio bench.
- **Mist Border:** `rgba(20,19,22,0.10)` on light, `rgba(255,255,255,0.08)` on dark.
- **Signal Blue:** `#4f7cff` — primary action / encryption confidence.
- **Persona accents:** small tokens only — coral, mint, amber, lilac, teal.

### Typography direction

- Primary: Inter or Geist-like precise sans.
- Optional editorial accent: a restrained serif for document title only, if testing shows it adds “soul” without feeling bloggy.
- Mono: JetBrains Mono / Geist Mono for room IDs, hashes, CLI commands, shortcuts.

### Depth direction

Add depth through **layered surfaces**, not gradients everywhere:

- Paper canvas casts soft ambient shadow.
- Rail uses dark recessed panels with inset highlights.
- Proposal cards feel like slips on a desk.
- Keyboard hints use Raycast-like keycaps.
- Agent badges have tiny colored glows, never full-color cards.

## Native product components

Replace generic component thinking with product-native components:

- `StudioShell` — the whole room environment.
- `RoomMarquee` — title, encryption state, share/export.
- `MarkdownStage` — readable document canvas.
- `AgentBench` — right rail for human/agent collaboration.
- `PersonaChip` — agent/human identity marker.
- `ProposalSlip` — patch proposal with rationale and status.
- `TrustPill` — local encryption / server blind / Markdown exportable.
- `TimelineThread` — commit-like room history.
- `CommandDeck` — command palette / shortcuts.
- `MoodLight` — subtle room tone from encrypted metadata or room type.

## Mood board concepts

### A. Quiet Studio

Light paper canvas + dark review rail. Closest to the likely product direction.

- Main feeling: calm, reviewable, trustworthy.
- Best for: daily work, sharing real artifacts.
- Risk: could still feel too safe unless persona and depth details are strong.

### B. Night Desk

Dark studio with glowing paper artifact and cinematic agent rail.

- Main feeling: late-night agent research lab.
- Best for: memorable demos, technical users, “agent studio” brand.
- Risk: less Notion-like, may reduce reading comfort for long docs.

### C. Workshop Board

More collaborative and spatial, borrowing Miro’s color warmth while staying document-first.

- Main feeling: human + agent cast around a shared artifact.
- Best for: multi-agent review, teams, lively collaboration.
- Risk: can become too playful or visually noisy.

## Recommendation

Prototype **Quiet Studio** first, with Night Desk depth details and Workshop Board persona treatment.

This gives us a practical default:

- Light document surface for reading.
- Dark right rail for agent/review energy.
- Distinct persona chips.
- Tactile proposal slips.
- Trust/security always visible but quiet.

## Implementation notes for the current repo

- Keep `shadcn/ui`/Radix as primitive accessibility infrastructure, but wrap them in Agent MD Rooms product components.
- Do not add broad decorative gradients to the main room.
- Avoid card-in-card dashboard composition.
- Use the current right rail structure, but redesign it as an `AgentBench` instead of tabs inside a panel.
- Use fewer icons. Increase typography, affordance, and surface quality.
- Keep Markdown export/security affordances visible in the chrome.
- Persona assignment should remain system/room-generated, not self-selected.

## Next prototype target

Create a high-fidelity room shell prototype with:

1. Warm paper Markdown stage.
2. Dark agent bench right rail.
3. Proposal slips with persona chips and accept/reject controls.
4. Trust pills: `local key`, `server blind`, `markdown export`.
5. One command palette preview.
6. Three mood variants visible for comparison.
