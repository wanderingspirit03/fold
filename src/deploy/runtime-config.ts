import { resolve } from 'node:path';
import type { PublicOriginConfig } from './public-origin.js';

export type DeploymentDiagnosticLevel = 'error' | 'warning';

export interface DeploymentDiagnostic {
  code: string;
  level: DeploymentDiagnosticLevel;
  message: string;
}

export interface HostedRuntimeValidationOptions {
  env?: Record<string, string | undefined>;
  dataDirectory: string;
  defaultDataDirectory: string;
  publicOrigin: PublicOriginConfig;
}

export interface HostedRuntimeValidation {
  errors: DeploymentDiagnostic[];
  ok: boolean;
  warnings: DeploymentDiagnostic[];
}

const PRIVATE_LAN_HOSTS = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
];

export function isProductionRuntime(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === 'production';
}

export function isLocalOnlyUrl(value: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(value).hostname.toLowerCase();
  } catch {
    return false;
  }

  const normalized = hostname.replace(/^\[/, '').replace(/\]$/, '');
  if (normalized === 'localhost' || normalized === '::1' || normalized === '0.0.0.0') return true;
  if (normalized.endsWith('.localhost') || normalized.endsWith('.local')) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  return PRIVATE_LAN_HOSTS.some((pattern) => pattern.test(normalized));
}

export function validateHostedRuntime(options: HostedRuntimeValidationOptions): HostedRuntimeValidation {
  const env = options.env ?? process.env;
  const errors: DeploymentDiagnostic[] = [];
  const warnings: DeploymentDiagnostic[] = [];
  const production = isProductionRuntime(env);
  const hasPortablePublicUrl = hasText(env.FOLD_PUBLIC_URL)
    || (hasText(env.FOLD_PUBLIC_APP_URL) && hasText(env.FOLD_PUBLIC_SYNC_URL));
  const hasDataDirectory = hasText(env.FOLD_DATA_DIR);
  const usesDefaultDataDirectory = resolve(options.dataDirectory) === resolve(options.defaultDataDirectory);
  const appUrlLocal = isLocalOnlyUrl(options.publicOrigin.appUrl);
  const syncUrlLocal = isLocalOnlyUrl(options.publicOrigin.syncUrl);

  if (production && !hasDataDirectory) {
    errors.push({
      code: 'missing-fold-data-dir',
      level: 'error',
      message: 'FOLD_DATA_DIR must point at persistent storage for hosted production-alpha deployments.',
    });
  }

  if (production && hasDataDirectory && usesDefaultDataDirectory) {
    errors.push({
      code: 'default-fold-data-dir',
      level: 'error',
      message: 'FOLD_DATA_DIR resolves to the local default data/append-log path; point it at a mounted volume or disk.',
    });
  }

  if (production && options.publicOrigin.source === 'default') {
    errors.push({
      code: 'default-public-origin',
      level: 'error',
      message: 'No public Fold URL was configured; set FOLD_PUBLIC_URL for shared deployments.',
    });
  }

  if (production && options.publicOrigin.source === 'provider' && !hasPortablePublicUrl) {
    warnings.push({
      code: 'provider-public-origin-fallback',
      level: 'warning',
      message: 'Using a provider public URL fallback; set FOLD_PUBLIC_URL explicitly for portable cloud-agnostic deploys.',
    });
  }

  if (production && (appUrlLocal || syncUrlLocal)) {
    warnings.push({
      code: 'local-only-public-origin',
      level: 'warning',
      message: 'FOLD_PUBLIC_URL is local-only; this deployment is for the same machine or LAN and copied invites will not work for remote humans.',
    });
  }

  warnings.push({
    code: 'single-instance-required',
    level: 'warning',
    message: 'The current file append-log store supports one running Fold instance. Do not scale this deployment horizontally.',
  });

  return {
    errors,
    ok: errors.length === 0,
    warnings,
  };
}

export function formatDeploymentDiagnostics(diagnostics: readonly DeploymentDiagnostic[]): string[] {
  return diagnostics.map((diagnostic) => (
    `[${diagnostic.level}] ${diagnostic.code}: ${diagnostic.message}`
  ));
}

function hasText(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
