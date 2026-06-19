# Fold CLI Reference

Development wrapper inside the Fold repo:

```bash
npm run --silent cli -- <command>
```

Primary fresh-agent command:

```bash
fold resume --room "fold:v1:..." --alias "launch" --output ./fold-project --json
```

Installed CLI repeat command:

```bash
fold resume --room "launch" --output ./fold-project --json
```

Optional repeat-agent skill install paths, when the host supports them:

```bash
gh skill install wanderingspirit03/fold packages/fold-skills/skills/fold@<tag-or-sha>
npx skills add wanderingspirit03/fold --skill fold
```

Do not use `npm install -g fold` or `npx fold`; the public unscoped npm package
name is not Fold's CLI package. Use only the scoped package-runner command once
Fold publishes one and the handoff names it explicitly.
