interface HealthResponse {
  ok?: unknown;
  service?: unknown;
}

async function main(argv: readonly string[]): Promise<void> {
  const baseUrl = readBaseUrl(argv);
  const healthUrl = new URL('/health', ensureTrailingSlash(baseUrl));
  const response = await fetch(healthUrl);
  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${response.status}`);
  }

  const body = await response.json() as HealthResponse;
  if (body.ok !== true || body.service !== 'fold') {
    throw new Error('Health check did not return a Fold ok response');
  }

  console.log(`Fold deployment smoke passed: ${healthUrl.toString()}`);
}

function readBaseUrl(argv: readonly string[]): string {
  const flagIndex = argv.indexOf('--base-url');
  const raw = flagIndex >= 0 ? argv[flagIndex + 1] : process.env.FOLD_PUBLIC_URL;
  if (!raw || raw.startsWith('--')) {
    throw new Error('Usage: npm run smoke:deploy -- --base-url https://your-fold.example');
  }

  const parsed = new URL(raw);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Deployment smoke base URL must use http or https');
  }
  return parsed.toString();
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
