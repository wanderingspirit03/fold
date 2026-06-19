# Fold CLI Reference

Development wrapper inside the Fold repo:

```bash
npm run --silent cli -- <command>
```

Do not use `/usr/bin/fold`. That is the Unix text-wrapping command, not Fold.

Primary fresh-agent command:

```bash
npx --yes fold-agent@0.1.0 bootstrap --room "fold:v1:..." --alias "launch" --output ./fold-project --json
```

Installed CLI repeat command:

```bash
fold-agent resume --room "launch" --output ./fold-project --json
```

Bundled skill commands:

```bash
fold-agent skill
fold-agent skill status
fold-agent skill update
```

Do not use `npm install -g fold` or `npx fold`; the public unscoped npm package
name is not Fold's CLI package. Use the pinned `fold-agent` package-runner
command from the handoff.
