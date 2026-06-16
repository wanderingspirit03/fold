import { normalizeServerUrl } from '../rooms/room-reference.js';

export interface PublicOriginConfig {
  appUrl: string;
  syncUrl: string;
  source: 'explicit' | 'fold-public-url' | 'split-environment' | 'provider' | 'default';
}

export interface PublicOriginOptions {
  appUrl?: string;
  syncUrl?: string;
  serverUrl?: string;
  defaultUrl: string;
  env?: Record<string, string | undefined>;
}

export function resolvePublicOrigin(options: PublicOriginOptions): PublicOriginConfig {
  const env = options.env ?? process.env;
  const providerUrl = publicOriginFromProviderEnv(env);
  const appUrl = options.appUrl
    ?? options.serverUrl
    ?? options.syncUrl
    ?? env.FOLD_PUBLIC_APP_URL
    ?? env.FOLD_PUBLIC_URL
    ?? providerUrl
    ?? options.defaultUrl;
  const syncUrl = options.syncUrl
    ?? options.serverUrl
    ?? options.appUrl
    ?? env.FOLD_PUBLIC_SYNC_URL
    ?? env.FOLD_PUBLIC_URL
    ?? providerUrl
    ?? options.defaultUrl;

  return {
    appUrl: normalizeServerUrl(appUrl),
    syncUrl: normalizeServerUrl(syncUrl),
    source: publicOriginSource(options, env, providerUrl),
  };
}

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

export function hostedPortFromEnv(env: Record<string, string | undefined> = process.env, fallback = 3000): number {
  const raw = env.PORT;
  if (!raw) return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${raw}`);
  }
  return port;
}

function firstPresent(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value && value.trim().length > 0);
}

function withHttps(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//.test(value)) return value;
  return `https://${value}`;
}

function publicOriginSource(
  options: PublicOriginOptions,
  env: Record<string, string | undefined>,
  providerUrl: string | undefined,
): PublicOriginConfig['source'] {
  if (options.appUrl || options.syncUrl || options.serverUrl) return 'explicit';
  if (env.FOLD_PUBLIC_APP_URL || env.FOLD_PUBLIC_SYNC_URL) return 'split-environment';
  if (env.FOLD_PUBLIC_URL) return 'fold-public-url';
  if (providerUrl) return 'provider';
  return 'default';
}
