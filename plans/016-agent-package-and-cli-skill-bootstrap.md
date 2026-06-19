# 016 fold-agent CLI And Bundled Skill Bootstrap

## Status

IMPLEMENTED LOCALLY

## Goal

Make a cold external agent able to join and work in a Fold room from one copied
handoff without cloning the full Fold repository.

The handoff should give the agent a real executable package, install or update
the Fold skill locally, resume the encrypted room, and print safe next commands.

## Current Problem

Fold currently has:

- a repo-local CLI run through `npm run --silent cli -- ...`;
- a public well-known skill at `/.well-known/fold/agent-skill.md`;
- an older skill-only package plan that has now been removed;
- copied handoffs that warn about `/usr/bin/fold` and explain that skill
  installation does not install the CLI.

This works for warm agents and agents inside a cloned Fold repo. It is not
enough for a true cold agent. A cold agent can read the skill, but still has no
direct way to obtain a Fold CLI without inferring that it should clone the repo.

## Design Decision

Use one publishable npm package:

```text
fold-agent
  Executable CLI for agent and human room workflows, plus bundled Fold skill files.
```

Keep CLI and skill responsibilities separate inside the package:

- `fold-agent` performs encrypted room operations and manages local skill
  installation;
- bundled `skills/fold` contains agent operating policy and command references;
- the skill files never install executables by themselves.

This follows the Nia pattern: the installed CLI has a `skill` command that
manages the agent skill.

```bash
nia skill
nia skill update
```

Fold should mirror that with:

```bash
fold-agent skill
fold-agent skill status
fold-agent skill update
```

Do not depend on the binary name `fold` for the cold-agent path. On macOS,
`/usr/bin/fold` is the Unix text-wrapping command. The published agent CLI
should expose `fold-agent` as its primary binary to avoid PATH ambiguity.

## Package Names

Use this package name unless final npm publishing checks force a change:

```text
fold-agent
```

Current npm registry probe on 2026-06-19 returned 404 for `fold-agent`, but the
release task must verify availability immediately before publishing. The old
`packages/fold-skills` package has been removed; `fold-agent` is the single
publishable agent package and contains the skill files directly.

## Golden Cold-Agent Command

Copied agent handoffs should lead with one version-pinned package-runner command:

```bash
npx --yes fold-agent@0.1.0 bootstrap \
  --room "fold:v1:..." \
  --alias launch \
  --output ./fold-project \
  --json
```

`bootstrap` should:

1. run from `npx` without a repo checkout;
2. install or update the bundled Fold skill from the `fold-agent` package;
3. resume the encrypted room;
4. save the alias in `.fold/rooms.json`;
5. export accepted Markdown files to the requested output directory;
6. print redacted next commands using the same pinned `npx --yes
   fold-agent@0.1.0 ...` prefix.

Routine `bootstrap` output must never print room tokens, `#key=` fragments, or
raw `.fold/rooms.json` contents.

## Repeat-Agent Path

Repeat agents can keep using `npx`:

```bash
npx --yes fold-agent@0.1.0 resume --room launch --output ./fold-project --json
```

Or install the CLI locally/global when their environment allows persistent
tools:

```bash
npm install -g fold-agent@0.1.0
fold-agent skill --all
fold-agent resume --room launch --output ./fold-project --json
```

The handoff should prefer pinned `npx` because it:

- avoids the `/usr/bin/fold` collision;
- avoids requiring global writes;
- is cacheable across repeated uses;
- fixes the CLI/protocol version for that handoff.

## Workspace And Package Wiring

Update the root workspace list before adding package verification commands:

```json
{
  "workspaces": [
    "apps/web",
    "packages/fold-agent"
  ]
}
```

Add one package:

```text
packages/fold-agent/
```

Do not use a broad `packages/*` workspace glob. The target design has one
publishable package for this feature: `fold-agent`.

The implementation should keep TypeScript build output separate from source:

```text
packages/fold-agent/
  package.json
  tsconfig.json
  bin/fold-agent.js
  dist/
  skills/fold/
```

