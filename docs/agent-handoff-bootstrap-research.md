# Agent Handoff Bootstrap Research

Status: superseded by the `fold-agent` bundled CLI and skill package.

## Current Decision

Fold handoffs should lead with one pinned package-runner command:

```bash
npx --yes fold-agent@0.1.2 bootstrap --room "fold:v1:..." --alias launch --output ./fold-project-launch --json
```

This is more practical than requiring a separate skill manager because a cold
agent needs a real executable before the skill can be useful. `fold-agent`
bundles both:

- the executable CLI for encrypted room operations;
- `skills/fold`, the reusable agent operating policy.

The skill does not install executables by itself. The CLI installs or updates
the skill through:

```bash
fold-agent skill
fold-agent skill status
fold-agent skill update
```

## Why This Replaced The Older Skill-Only Plan

The earlier idea used standards-compatible skill installation as the primary
handoff path. That was elegant for repeat agents, but not reliable for first
contact:

- a fresh agent may not have a skill manager;
- some hosts do not load newly installed skills during the current session;
- the skill can teach behavior, but cannot perform encrypted room operations.

The packaged CLI path keeps the copied handoff small and executable:

1. install/run `fold-agent` through `npx`;
2. copy the bundled skill into known local skill locations;
3. resume the encrypted room and save the alias;
4. print redacted next commands.

## Cold And Warm Behavior

Cold agent:

```bash
npx --yes fold-agent@0.1.2 bootstrap --room "fold:v1:..." --alias launch --output ./fold-project-launch --json
```

Warm repeat agent:

```bash
npx --yes fold-agent@0.1.2 resume --room launch --output ./fold-project-launch --json
```

Installed CLI repeat agent:

```bash
npm install -g fold-agent@0.1.2
fold-agent skill status
fold-agent resume --room launch --output ./fold-project-launch --json
```

## Security Rules

- Treat `fold:v1:` tokens, room URLs with `#key=`, and `.fold/rooms.json` as
  secrets.
- Routine JSON outputs stay redacted.
- Only explicit create, publish, room profile, and invite workflows may emit
  decryption-capable room URLs or tokens.
- Browser join uses `/room/:roomId#key=...`; CLI join uses `fold:v1:` tokens.

## Remaining Release Check

Before publishing, verify the npm name is still available:

```bash
npm view fold-agent version --json
```
