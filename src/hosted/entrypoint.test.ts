import { describe, expect, it } from 'vitest';
import { parseHostedCliOptions } from './entrypoint.js';

describe('hosted server entrypoint', () => {
  it('uses platform host, port, and data env defaults', () => {
    const options = parseHostedCliOptions([], '/repo', {
      HOST: '0.0.0.0',
      PORT: '4311',
      FOLD_DATA_DIR: '/data/fold',
    });

    expect(options.host).toBe('0.0.0.0');
    expect(options.port).toBe(4311);
    expect(options.dataDirectory).toBe('/data/fold');
    expect(options.defaultDataDirectory).toBe('/repo/data/append-log');
    expect(options.webDirectory).toBe('/repo/apps/web');
  });

  it('lets explicit flags override hosted env defaults', () => {
    const options = parseHostedCliOptions([
      '--host',
      '127.0.0.1',
      '--port',
      '5123',
      '--data',
      './tmp-data',
      '--web-dir',
      './custom-web',
    ], '/repo', {
      HOST: '0.0.0.0',
      PORT: '4311',
      FOLD_DATA_DIR: '/data/fold',
    });

    expect(options.host).toBe('127.0.0.1');
    expect(options.port).toBe(5123);
    expect(options.dataDirectory).toBe('/repo/tmp-data');
    expect(options.defaultDataDirectory).toBe('/repo/data/append-log');
    expect(options.webDirectory).toBe('/repo/custom-web');
  });
});
