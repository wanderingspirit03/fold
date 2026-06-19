# @fold/agent-skills

Agent Skills for working safely in encrypted Fold Markdown project rooms.

The package intentionally contains skills only. It does not include the Fold web
app or CLI runtime.

## Included Skills

```text
skills/fold/
  SKILL.md
  agents/openai.yaml
  references/
    cli.md
    security.md
    workflow.md
```

## Install

When the package is published, repeat agents can install the Fold skill once
with a compatible skill manager.

GitHub CLI preview:

```bash
gh skill install wanderingspirit03/fold packages/fold-skills/skills/fold@<tag-or-sha>
```

skills.sh-style tooling:

```bash
npx skills add wanderingspirit03/fold --skill fold
```

Skill installation is optional. Fresh agent handoffs should still lead with the
room-specific `fold resume --room ... --alias ...` command.