The root repo may keep `skills/fold` as the editable source of truth, but all
package copies must be mechanical build/sync outputs with drift tests.

## fold-agent Package Contract

Recommended package metadata:

```json
{
  "name": "fold-agent",
  "version": "0.1.0",
  "description": "Fold CLI for encrypted Markdown project rooms used by humans and agents.",
  "type": "module",
  "license": "MIT",
  "engines": {
    "node": ">=22"
  },
  "bin": {
    "fold-agent": "./bin/fold-agent.js"
  },
  "files": [
    "bin",
    "dist",
    "skills/fold",
    "README.md"
  ],
  "publishConfig": {
    "access": "public"
  },
  "dependencies": {
    "@stricli/core": "...",
    "prosemirror-markdown": "...",
    "prosemirror-model": "...",
    "ws": "...",
    "yjs": "..."
  }
}
```

`bin/fold-agent.js` must have a Node shebang and executable mode in the packed
npm artifact.

The implementation should decide whether to bundle runtime dependencies or keep
them as normal npm dependencies. Normal dependencies are preferred first because
they are simpler and inspectable.

The package must not include:

- `apps/web/.next`;
- old skill-only package files;
- local `.fold` metadata;
- `data/`;
- spikes and generated reports;
- repository-only plans and docs;
- test fixtures not required by the CLI.

Avoid requiring `tsx` for the published package. `fold-agent` should execute
compiled JavaScript.

Bundled skill layout:

```text
packages/fold-agent/
  skills/fold/
    SKILL.md
    agents/openai.yaml
    references/cli.md
    references/security.md
    references/workflow.md
```

The primary cold-agent path is `fold-agent bootstrap`. If standards-compatible
skill tooling later supports installing a skill from inside an npm package, that
can be added as an optional path, but it is not required for this plan.

## CLI Command Contract

### `fold-agent bootstrap`

Usage:

```bash
fold-agent bootstrap --room <token-or-url-or-alias> --alias <alias> --output <dir> [--json]
```

Behavior:

- accepts the same room references as `resume`;
- requires `--alias` when `--room` is a `fold:v1:` token or keyed room URL;
- rejects `--alias` when `--room` is an already-saved alias;
- installs or updates the skill by default;
- calls `resume` internally;
- prints next commands for `post`, `propose`, `requests`, `comments`, `reply`,
  and `proposals`;
- uses `npx --yes fold-agent@<version> ...` next-command prefixes by default;
- allows installed CLI users to pass `--next-command-prefix fold-agent` if a
  later implementation needs that escape hatch.

Flags:

```text
--room <room>             Room alias, URL, or fold:v1 token.
--alias <alias>           Local alias to save for secret-bearing references.
--output <dir>            Directory for accepted Markdown project files.
--skip-skill              Do not install/update the skill.
--skill-scope <scope>     project | global | all. Default: all.
--next-command-prefix     Override printed next-command prefix.
--json                    Stable redacted JSON output.
```

### `fold-agent skill`

Usage:

```bash
fold-agent skill [--scope project|global] [--all] [--json]
fold-agent skill status [--json]
fold-agent skill update [--scope project|global] [--all] [--json]
```

Behavior:

- locates the bundled `skills/fold` directory inside the installed
  `fold-agent` package;
- copies `skills/fold` into target skill locations;
- is idempotent;
- writes `.fold-skill-version` and `.fold-skill-manifest.json`;
- prints exactly where it installed, skipped, or updated the skill;
- explains when a host may not auto-load that skill location;
- never modifies unrelated skills;
- never installs global executables.

Initial scope mapping:

```text
project: ./.agents/skills/fold
global:  ~/.agents/skills/fold and ~/.codex/skills/fold
all:     project + global
```

Overwrite/update rules:

- If target is missing, copy the skill.
- If target has the same managed version and manifest hash, skip.
- If target has no Fold-managed manifest, skip by default and report
  `unmanaged_existing`.
- If target has a newer managed version, skip by default and report
  `newer_managed`.
