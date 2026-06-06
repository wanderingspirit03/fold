import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { EncryptedYjsClient, ProtocolIntegrityError } from './client.js';
import { decryptUpdate, deriveRoomKey } from './crypto.js';
import {
  EncryptedAppendLogServer,
  FileAppendLogStore,
  type EncryptedAppendLogStore,
  type EncryptedUpdateRecord,
  type IncomingEncryptedUpdate,
} from './server.js';

describe('encrypted Yjs append-log spike', () => {
  it('syncs two clients, persists reloadable encrypted updates, and keeps server storage opaque', async () => {
    const roomId = 'test-room';
    const roomSecret = 'test-url-fragment-key';
    const secretMarkdown = '# Private agent report\n\nServer storage must not contain this sentence.';
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();

    try {
      const alice = new EncryptedYjsClient({ serverUrl, roomId, roomSecret, clientId: 'alice' });
      const bob = new EncryptedYjsClient({ serverUrl, roomId, roomSecret, clientId: 'bob' });
      await alice.connect();
      await bob.connect();

      alice.markdown.insert(0, secretMarkdown);
      await bob.waitForText(secretMarkdown);

      const serverStorage = server.store.serialized(roomId);
      expect(serverStorage).not.toContain(secretMarkdown);
      expect(serverStorage).not.toContain(roomSecret);
      expect(server.store.list(roomId)).toHaveLength(1);

      const reloaded = new EncryptedYjsClient({ serverUrl, roomId, roomSecret, clientId: 'reloaded' });
      await reloaded.connect();
      expect(reloaded.markdown.toString()).toBe(secretMarkdown);

      alice.disconnect();
      bob.disconnect();
      reloaded.disconnect();
    } finally {
      await server.stop();
    }
  });

  it('cannot reload persisted updates with the wrong room key', async () => {
    const roomId = 'wrong-key-room';
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();

    try {
      const writer = new EncryptedYjsClient({
        serverUrl,
        roomId,
        roomSecret: 'correct-key',
        clientId: 'writer',
      });
      await writer.connect();
      writer.markdown.insert(0, 'confidential markdown');
      await waitFor(() => server.store.list(roomId).length === 1);
      writer.disconnect();

      const reader = new EncryptedYjsClient({
        serverUrl,
        roomId,
        roomSecret: 'wrong-key',
        clientId: 'reader',
      });

      await expect(reader.connect()).rejects.toThrow();
      reader.disconnect();
    } finally {
      await server.stop();
    }
  });

  it('replays encrypted append-log records from disk after server restart without leaking plaintext', async () => {
    const roomId = 'durable-room';
    const roomSecret = 'durable-url-fragment-key';
    const secretMarkdown = '# Durable private report\n\nThis text should only exist after client-side decryption.';
    const storeDirectory = await mkdtemp(join(tmpdir(), 'agent-md-rooms-'));
    let firstServer: EncryptedAppendLogServer | undefined;
    let secondServer: EncryptedAppendLogServer | undefined;
    let writer: EncryptedYjsClient | undefined;
    let reader: EncryptedYjsClient | undefined;

    try {
      firstServer = new EncryptedAppendLogServer(new FileAppendLogStore(storeDirectory));
      const firstServerUrl = await firstServer.start();

      writer = new EncryptedYjsClient({
        serverUrl: firstServerUrl,
        roomId,
        roomSecret,
        clientId: 'writer',
      });
      await writer.connect();
      writer.markdown.insert(0, secretMarkdown);
      await waitFor(() => firstServer?.store.list(roomId).length === 1);
      writer.disconnect();
      await firstServer.stop();
      firstServer = undefined;

      const persistedStorage = await readAppendLogDirectory(storeDirectory);
      expect(persistedStorage).not.toContain(secretMarkdown);
      expect(persistedStorage).not.toContain(roomSecret);
      expect(persistedStorage).toContain(roomId);

      secondServer = new EncryptedAppendLogServer(new FileAppendLogStore(storeDirectory));
      const secondServerUrl = await secondServer.start();
      expect(secondServer.store.list(roomId)).toHaveLength(1);

      reader = new EncryptedYjsClient({
        serverUrl: secondServerUrl,
        roomId,
        roomSecret,
        clientId: 'reader',
      });
      await reader.connect();

      expect(reader.markdown.toString()).toBe(secretMarkdown);
    } finally {
      writer?.disconnect();
      reader?.disconnect();
      await firstServer?.stop();
      await secondServer?.stop();
      await rm(storeDirectory, { recursive: true, force: true });
    }
  });

  it('replays persisted updates when a client reconnects with the same client id', async () => {
    const roomId = 'same-client-reload-room';
    const roomSecret = 'same-client-key';
    const markdown = 'same client id should still replay persisted history';
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();

    try {
      const writer = new EncryptedYjsClient({
        serverUrl,
        roomId,
        roomSecret,
        clientId: 'agent-cli',
      });
      await writer.connect();
      writer.markdown.insert(0, markdown);
      await waitFor(() => server.store.list(roomId).length === 1);
      writer.disconnect();

      const reconnected = new EncryptedYjsClient({
        serverUrl,
        roomId,
        roomSecret,
        clientId: 'agent-cli',
      });
      await reconnected.connect();
      expect(reconnected.markdown.toString()).toBe(markdown);
      reconnected.disconnect();
    } finally {
      await server.stop();
    }
  });

  it('rejects encrypted updates when authenticated metadata is tampered', async () => {
    const roomId = 'metadata-auth-room';
    const roomSecret = 'metadata-auth-key';
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();

    try {
      const writer = new EncryptedYjsClient({
        serverUrl,
        roomId,
        roomSecret,
        clientId: 'writer',
      });
      await writer.connect();
      writer.markdown.insert(0, 'metadata-bound markdown');
      await waitFor(() => server.store.list(roomId).length === 1);
      writer.disconnect();

      const [record] = server.store.list(roomId);
      const roomKey = await deriveRoomKey(roomId, roomSecret);

      await expect(decryptUpdate(record, roomKey, {
        roomId: record.roomId,
        senderId: 'tampered-sender',
      })).rejects.toThrow();

      await expect(decryptUpdate(record, roomKey, {
        roomId: 'tampered-room',
        senderId: record.senderId,
      })).rejects.toThrow();
    } finally {
      await server.stop();
    }
  });

  it('detects dropped, replayed, and reordered append-log records', async () => {
    const roomId = 'sequence-hardening-room';
    const roomSecret = 'sequence-hardening-key';
    const records = await createEncryptedRecords(roomId, roomSecret);
    const scenarios: Array<{ name: string; records: EncryptedUpdateRecord[] }> = [
      {
        name: 'dropped record gap',
        records: [
          records[0],
          { ...records[1], seq: 3 },
        ],
      },
      {
        name: 'replayed duplicate record',
        records: [
          records[0],
          records[0],
        ],
      },
      {
        name: 'reordered records',
        records: [
          records[1],
          records[0],
        ],
      },
    ];

    for (const scenario of scenarios) {
      const server = new EncryptedAppendLogServer(new StaticAppendLogStore(scenario.records));
      const serverUrl = await server.start();
      const reader = new EncryptedYjsClient({
        serverUrl,
        roomId,
        roomSecret,
        clientId: `reader-${scenario.name}`,
      });

      try {
        const connect = reader.connect();
        await expect(connect, scenario.name).rejects.toThrow(ProtocolIntegrityError);
        await expect(connect, scenario.name).rejects.toThrow(/append-log sequence/);
      } finally {
        reader.disconnect();
        await server.stop();
      }
    }
  });

  it('catches updates appended before a WebSocket subscriber joins', async () => {
    const roomId = 'history-subscribe-race-room';
    const roomSecret = 'race-test-url-fragment-key';
    const initialMarkdown = '# Initial report';
    const missedMarkdown = '\n\nUpdate written during join.';
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    const writer = new EncryptedYjsClient({
      serverUrl,
      roomId,
      roomSecret,
      clientId: 'writer',
    });
    const joiningDoc = new Y.Doc();
    let joiningSocket: WebSocket | undefined;

    try {
      await writer.connect();
      writer.markdown.insert(0, initialMarkdown);
      await waitFor(() => server.store.list(roomId).length === 1);

      const roomKey = await deriveRoomKey(roomId, roomSecret);
      const joiningMarkdown = joiningDoc.getText('markdown');
      writer.markdown.insert(writer.markdown.length, missedMarkdown);
      await waitFor(() => server.store.list(roomId).length === 2);

      joiningSocket = new WebSocket(wsUrl(serverUrl, roomId));
      joiningSocket.on('message', (raw) => {
        void (async () => {
          const message = JSON.parse(raw.toString()) as {
            type?: string;
            record?: { nonce: string; ciphertext: string };
          };
          if (message.type !== 'encrypted-update' || !message.record) return;
          Y.applyUpdate(joiningDoc, await decryptUpdate(message.record, roomKey, {
            roomId,
            senderId: 'writer',
          }), 'ws-replay');
        })();
      });
      await new Promise<void>((resolve, reject) => {
        joiningSocket?.once('open', resolve);
        joiningSocket?.once('error', reject);
      });

      await waitFor(() => joiningMarkdown.toString() === initialMarkdown + missedMarkdown);
    } finally {
      joiningSocket?.close();
      joiningDoc.destroy();
      writer.disconnect();
      await server.stop();
    }
  });
});

