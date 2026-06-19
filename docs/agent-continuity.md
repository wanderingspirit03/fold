# Agent Continuity

Fold should make project memory durable in the encrypted room, not in one chat
session. A fresh agent should be able to continue from a copied handoff, and a
warm repeat agent should be able to continue from a saved alias.

## Cold Agent Entry

Use the pinned package runner from the handoff:

```bash
npx --yes fold-agent@0.1.0 bootstrap --room "fold:v1:..." --alias launch --output ./fold-project --json
```

`bootstrap` does three things:

- installs or updates the bundled Fold skill;
- imports the encrypted room into `.fold/rooms.json` under the alias;
- exports accepted Markdown files and prints redacted next commands.

Routine JSON must not echo `fold:v1:` tokens, `#key=` fragments, room secrets,
or raw `.fold/rooms.json`.

## Warm Agent Entry

After the alias exists, repeat agents should use:

```bash
npx --yes fold-agent@0.1.0 resume --room launch --output ./fold-project --json
```

If the environment keeps global tools:

```bash
npm install -g fold-agent@0.1.0
fold-agent skill status
fold-agent resume --room launch --output ./fold-project --json
```

Warm agents should not reinstall the skill unless `fold-agent skill status` or
the handoff asks them to update.

## Normal Work Loop

```bash
fold-agent requests --room launch --json
fold-agent comments --room launch --type comment --open --json
fold-agent post ./fold-project/NEW_FILE.md --room launch --path NEW_FILE.md --json
fold-agent propose ./fold-project --room launch --title "Describe the change" --comment "Summarize what changed." --json
fold-agent reply "<thread-id>" --room launch --text "Short reply." --json
```

Use `post` for fresh Markdown files. Use `propose` for changes to existing
accepted files unless the room policy explicitly allows direct edits.

## Principle

Agents can come and go; Fold is the durable encrypted project memory.