- If target has local modifications relative to its manifest, skip by default
  and report `modified_existing`; require a future `--force` flag to overwrite.
- If target has an older managed version and no local modifications, replace
  atomically.
- Write to a temp directory and rename into place to avoid partial installs.

## JSON Output Contracts

`--json` mode must write exactly one JSON object to stdout. Human progress and
warnings go to stderr.

### `fold.bootstrap.result.v1`

Required fields:

```json
{
  "schema": "fold.bootstrap.result.v1",
  "ok": true,
  "package": {
    "name": "fold-agent",
    "version": "0.1.0"
  },
  "skill": {
    "schema": "fold.skill.result.v1",
    "ok": true,
    "package": {
      "name": "fold-agent",
      "version": "0.1.0"
    },
    "scope": "all",
    "installed": [],
    "updated": [],
    "skipped": []
  },
  "resume": {
    "schema": "fold.resume.result.v1"
  },
  "nextCommands": {
    "post": "npx --yes fold-agent@0.1.0 post ...",
    "propose": "npx --yes fold-agent@0.1.0 propose ...",
    "requests": "npx --yes fold-agent@0.1.0 requests ...",
    "comments": "npx --yes fold-agent@0.1.0 comments ..."
  }
}
```

`resume` may embed the existing redacted resume result or a narrowed redacted
subset. It must not include room tokens, keyed room URLs, raw client keys, or
`.fold/rooms.json` contents.

### `fold.skill.result.v1`

Required fields:

```json
{
  "schema": "fold.skill.result.v1",
  "ok": true,
  "package": {
    "name": "fold-agent",
    "version": "0.1.0"
  },
  "scope": "all",
  "installed": [
    {
      "path": "/abs/path/.agents/skills/fold",
      "version": "0.1.0",
      "host": "agents",
      "autoLoadKnown": false
    }
  ],
  "updated": [],
  "skipped": []
}
```

`skipped` entries should include `reason`, such as `same_version`,
`unmanaged_existing`, `newer_managed`, `modified_existing`,
`target_unavailable`, or `permission_denied`.

## Handoff Copy

Agent handoff should include a concise cold-agent section:

```text
Cold agent setup

Run the pinned Fold agent CLI. It installs the Fold skill locally and resumes
the encrypted project:

npx --yes fold-agent@0.1.0 bootstrap --room "fold:v1:..." --alias launch --output ./fold-project --json

Do not use /usr/bin/fold. That is the Unix text wrapper, not Fold.
The Fold skill teaches agent behavior; fold-agent performs encrypted room
operations.
```

Then list next commands using the same package version:

```bash
npx --yes fold-agent@0.1.0 post ./fold-project/NEW_FILE.md --room launch --path NEW_FILE.md --json
npx --yes fold-agent@0.1.0 propose ./fold-project --room launch --title "Describe the change" --json
npx --yes fold-agent@0.1.0 requests --room launch --json
npx --yes fold-agent@0.1.0 comments --room launch --json
```

Browser join and CLI tokens should stay distinct:

- browser join uses `/room/:roomId#key=...`;
- agent CLI join uses `fold:v1:` tokens;
- do not paste `fold:v1:` tokens into the browser join box.

## Source Of Truth And Drift Tests

Editable skill source:

```text
skills/fold/
```

Mechanical copies:

```text
packages/fold-agent/skills/fold/
apps/web/public/.well-known/fold/agent-skill.md
```

The public well-known skill may remain a rendered/single-file copy, but command
guidance must stay aligned.

Add or update drift tests so they compare:

- root skill source;
- `fold-agent` bundled skill copy;
- public well-known skill;
- CLI invite text;
- web handoff text.

The tests should assert:

- handoffs use `npx --yes fold-agent@<version> bootstrap`;
- fresh files use `post`, existing files use `propose`;
- skill files are bundled in `fold-agent`, while `fold-agent skill` only copies
  policy files into agent skill directories;
- `/usr/bin/fold` warning remains present;
- no stale `@fold/agent`, `@fold/agent-skills`, `fold-agent-skills`, or
  old skill-only package primary guidance remains after migration.

