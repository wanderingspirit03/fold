import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import {
  EncryptedAppendLogServer,
  FileAppendLogStore,
  type EncryptedUpdateRecord,
} from './append-log.js';
import { parseServerCliOptions } from './entrypoint.js';

describe('production append-log server', () => {
  it('starts with file-backed persistence and reports health', async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), 'mdroom-server-'));
    const server = new EncryptedAppendLogServer(new FileAppendLogStore(dataDirectory));

    try {
      const serverUrl = await server.start({ host: '127.0.0.1', port: 0 });
      const response = await fetch(`${serverUrl}/health`);
      const health = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(health.ok).toBe(true);
      expect(health.service).toBe('agent-md-rooms');
      expect(health.store).toEqual({
        kind: 'file',
      });
      expect(health.uptimeSeconds).toBeTypeOf('number');
      expect(health.timestamp).toBeTypeOf('string');
      expect(health.version).toBe('0.0.0');
    } finally {
      await server.stop();
      await rm(dataDirectory, { recursive: true, force: true });
    }
  });

  it('supports append and status APIs', async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), 'mdroom-server-'));
    const server = new EncryptedAppendLogServer(new FileAppendLogStore(dataDirectory));
    const roomId = 'server-api-room';

    try {
      const serverUrl = await server.start();
      const append = await apiJson<{ record: EncryptedUpdateRecord }>(
        `${serverUrl}/rooms/${encodeURIComponent(roomId)}/updates`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            update: {
              senderId: 'test-client',
              nonce: 'test-nonce',
              ciphertext: 'test-ciphertext',
            },
          }),
        },
      );
      const status = await apiJson<Record<string, unknown>>(
        `${serverUrl}/rooms/${encodeURIComponent(roomId)}/status`,
      );

      expect(append.status).toBe(201);
      expect(append.body.record).toEqual({
        roomId,
        seq: 1,
        senderId: 'test-client',
        nonce: 'test-nonce',
        ciphertext: 'test-ciphertext',
      });
      expect(status.status).toBe(200);
      expect(status.body).toEqual({
        roomId,
        recordCount: 1,
        latestSeq: 1,
      });
    } finally {
      await server.stop();
      await rm(dataDirectory, { recursive: true, force: true });
    }
  });

  it('returns 400 for invalid updates', async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), 'mdroom-server-'));
    const server = new EncryptedAppendLogServer(new FileAppendLogStore(dataDirectory));

    try {
      const serverUrl = await server.start();
      const response = await fetch(`${serverUrl}/rooms/invalid-update-room/updates`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ update: { senderId: 'missing-fields' } }),
      });
      const body = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(400);
      expect(body).toEqual({ error: 'invalid update request' });
    } finally {
      await server.stop();
      await rm(dataDirectory, { recursive: true, force: true });
    }
  });

  it('rejects malformed room paths and oversized encrypted updates', async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), 'mdroom-server-'));
    const server = new EncryptedAppendLogServer(new FileAppendLogStore(dataDirectory));

    try {
      const serverUrl = await server.start();
      const malformed = await fetch(`${serverUrl}/rooms/%/updates`);
      const oversized = await fetch(`${serverUrl}/rooms/oversized-room/updates`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          update: {
            senderId: 'test-client',
            nonce: 'test-nonce',
            ciphertext: 'x'.repeat(750_001),
          },
        }),
      });
      const oversizedBody = await oversized.json() as Record<string, unknown>;

      expect(malformed.status).toBe(404);
      expect(oversized.status).toBe(400);
      expect(oversizedBody).toEqual({ error: 'invalid update request' });
    } finally {
      await server.stop();
      await rm(dataDirectory, { recursive: true, force: true });
    }
  });

  it('closes oversized WebSocket messages before appending them', async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), 'mdroom-server-'));
    const server = new EncryptedAppendLogServer(new FileAppendLogStore(dataDirectory));

    try {
      const serverUrl = await server.start();
      const socket = new WebSocket(`${serverUrl.replace('http:', 'ws:')}/rooms/ws-oversized-room/ws`);
      const closeCode = await new Promise<number>((resolveClose) => {
        socket.on('open', () => {
          socket.send('x'.repeat(1_000_001));
        });
        socket.on('close', (code) => {
          resolveClose(code);
        });
      });
      const status = await apiJson<Record<string, unknown>>(`${serverUrl}/rooms/ws-oversized-room/status`);

      expect(closeCode).toBe(1009);
      expect(status.body).toEqual({
        roomId: 'ws-oversized-room',
        recordCount: 0,
        latestSeq: null,
      });
    } finally {
      await server.stop();
      await rm(dataDirectory, { recursive: true, force: true });
    }
  });

  it('replays file-backed append-log records after restart', async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), 'mdroom-server-'));
    const roomId = 'restart-replay-room';
    let firstServer: EncryptedAppendLogServer | undefined;
    let secondServer: EncryptedAppendLogServer | undefined;

    try {
      firstServer = new EncryptedAppendLogServer(new FileAppendLogStore(dataDirectory));
      const firstUrl = await firstServer.start();
      const appended = await apiJson<{ record: EncryptedUpdateRecord }>(
        `${firstUrl}/rooms/${encodeURIComponent(roomId)}/updates`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            update: {
              senderId: 'restart-client',
              nonce: 'restart-nonce',
              ciphertext: 'restart-ciphertext',
            },
          }),
        },
      );
      await firstServer.stop();
      firstServer = undefined;

      secondServer = new EncryptedAppendLogServer(new FileAppendLogStore(dataDirectory));
      const secondUrl = await secondServer.start();
      const replayed = await apiJson<{ updates: EncryptedUpdateRecord[] }>(
        `${secondUrl}/rooms/${encodeURIComponent(roomId)}/updates`,
      );

      expect(replayed.status).toBe(200);
      expect(replayed.body.updates).toEqual([appended.body.record]);
    } finally {
      await firstServer?.stop();
      await secondServer?.stop();
      await rm(dataDirectory, { recursive: true, force: true });
    }
  });

  it('parses server CLI defaults and flags', () => {
    expect(parseServerCliOptions([], '/workspace')).toEqual({
      host: '127.0.0.1',
      port: 8787,
      dataDirectory: resolve('/workspace', 'data', 'append-log'),
    });
    expect(parseServerCliOptions(['--host', '0.0.0.0', '--port', '8788', '--data', './custom'], '/workspace')).toEqual({
      host: '0.0.0.0',
      port: 8788,
      dataDirectory: resolve('/workspace', 'custom'),
    });
  });
});

async function apiJson<T>(url: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const response = await fetch(url, init);
  return {
    status: response.status,
    body: await response.json() as T,
  };
}
