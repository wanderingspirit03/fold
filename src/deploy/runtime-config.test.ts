import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatDeploymentDiagnostics,
  isLocalOnlyUrl,
  isProductionRuntime,
  validateHostedRuntime,
} from './runtime-config.js';

const defaultDataDirectory = resolve('/repo', 'data/append-log');

describe('hosted runtime deployment validation', () => {
  it('detects production mode only from NODE_ENV=production', () => {
    expect(isProductionRuntime({ NODE_ENV: 'production' })).toBe(true);
    expect(isProductionRuntime({ NODE_ENV: 'development' })).toBe(false);
    expect(isProductionRuntime({})).toBe(false);
  });

  it('detects localhost and private network URLs', () => {
    expect(isLocalOnlyUrl('http://localhost:3000')).toBe(true);
    expect(isLocalOnlyUrl('http://127.0.0.1:3000')).toBe(true);
    expect(isLocalOnlyUrl('http://192.168.1.20:3000')).toBe(true);
    expect(isLocalOnlyUrl('http://10.0.0.5:3000')).toBe(true);
    expect(isLocalOnlyUrl('https://fold.example.test')).toBe(false);
  });

  it('allows local development defaults with warnings only', () => {
    const result = validateHostedRuntime({
      env: {},
      dataDirectory: defaultDataDirectory,
      defaultDataDirectory,
      publicOrigin: {
        appUrl: 'http://127.0.0.1:3000',
        syncUrl: 'http://127.0.0.1:3000',
        source: 'default',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toContain('single-instance-required');
  });

  it('rejects production fallback to implicit localhost and missing storage env', () => {
    const result = validateHostedRuntime({
      env: { NODE_ENV: 'production' },
      dataDirectory: defaultDataDirectory,
      defaultDataDirectory,
      publicOrigin: {
        appUrl: 'http://127.0.0.1:3000',
        syncUrl: 'http://127.0.0.1:3000',
        source: 'default',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual([
      'missing-fold-data-dir',
      'default-public-origin',
    ]);
    expect(result.warnings.map((warning) => warning.code)).toContain('local-only-public-origin');
  });

  it('rejects production data directories that resolve to the local default', () => {
    const result = validateHostedRuntime({
      env: {
        NODE_ENV: 'production',
        FOLD_DATA_DIR: './data/append-log',
        FOLD_PUBLIC_URL: 'https://fold.example.test',
      },
      dataDirectory: defaultDataDirectory,
      defaultDataDirectory,
      publicOrigin: {
        appUrl: 'https://fold.example.test',
        syncUrl: 'https://fold.example.test',
        source: 'fold-public-url',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual(['default-fold-data-dir']);
  });

  it('allows explicit local production URLs for Docker Compose with a warning', () => {
    const result = validateHostedRuntime({
      env: {
        NODE_ENV: 'production',
        FOLD_PUBLIC_URL: 'http://localhost:3000',
        FOLD_DATA_DIR: '/data/append-log',
      },
      dataDirectory: '/data/append-log',
      defaultDataDirectory,
      publicOrigin: {
        appUrl: 'http://localhost:3000',
        syncUrl: 'http://localhost:3000',
        source: 'fold-public-url',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toContain('local-only-public-origin');
  });

  it('warns when production relies on provider public URL fallbacks', () => {
    const result = validateHostedRuntime({
      env: {
        NODE_ENV: 'production',
        FOLD_DATA_DIR: '/data/append-log',
        RAILWAY_PUBLIC_DOMAIN: 'fold.up.railway.app',
      },
      dataDirectory: '/data/append-log',
      defaultDataDirectory,
      publicOrigin: {
        appUrl: 'https://fold.up.railway.app',
        syncUrl: 'https://fold.up.railway.app',
        source: 'provider',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.warnings.map((warning) => warning.code)).toContain('provider-public-origin-fallback');
  });

  it('formats diagnostics for startup logs', () => {
    expect(formatDeploymentDiagnostics([{
      code: 'single-instance-required',
      level: 'warning',
      message: 'Do not scale horizontally.',
    }])).toEqual([
      '[warning] single-instance-required: Do not scale horizontally.',
    ]);
  });
});
