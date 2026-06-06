import http from 'node:http';
import { appendFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { URL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import type { EncryptedPayload } from './crypto.js';

export interface EncryptedUpdateRecord extends EncryptedPayload {
  roomId: string;
  seq: number;
  senderId: string;
}

export interface IncomingEncryptedUpdate extends EncryptedPayload {
  senderId: string;
}

export interface EncryptedAppendLogStore {
  append(roomId: string, update: IncomingEncryptedUpdate): EncryptedUpdateRecord;
  list(roomId: string): EncryptedUpdateRecord[];
  serialized(roomId: string): string;
}

export class AppendLogStore implements EncryptedAppendLogStore {
  private rooms = new Map<string, EncryptedUpdateRecord[]>();

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
    return record;
  }

  list(roomId: string): EncryptedUpdateRecord[] {
    return [...(this.rooms.get(roomId) ?? [])];
  }

  serialized(roomId: string): string {
    return JSON.stringify(this.list(roomId));
  }
}

export class FileAppendLogStore implements EncryptedAppendLogStore {
  private readonly rooms = new Map<string, EncryptedUpdateRecord[]>();

  constructor(private readonly directory: string) {
    mkdirSync(directory, { recursive: true });
    this.loadExistingRecords();
  }

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

  list(roomId: string): EncryptedUpdateRecord[] {
    return [...(this.rooms.get(roomId) ?? [])];
  }

  serialized(roomId: string): string {
    return JSON.stringify(this.list(roomId));
  }

  private loadExistingRecords(): void {
    for (const filename of readdirSync(this.directory)) {
      if (!filename.endsWith('.jsonl')) continue;

      const contents = readFileSync(join(this.directory, filename), 'utf8');
      for (const line of contents.split('\n')) {
        if (!line.trim()) continue;
        const record = parseStoredRecord(line);
        if (!record) {
          throw new Error(`Invalid append-log record in ${filename}`);
        }

        const room = this.rooms.get(record.roomId) ?? [];
        if (record.seq !== room.length + 1) {
          throw new Error(`Non-contiguous append-log sequence for room ${record.roomId}`);
        }

        room.push(record);
        this.rooms.set(record.roomId, room);
      }
    }
  }

  private fileForRoom(roomId: string): string {
    return join(this.directory, `${Buffer.from(roomId).toString('base64url')}.jsonl`);
  }
}

export class EncryptedAppendLogServer {
  private server?: http.Server;
  private wss?: WebSocketServer;
  private clientsByRoom = new Map<string, Set<WebSocket>>();

  constructor(readonly store: EncryptedAppendLogStore = new AppendLogStore()) {}

  async start(port = 0): Promise<string> {
    this.server = http.createServer((request, response) => {
      void this.handleHttp(request, response);
    });

    this.wss = new WebSocketServer({ server: this.server });
    this.wss.on('connection', (socket, request) => {
      const roomId = roomIdFromPath(request.url ?? '', '/rooms/', '/ws');
      if (!roomId) {
        socket.close(1008, 'invalid room path');
        return;
      }

      const clients = this.clientsByRoom.get(roomId) ?? new Set<WebSocket>();
      clients.add(socket);
      this.clientsByRoom.set(roomId, clients);

      for (const record of this.store.list(roomId)) {
        socket.send(JSON.stringify({ type: 'encrypted-update', record }));
      }
      socket.send(JSON.stringify({ type: 'sync-complete' }));

      socket.on('message', (raw) => {
        const parsed = parseIncomingMessage(raw.toString());
        if (!parsed) {
          socket.close(1008, 'invalid message');
          return;
        }

        const record = this.store.append(roomId, parsed.update);
        this.broadcast(roomId, { type: 'encrypted-update', record });
      });

      socket.on('close', () => {
        clients.delete(socket);
      });
    });

    await new Promise<void>((resolve) => this.server?.listen(port, resolve));
    const address = this.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Server did not bind to a TCP port');
    }

    return `http://127.0.0.1:${address.port}`;
  }

  async stop(): Promise<void> {
    for (const clients of this.clientsByRoom.values()) {
      for (const client of clients) client.close();
    }
    this.clientsByRoom.clear();

    await new Promise<void>((resolve) => this.wss?.close(() => resolve()));
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }

  private async handleHttp(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const roomId = roomIdFromPath(url.pathname, '/rooms/', '/updates');

    if (request.method !== 'GET' || !roomId) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ updates: this.store.list(roomId) }));
  }

  private broadcast(roomId: string, message: unknown): void {
    const encoded = JSON.stringify(message);
    for (const client of this.clientsByRoom.get(roomId) ?? []) {
      if (client.readyState === WebSocket.OPEN) client.send(encoded);
    }
  }
}

function parseStoredRecord(raw: string): EncryptedUpdateRecord | null {
  try {
    const value = JSON.parse(raw) as Partial<EncryptedUpdateRecord>;
    if (
      typeof value.roomId !== 'string' ||
      typeof value.seq !== 'number' ||
      typeof value.senderId !== 'string' ||
      typeof value.nonce !== 'string' ||
      typeof value.ciphertext !== 'string'
    ) {
      return null;
    }

    return value as EncryptedUpdateRecord;
  } catch {
    return null;
  }
}

function parseIncomingMessage(raw: string): { type: 'encrypted-update'; update: IncomingEncryptedUpdate } | null {
  try {
    const value = JSON.parse(raw) as Partial<{ type: string; update: IncomingEncryptedUpdate }>;
    if (
      value.type !== 'encrypted-update' ||
      !value.update ||
      typeof value.update.senderId !== 'string' ||
      typeof value.update.nonce !== 'string' ||
      typeof value.update.ciphertext !== 'string'
    ) {
      return null;
    }
    return value as { type: 'encrypted-update'; update: IncomingEncryptedUpdate };
  } catch {
    return null;
  }
}

function roomIdFromPath(path: string, prefix: string, suffix: string): string | null {
  if (!path.startsWith(prefix) || !path.endsWith(suffix)) return null;
  const encodedRoomId = path.slice(prefix.length, -suffix.length);
  if (!encodedRoomId) return null;
  return decodeURIComponent(encodedRoomId);
}