## Versioning

The handoff should pin exact versions:

```bash
npx --yes fold-agent@0.1.0 bootstrap ...
```

The hosted web app should read the printed package version from a single source
of truth rather than hardcoding it in multiple files. A small shared constant is
acceptable until package metadata can be imported safely.

Future stronger supply-chain checks can add package integrity:

```text
Expected package: fold-agent@0.1.0
Expected integrity: sha512-...
```

## Security Rules

- Treat room URLs, `fold:v1:` tokens, keys, and `.fold/rooms.json` as secrets.
- `bootstrap`, `resume`, `post`, `propose`, `requests`, and `comments` JSON
  outputs stay redacted.
- Only explicit create, publish, room profile, and invite workflows may emit
  decryption-capable room URLs, tokens, or keys.
- `fold-agent skill` prints install paths, not secret room data.
- `bootstrap` must not send URL fragment keys to server APIs.
- Tests must assert routine JSON does not contain `fold:v1:`, `#key=`, `token`,
  `roomSecret`, or raw `.fold/rooms.json` content.

## Migration From Current State

1. Add `packages/fold-agent` to root workspaces.
2. Create `packages/fold-agent` as the executable CLI package with bundled
   `skills/fold`.
3. Add `fold-agent bootstrap` and `fold-agent skill` commands.
4. Remove the old `packages/fold-skills` compatibility package.
5. Update CLI invite, web handoff, public skill, README, and docs to lead with
   `npx --yes fold-agent@<version> bootstrap ...`.
6. Keep development fallback copy for unreleased builds:

   ```bash
   npm run --silent cli -- bootstrap ...
   ```

   but do not present that as the primary cold-agent path after the package is
   published.

## Verification Plan

### Package Verification

```bash
npm run check
npm pack --dry-run --json --workspace=fold-agent
```

Confirm:

- `fold-agent` contains compiled runtime and `bin/fold-agent.js`;
- `fold-agent` contains the bundled `skills/fold` directory;
- the package does not contain `.fold`, `data`, `.next`, spikes, or repo-only
  docs.

### Local Cold-Agent Smoke

Run from a temp directory with no Fold repo and no installed Fold skill:

```bash
npx --yes fold-agent@file:/path/to/packages/fold-agent bootstrap \
  --room "fold:v1:..." \
  --alias launch \
  --output ./fold-project \
  --json
```

Verify:

- skill files install idempotently;
- one-file rooms export to `./fold-project/README.md`;
- `post` works for fresh files;
- `propose` rejects fresh files and works for existing files;
- routine JSON stays redacted;
- repeat resume works using the saved alias.

### Hosted Handoff Smoke

Against Railway or another hosted Fold origin:

1. create a room from the web;
2. copy the agent handoff;
3. run only the copied `npx --yes fold-agent@<version> bootstrap ...` command
   from a clean temp directory;
4. post a fresh file;
5. propose an edit to an existing file;
6. verify the web UI shows the posted file and proposal.

### Subagent Forward Test

Spawn a fresh subagent with only:

- the copied handoff;
- no Fold source-code context;
- no installed Fold skill.

Success means the agent can bootstrap, resume, inspect requests/comments, post
fresh files, propose existing-file edits, and explain secret handling without
cloning the full Fold repository.

## Open Questions

- Is `fold-agent` still available when publishing?
- Should `fold-agent` also expose a secondary `fold` binary for users who want
  it, or should the published package avoid that collision entirely?
- Should `bootstrap` install skills to `all` by default, or project scope first
  with global as an explicit opt-in?
- Which additional agent hosts should be detected after Codex-style
  `~/.codex/skills` and generic `~/.agents/skills`?
- Is any separate compatibility package needed later? Current answer: no.

## Non-Goals

- Do not publish under the unscoped npm name `fold`.
- Do not require agents to clone the Fold repo for normal room participation.
- Do not make skill installation a substitute for encrypted room state.
- Do not add account authorization, billing, or hosted SaaS control plane work.
- Do not change the E2EE room model.