async function waitFor(condition: () => boolean, timeoutMs = 2_000): Promise<void> {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error('Timed out waiting for condition');
}

function wsUrl(serverUrl: string, roomId: string): string {
  const url = new URL(serverUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `/rooms/${encodeURIComponent(roomId)}/ws`;
  return url.toString();
}

async function readAppendLogDirectory(directory: string): Promise<string> {
  const filenames = await readdir(directory);
  const contents = await Promise.all(
    filenames.map((filename) => readFile(join(directory, filename), 'utf8')),
  );
  return contents.join('\n');
}

async function createEncryptedRecords(roomId: string, roomSecret: string): Promise<EncryptedUpdateRecord[]> {
  const server = new EncryptedAppendLogServer();
  const serverUrl = await server.start();
  const writer = new EncryptedYjsClient({
    serverUrl,
    roomId,
    roomSecret,
    clientId: 'writer',
  });

  try {
    await writer.connect();
    writer.markdown.insert(0, 'first update');
    await waitFor(() => server.store.list(roomId).length === 1);
    writer.markdown.insert(writer.markdown.length, '\nsecond update');
    await waitFor(() => server.store.list(roomId).length === 2);

    return server.store.list(roomId);
  } finally {
    writer.disconnect();
    await server.stop();
  }
}

class StaticAppendLogStore implements EncryptedAppendLogStore {
  constructor(private readonly records: EncryptedUpdateRecord[]) {}

  append(_roomId: string, _update: IncomingEncryptedUpdate): EncryptedUpdateRecord {
    throw new Error('StaticAppendLogStore is read-only');
  }

  list(roomId: string): EncryptedUpdateRecord[] {
    return this.records.filter((record) => record.roomId === roomId);
  }

  serialized(roomId: string): string {
    return JSON.stringify(this.list(roomId));
  }
}
