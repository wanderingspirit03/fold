# Plan 014: Make Fold Deployment Cloud-Agnostic And Production-Alpha Safe

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report;
> do not improvise.
>
> **Drift check (run first)**: `git diff --stat 3bbf94e..HEAD -- PLAN.md README.md docs package.json Dockerfile docker-compose.yml .env.example plans/README.md src/deploy src/hosted src/server src/cli apps/web/lib apps/web/app`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition unless the change already implements
> the relevant step cleanly.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none
- **Category**: dx, docs, security, direction
- **Planned at**: commit `3bbf94e`, 2026-06-15

## Why this matters

Fold already has the right basic hosted shape: one Node process serves the
Next.js web app and encrypted append-log WebSocket/API from the same origin.
However, the deploy story is still described as generic alpha guidance, and a
new GitHub user can easily miss the real production-alpha requirements:
persistent storage, a public HTTPS URL, WebSockets, and exactly one running
writer process. This plan makes Fold cloud-agnostic by defining Fold's own
deployment contract first, then documenting Railway, Render, Fly/VPS, Docker
Compose, and local sharing as recipes that all satisfy the same contract.

This is not a plan to claim full production security. It should make Fold
safe and understandable for hosted alpha sharing with humans while preserving
the existing E2EE constraints and clearly naming the remaining production
blockers.

## Current state

- `PLAN.md` defines Fold's product target as an OSS, self-hostable encrypted
  Markdown project room. Its self-hosting goal says users should be able to
  deploy without heavy infrastructure, and it still lists production-grade
  durability, compaction, fork/truncation detection, and related hardening as
  open work.
- `README.md` currently says Fold is an early working OSS alpha and "not
  production-hardened yet". It has a "Fastest Hosted Path" using `npm install`,
  `npm run build`, and `npm start`, plus `FOLD_PUBLIC_URL` and `FOLD_DATA_DIR`.
- `docs/deploy.md` already describes the same-origin hosted shape,
  requirements, generic Node hosts, Docker, split web/sync hosts, browser
  created rooms, and E2EE deployment caveats. It mentions Railway alongside
  Render, Fly.io, Northflank, DigitalOcean App Platform, VPS, and container
  hosts, but it does not yet provide provider-specific recipes or a hard
  deploy contract.
- `package.json` verification baseline is:

```json
"check": "npm test && npm run typecheck && npm run spike:e2ee && npm run spike:document-model && npm run spike:document-model:report && npm run web:typecheck && npm run web:build"
```

- `src/hosted/entrypoint.ts` already binds to a configurable host and cloud
  port, defaults the append-log directory, and logs the public URL and store:

```ts
// src/hosted/entrypoint.ts:32-37
const options: HostedCliOptions = {
  host: env.HOST ?? '0.0.0.0',
  port: hostedPortFromEnv(env, 3000),
  dataDirectory: resolve(cwd, env.FOLD_DATA_DIR ?? 'data/append-log'),
  webDirectory: resolve(cwd, 'apps/web'),
};
```

```ts
// src/hosted/entrypoint.ts:133-138
const publicOrigin = resolvePublicOrigin({
  defaultUrl: `http://127.0.0.1:${options.port}`,
});
console.log(`fold hosted server listening on ${options.host}:${options.port}`);
console.log(`public app/sync URL: ${publicOrigin.appUrl}`);
console.log(`append-log store: file (${options.dataDirectory})`);
```

- `src/deploy/public-origin.ts` already makes `FOLD_PUBLIC_URL` the portable
  setting and treats provider variables as fallbacks:

```ts
// src/deploy/public-origin.ts:17-32
export function resolvePublicOrigin(options: PublicOriginOptions): PublicOriginConfig {
  const env = options.env ?? process.env;
  const appUrl = options.appUrl
    ?? options.serverUrl
    ?? options.syncUrl
    ?? env.FOLD_PUBLIC_APP_URL
    ?? env.FOLD_PUBLIC_URL
    ?? publicOriginFromProviderEnv(env)
    ?? options.defaultUrl;
  const syncUrl = options.syncUrl
    ?? options.serverUrl
    ?? options.appUrl
    ?? env.FOLD_PUBLIC_SYNC_URL
    ?? env.FOLD_PUBLIC_URL
    ?? publicOriginFromProviderEnv(env)
    ?? options.defaultUrl;
```

```ts
// src/deploy/public-origin.ts:45-53
export function publicOriginFromProviderEnv(env: Record<string, string | undefined> = process.env): string | undefined {
  return firstPresent(
    env.RENDER_EXTERNAL_URL,
    env.URL,
    env.DEPLOY_PRIME_URL,
    withHttps(env.RAILWAY_PUBLIC_DOMAIN),
    withHttps(env.VERCEL_URL),
    withHttps(env.FLY_APP_NAME ? `${env.FLY_APP_NAME}.fly.dev` : undefined),
  );
}
```

- `src/server/append-log.ts` is a file-backed append log with synchronous load
  and append. It is fine for a single hosted alpha instance but is not
  multi-process safe:

```ts
// src/server/append-log.ts:95-108
append(roomId: string, update: IncomingEncryptedUpdate): EncryptedUpdateRecord {
  const room = this.rooms.get(roomId) ?? [];
  const record: EncryptedUpdateRecord = {
    roomId,
    seq: room.length + 1,
    senderId: update.senderId,
    nonce: update.nonce,
    ciphertext: update.ciphertext,
  };

  room.push(record);
  this.rooms.set(roomId, room);
  appendFileSync(this.fileForRoom(roomId), `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}
```

- `src/server/append-log.ts` exposes `/health`, update fetch, update append,
  and status routes. It currently allows CORS broadly and has no account auth
  or write authorization:

```ts
// src/server/append-log.ts:248-264
if (request.method === 'OPTIONS') {
  response.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
  });
  response.end();
  return true;
}

const url = new URL(request.url ?? '/', 'http://localhost');

if (request.method === 'GET' && url.pathname === '/health') {
  sendJson(response, 200, this.health());
  return true;
}
```

- `Dockerfile` already supports the portable runtime shape:

```dockerfile
# Dockerfile:12-20
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV FOLD_DATA_DIR=/data/append-log

EXPOSE 3000
VOLUME ["/data"]

CMD ["npm", "start"]
```

- `docker-compose.yml` already mounts a durable local volume and sets the same
  env vars:

```yaml
# docker-compose.yml:6-12
environment:
  PORT: "3000"
  FOLD_PUBLIC_URL: "${FOLD_PUBLIC_URL:-http://localhost:3000}"
  FOLD_DATA_DIR: "/data/append-log"
volumes:
  - fold-append-log:/data/append-log
restart: unless-stopped
```

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `npm install` | exit 0 |
| Unit tests | `npm test` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Web typecheck | `npm run web:typecheck` | exit 0 |
| Web build | `npm run web:build` | exit 0 |
| Full gate | `npm run check` | exit 0 |
| Docker config | `docker compose config` | exit 0 if Docker Compose is available |
| Hosted smoke | `npm start -- --port 0 --data ./data/deploy-smoke` | Starts the hosted server; stop it with Ctrl-C after confirming startup logs |

Do not run provider CLIs or mutate real cloud resources unless the operator
explicitly asks for that in a separate task.

## Suggested executor toolkit

- If an `env-var-guard` skill is available, use it before touching
  `.env.example`, deployment env docs, or adding runtime env variables.
- If a `github` publishing skill is available, do not use it here unless the
  operator explicitly asks to create issues or push branches.

## Scope

**In scope**:

- `PLAN.md`
- `README.md`
- `docs/deploy.md`
- New docs under `docs/`, for example:
  - `docs/deploy-railway.md`
  - `docs/deploy-render.md`
  - `docs/deploy-docker.md`
  - `docs/deploy-vps.md`
  - `docs/production-readiness.md`
- `.env.example` if it exists, or a new `.env.production.example`
- `Dockerfile`
- `docker-compose.yml`
- `package.json` only for non-provider-specific smoke/check scripts
- `src/deploy/*`
- `src/hosted/*`
- `src/server/append-log.ts` and `src/server/append-log.test.ts` only for
  health/readiness metadata or deploy-safety diagnostics
- `apps/web/lib/deployment.ts` and invite/local-url warning surfaces only if
  needed to align browser-created room sharing with the deployment contract

**Out of scope**:

- Account auth, teams, billing, hosted SaaS control plane, or OAuth.
- Replacing the file append log with Postgres, SQLite, S3/R2, Durable Objects,
  or another durable store.
- Multi-instance write safety beyond explicit single-instance validation and
  documentation.
- Hash chains, signed checkpoints, malicious-server fork/truncation proofs,
  key rotation, revocation, or ACLs.
- Rich editor changes, onboarding UI changes, visual redesign, or marketing
  landing pages.
- Any provider-specific code path that makes Railway, Render, Fly, or another
  host required for core Fold behavior.

## Git workflow

- Branch: `advisor/014-cloud-agnostic-deploy`
- Commit style: match the existing concise imperative style, for example
  `Polish Fold web onboarding` or `Harden encrypted room workflows`.
- Do not push or open a PR unless the operator instructs you to.

## Steps

### Step 1: Update product direction before architecture changes

Edit `PLAN.md` first. Add a concise "Deployment Contract" section near the
self-hosting/deployment roadmap that defines the provider-neutral runtime:

- long-running Node process;
- binds to `0.0.0.0`;
- reads `PORT`;
- serves web, HTTP sync, and WebSocket sync from one same-origin process by
  default;
- requires `FOLD_PUBLIC_URL` for shared hosted links;
- requires `FOLD_DATA_DIR` on persistent storage for room history;
- supports split web/sync only as an advanced path;
- requires one running instance with the current file append-log store;
- exposes `/health`.

Also add a short "Not yet production-complete" note that keeps the existing
language honest: account auth, append authorization, multi-writer durability,
hash-chain/fork proofs, compaction, key rotation, and revocation remain future
plans.

**Verify**: `rg -n "Deployment Contract|FOLD_PUBLIC_URL|FOLD_DATA_DIR|single instance|/health" PLAN.md` prints matches for all five concepts.

### Step 2: Add runtime deployment validation without provider lock-in

Create a small provider-neutral validation module under `src/deploy/`, for
example `src/deploy/runtime-config.ts`. It should not call provider APIs. It
should inspect only env/options and return structured diagnostics.

The module should expose functions similar to:

- `isProductionRuntime(env)` — true when `NODE_ENV === 'production'`.
- `isLocalOnlyUrl(url)` — true for localhost, `127.0.0.1`, `::1`, and obvious
  private LAN hosts.
- `validateHostedRuntime({ env, dataDirectory, publicOrigin })` — returns
  warnings/errors such as:
  - production runtime missing explicit `FOLD_PUBLIC_URL`;
  - public origin fell back to localhost/default;
  - `FOLD_DATA_DIR` missing in production;
  - data directory resolves to the default repo-local `data/append-log` in
    production;
  - provider fallback was used, with a warning that `FOLD_PUBLIC_URL` is still
    the portable contract;
  - current file append-log runtime supports one instance only.

Do not fail local development or local Docker Compose. The current Docker image
sets `NODE_ENV=production`, and `docker-compose.yml` intentionally defaults
`FOLD_PUBLIC_URL` to `http://localhost:3000` for a same-machine self-hosting
path. Preserve that path by distinguishing local-only deployments from shared
cloud deployments:

- missing `FOLD_DATA_DIR` in production is an error;
- falling all the way back to the default `http://127.0.0.1:<port>` in
  production is an error because it means no public URL was configured;
- an explicit local-only `FOLD_PUBLIC_URL` in production is allowed only as a
  local/self-host mode and must log a loud "not shareable with other machines"
  warning;
- provider fallback URLs are allowed but should warn that explicit
  `FOLD_PUBLIC_URL` is the portable contract;
- do not add a provider-specific env var to solve this.

Only add an explicit escape hatch such as
`FOLD_DEPLOYMENT_ACCEPT_ALPHA_RISK=1` if the above rules cannot preserve both
cloud safety and local Docker Compose. If you add that escape hatch, document it
loudly and add it to `.env.production.example`. Do not add more env vars than
needed.

Add tests in `src/deploy/runtime-config.test.ts`. Model the style after
`src/deploy/public-origin.test.ts`.

**Verify**: `npm test -- src/deploy` exits 0 and includes the new validation tests.

### Step 3: Wire validation into hosted startup logs

Update `src/hosted/entrypoint.ts` to use the new validation module after
`resolvePublicOrigin` is known and before accepting production traffic.

Expected behavior:

- Local/dev defaults and local Docker Compose still work without fatal errors.
- In production, invalid shared-deployment config exits before listening or
  clearly before reporting the server ready.
- Startup logs show:
  - bind address and port;
  - public app/sync URL;
  - append-log data directory;
  - health endpoint path;
  - whether the public origin came from explicit env, provider fallback, or
    default;
  - a clear warning that the current file append-log supports one running
    instance.

Prefer structured helper functions over embedding large validation logic inside
`runHostedCli`. Keep existing CLI flags working: `--host`, `--port`, `--data`,
and `--web-dir`.

Update `src/hosted/entrypoint.test.ts` to cover env/default parsing and any new
startup validation helper that can be tested without starting a real Next app.

**Verify**: `npm test -- src/hosted src/deploy` exits 0.

### Step 4: Improve `/health` into a useful deploy smoke endpoint

Keep `/health` non-sensitive. Add enough metadata to support cloud health
checks and human troubleshooting without leaking room ids, room counts, keys,
tokens, file names, or absolute secrets.

Acceptable additions:

- store kind;
- whether the store is file-backed;
- whether the file-backed data directory is configured;
- service/version/uptime/timestamp, which already exist;
- maybe a generic `deployment.singleInstanceRequired: true`.

Avoid adding absolute filesystem paths to `/health`; paths may leak host
structure. Startup logs can include paths for the deploy operator.

Update `src/server/append-log.test.ts` for the new health payload.

**Verify**: `npm test -- src/server/append-log.test.ts` exits 0.

### Step 5: Rework docs around the Fold deployment contract

Refactor `docs/deploy.md` so the first section is the provider-neutral contract,
not a list of hosts. It should explain that any host works if it provides:

- Node 22 or container runtime;
- long-lived process;
- HTTPS;
- WebSocket upgrades;
- persistent disk/volume;
- one running instance for the current file append log;
- `PORT`, `FOLD_PUBLIC_URL`, and `FOLD_DATA_DIR`.

Keep split web/sync deployment as an advanced section. Make clear that
serverless-only hosting is not the recommended path for the current alpha.

Add a small deploy matrix:

| Path | Best for | Required storage | Notes |
| --- | --- | --- | --- |
| Docker Compose | local self-host | named Docker volume | local unless exposed |
| Railway | easiest hosted alpha | attached volume | single replica |
| Render/Northflank/DigitalOcean App Platform | generic Node/container cloud | persistent disk/volume | same env contract |
| Fly/VPS | technical self-host | mounted volume | reverse proxy/HTTPS |
| Split web/sync | advanced | sync host only | build-time browser sync URL |

**Verify**: `rg -n "Deployment Contract|single instance|persistent|WebSocket|FOLD_PUBLIC_URL|FOLD_DATA_DIR|serverless|split" docs/deploy.md` prints matches for all concepts.

### Step 6: Add provider recipes without making providers special in code

Create concise provider docs under `docs/`. Suggested files:

- `docs/deploy-railway.md`
- `docs/deploy-render.md`
- `docs/deploy-docker.md`
- `docs/deploy-vps.md`

Each file must start from the same contract and include:

- build command;
- start command;
- required env vars;
- storage/volume instruction;
- WebSocket/HTTPS note;
- health check path `/health`;
- single-instance warning;
- how to create the first hosted room;
- how to copy a human invite;
- how to copy an agent invite;
- local-only URL warning;
- backup/export caveat.

Do not hard-code provider secrets or account-specific values. For provider
settings that may change over time, phrase them as "set the provider's public
HTTPS domain as `FOLD_PUBLIC_URL`" instead of relying on a brittle exact UI
path. If provider docs need exact current UI labels, the executor must browse
the official provider docs at implementation time and cite them in the new doc.

**Verify**: `rg -n "FOLD_PUBLIC_URL|FOLD_DATA_DIR|/health|single instance|human invite|agent invite|WebSocket" docs/deploy-*.md` prints matches in every new provider file.

### Step 7: Make the README choose between local, cloud, and Docker quickly

Update `README.md` so a GitHub user can immediately choose:

- "Run locally" for development on one machine;
- "Share with humans from the cloud" using the provider-neutral contract;
- "Self-host with Docker Compose";
- "Use the CLI with a hosted Fold URL".

Preserve the existing product language: projects, files, humans, agents,
private encrypted Markdown rooms. Do not position Fold as a clone or blend of
other products.

The README must make this concrete:

- `localhost` links are for the same machine only;
- other humans need cloud, a public tunnel, or a correctly exposed LAN/VPS URL;
- the `#key` fragment is secret client-side key material;
- the server stores encrypted room records plus plaintext routing metadata;
- Fold remains alpha and not security-audited.

**Verify**: `rg -n "Run locally|cloud|Docker Compose|localhost|#key|plaintext routing metadata|alpha" README.md` prints matches for all concepts.

### Step 8: Add or tighten production env examples

If `.env.example` exists, update it. If it does not, create
`.env.production.example`.

The example should include only portable settings:

```bash
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
FOLD_PUBLIC_URL=https://your-fold.example
FOLD_DATA_DIR=/persistent/fold/append-log
```

Add optional split deployment variables only in a commented section:

```bash
# FOLD_PUBLIC_APP_URL=https://fold-web.example
# FOLD_PUBLIC_SYNC_URL=https://fold-sync.example
# NEXT_PUBLIC_FOLD_SYNC_URL=https://fold-sync.example
```

If Step 2 introduced an explicit alpha-risk override, include it commented out
with wording that says it should not be used for shared deployments.

**Verify**: `rg -n "FOLD_PUBLIC_URL|FOLD_DATA_DIR|NEXT_PUBLIC_FOLD_SYNC_URL" .env.example .env.production.example` exits 0. If only one file exists, run the command only against that file.

### Step 9: Add a deployment smoke script or document an existing one

Prefer a small script under `scripts/`, for example
`scripts/hosted-deployment-smoke.ts`, that can verify a running hosted instance
without needing a real provider account.

The smoke should:

- accept a base URL;
- fetch `/health`;
- assert JSON `ok: true`;
- optionally create a temporary room through existing CLI/server APIs only if
  it can do so without printing secrets by default;
- never write to production data unless the operator explicitly passes a
  `--write` flag.

If a new script is too much for this plan, document a read-only manual smoke in
`docs/deploy.md` instead:

```bash
curl https://your-fold.example/health
```

Keep write smokes separate and clearly labeled because they create room state
and may emit secret-bearing invite material. If documenting a write smoke, use
wording like:

```bash
# Write smoke: creates room data and prints secret-bearing invite output.
npm run --silent cli -- room create --alias smoke --json
npm run --silent cli -- room invite smoke --for human
```

If adding a script, wire it into `package.json` as a targeted command, not into
`npm run check`, because it depends on a running server.

**Verify**: script path, if added, passes `npm run typecheck`; docs manual smoke
contains `/health`; any `room create` smoke is labeled as writeful and
secret-bearing.

### Step 10: Update completed-plan archive index carefully

The existing `plans/README.md` says the directory is a completed archive. Update
it without pretending old plans are active again:

- keep the historical completed table intact;
- add a new section named "New Active Plans" if it does not exist;
- add row `014 | Make Fold deployment cloud-agnostic and production-alpha safe | P1 | L | - | TODO` if it is not already present;
- after implementation and fresh-review verification are complete, update the
  row to `DONE`;
- add a dependency note that this plan has no dependency on the old archive but
  should preserve the security and secret-redaction decisions already landed.

**Verify**: `rg -n "New Active Plans|014|cloud-agnostic|DONE" plans/README.md` prints matches.

## Test plan

- Add unit tests for deployment runtime validation in `src/deploy`.
- Update hosted entrypoint tests for validation/loggable deployment summary
  behavior.
- Update append-log health tests if `/health` shape changes.
- Run targeted tests first:

```bash
npm test -- src/deploy src/hosted src/server/append-log.test.ts
```

- Run full verification before final handoff:

```bash
npm run check
```

- If Docker is available, run:

```bash
docker compose config
```

- If the executor adds a deployment smoke script, run it against a local hosted
  server before reporting completion. Use a temporary data directory under
  `./data/` or another ignored path, and stop the server afterward.
- Before marking this plan done, ask a separate fresh reviewer/subagent to
  verify the implementation against this plan and the repo's `AGENTS.md`
  requirements.

## Done criteria

All must hold:

- [ ] `PLAN.md` contains a provider-neutral deployment contract.
- [ ] Hosted startup validates production deployment configuration without
      provider lock-in.
- [ ] Local development startup still works with defaults.
- [ ] Production startup refuses missing durable storage and implicit localhost
      fallbacks, while explicit local Docker Compose URLs remain allowed with a
      clear "local-only, not shareable" warning.
- [ ] `/health` remains non-sensitive and useful for provider health checks.
- [ ] `README.md` gives clear local, cloud, and Docker paths for GitHub users.
- [ ] `docs/deploy.md` is contract-first and provider-neutral.
- [ ] Provider recipes exist for Railway, generic Node/container hosts, Docker,
      and VPS/Fly-style hosts without making any provider mandatory.
- [ ] Docs explain human invite sharing, agent invite sharing, local-only URL
      limits, persistent storage, backups, and the current alpha threat model.
- [ ] New or changed env vars are documented in env examples and deploy docs.
- [ ] `npm run check` exits 0.
- [ ] `docker compose config` exits 0, or Docker unavailability is reported.
- [ ] A separate fresh reviewer/subagent has verified the implementation.
- [ ] `plans/README.md` has a `DONE` row for this plan unless a reviewer asked
      the executor not to update the index.

## STOP conditions

Stop and report back instead of improvising if:

- The drift check shows deployment-related files changed in a way that already
  supersedes this plan.
- Runtime validation appears to require provider-specific SDKs or cloud API
  calls.
- Correct production validation would require implementing auth, ACLs, a new
  database, or multi-instance append-log locking.
- A docs step requires exact current provider UI instructions and official docs
  cannot be reached.
- The web app currently relies on local defaults in production build paths in a
  way that cannot be fixed without a broader architecture change.
- `npm run check` fails twice after reasonable targeted fixes.

## Maintenance notes

- This plan intentionally improves deployment safety and clarity without
  declaring Fold fully production-ready. Follow-up plans should handle append
  authorization, rate limiting, append-log recovery/quarantine, backups/restore
  automation, compaction, fork/truncation proofs, and eventual multi-instance
  durable storage.
- Provider docs should be reviewed periodically because cloud UI labels and
  environment-variable conveniences change. The durable contract should remain
  stable: `PORT`, `FOLD_PUBLIC_URL`, `FOLD_DATA_DIR`, HTTPS, WebSockets,
  persistent storage, and one instance.
- Reviewers should scrutinize that no new health output, docs example, smoke
  script, or log message leaks room URLs, `fold:v1:` tokens, `#key` fragments,
  or private room content.
