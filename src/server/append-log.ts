import http from 'node:http';
import { appendFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { URL } from 'node:url';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import type { EncryptedPayload } from '../../spikes/e2ee-yjs-append-log/crypto.js';

export const SERVER_SERVICE_NAME = 'agent-md-rooms';
export const SERVER_VERSION = '0.0.0';
const MAX_JSON_BODY_BYTES = 1_000_000;
const MAX_WEBSOCKET_MESSAGE_BYTES = 1_000_000;
const MAX_UPDATE_FIELD_BYTES = 750_000;

export interface EncryptedUpdateRecord extends EncryptedPayload {
  roomId: string;
  seq: number;
  senderId: string;
}

export interface IncomingEncryptedUpdate extends EncryptedPayload {
  senderId: string;
}

export interface RoomStatus {
  roomId: string;
  recordCount: number;
  latestSeq: number | null;
}

export interface EncryptedAppendLogStore {
  readonly kind?: string;
  readonly directory?: string;
  append(roomId: string, update: IncomingEncryptedUpdate): EncryptedUpdateRecord;
  list(roomId: string): EncryptedUpdateRecord[];
  serialized(roomId: string): string;
}

export interface ServerStartOptions {
  port?: number;
  host?: string;
}

export interface ServerHealth {
  ok: true;
  service: string;
  store: {
    kind: string;
  };
  uptimeSeconds: number;
  timestamp: string;
  version: string;
}

export class AppendLogStore implements EncryptedAppendLogStore {
  readonly kind = 'memory';

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
  readonly kind = 'file';
  readonly directory: string;

  private readonly rooms = new Map<string, EncryptedUpdateRecord[]>();

  constructor(directory: string) {
    this.directory = directory;
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
  private startedAt = 0;

  constructor(readonly store: EncryptedAppendLogStore = new AppendLogStore()) {}

  async start(portOrOptions: number | ServerStartOptions = 0): Promise<string> {
    const options = typeof portOrOptions === 'number' ? { port: portOrOptions } : portOrOptions;
    const port = options.port ?? 0;

    this.startedAt = Date.now();
    this.server = http.createServer((request, response) => {
      void this.handleHttp(request, response).catch((error) => {
        if (!response.headersSent) {
          sendJson(response, 500, { error: 'internal server error' });
        }
        console.error(error instanceof Error ? error.message : String(error));
      });
    });

    this.wss = new WebSocketServer({
      server: this.server,
      maxPayload: MAX_WEBSOCKET_MESSAGE_BYTES,
    });
    this.wss.on('connection', (socket, request) => {
      const roomId = roomIdFromPath(request.url ?? '', '/rooms/', '/ws');
      if (!roomId) {
        socket.close(1008, 'invalid room path');
        return;
      }

      const clients = this.clientsByRoom.get(roomId) ?? new Set<WebSocket>();
      clients.add(socket);
      this.clientsByRoom.set(roomId, clients);

      socket.on('error', (error: Error & { code?: string }) => {
        if (error.code !== 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH') {
          console.error(error.message);
        }
      });

      for (const record of this.store.list(roomId)) {
        socket.send(JSON.stringify({ type: 'encrypted-update', record }));
      }
      socket.send(JSON.stringify({ type: 'sync-complete' }));

      socket.on('message', (raw) => {
        if (rawDataBytes(raw) > MAX_WEBSOCKET_MESSAGE_BYTES) {
          socket.close(1009, 'message too large');
          return;
        }

        const parsed = parseIncomingMessage(rawDataToString(raw));
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

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        this.server?.off('listening', onListening);
        reject(error);
      };
      const onListening = (): void => {
        this.server?.off('error', onError);
        resolve();
      };

      this.server?.once('error', onError);
      this.server?.once('listening', onListening);
      if (options.host) {
        this.server?.listen(port, options.host);
        return;
      }
      this.server?.listen(port);
    });
    const address = this.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Server did not bind to a TCP port');
    }

    return `http://${urlHostForAddress(address.address)}:${address.port}`;
  }

  async stop(): Promise<void> {
    for (const clients of this.clientsByRoom.values()) {
      for (const client of clients) client.close();
    }
    this.clientsByRoom.clear();

    if (this.wss) {
      await new Promise<void>((resolve, reject) => {
        this.wss?.close((error) => error ? reject(error) : resolve());
      });
      this.wss = undefined;
    }

    if (this.server) {
      await new Promise<void>((resolve, reject) => {
        this.server?.close((error) => error ? reject(error) : resolve());
      });
      this.server = undefined;
    }
  }

  health(): ServerHealth {
    const store: ServerHealth['store'] = {
      kind: this.store.kind ?? 'custom',
    };

    return {
      ok: true,
      service: SERVER_SERVICE_NAME,
      store,
      uptimeSeconds: Math.max(0, Math.floor((Date.now() - this.startedAt) / 1000)),
      timestamp: new Date().toISOString(),
      version: SERVER_VERSION,
    };
  }

  private async handleHttp(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const updatesRoomId = roomIdFromPath(url.pathname, '/rooms/', '/updates');
    const statusRoomId = roomIdFromPath(url.pathname, '/rooms/', '/status');

    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, this.health());
      return;
    }

    if (request.method === 'GET' && updatesRoomId) {
      sendJson(response, 200, { updates: this.store.list(updatesRoomId) });
      return;
    }

    if (request.method === 'POST' && updatesRoomId) {
      const body = await readJsonBody(request);
      if (!isIncomingUpdateRequest(body)) {
        sendJson(response, 400, { error: 'invalid update request' });
        return;
      }

      const record = this.store.append(updatesRoomId, body.update);
      this.broadcast(updatesRoomId, { type: 'encrypted-update', record });
      sendJson(response, 201, { record });
      return;
    }

    if (request.method === 'GET' && statusRoomId) {
      sendJson(response, 200, roomStatus(statusRoomId, this.store.list(statusRoomId)));
      return;
    }

    sendJson(response, 404, { error: 'not found' });
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

function rawDataBytes(raw: RawData): number {
  if (typeof raw === 'string') return Buffer.byteLength(raw, 'utf8');
  if (Array.isArray(raw)) return raw.reduce((total, chunk) => total + chunk.byteLength, 0);
  return raw.byteLength;
}

function rawDataToString(raw: RawData): string {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8');
  if (Buffer.isBuffer(raw)) return raw.toString('utf8');
  return Buffer.from(new Uint8Array(raw)).toString('utf8');
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

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_JSON_BODY_BYTES) return null;
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    return null;
  }
}

function isIncomingUpdateRequest(value: unknown): value is { update: IncomingEncryptedUpdate } {
  if (!value || typeof value !== 'object') return false;
  const update = (value as { update?: Partial<IncomingEncryptedUpdate> }).update;
  return Boolean(
    update &&
    typeof update.senderId === 'string' &&
    typeof update.nonce === 'string' &&
    typeof update.ciphertext === 'string' &&
    isReasonableUpdateField(update.senderId) &&
    isReasonableUpdateField(update.nonce) &&
    isReasonableUpdateField(update.ciphertext),
  );
}

function isReasonableUpdateField(value: string): boolean {
  return Buffer.byteLength(value, 'utf8') <= MAX_UPDATE_FIELD_BYTES;
}

function roomStatus(roomId: string, records: EncryptedUpdateRecord[]): RoomStatus {
  return {
    roomId,
    recordCount: records.length,
    latestSeq: records.at(-1)?.seq ?? null,
  };
}

function sendJson(response: http.ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function roomIdFromPath(path: string, prefix: string, suffix: string): string | null {
  if (!path.endsWith(suffix)) return null;
  const prefixIndex = path.lastIndexOf(prefix);
  if (prefixIndex === -1) return null;
  const encodedRoomId = path.slice(prefixIndex + prefix.length, -suffix.length);
  if (!encodedRoomId) return null;
  try {
    return decodeURIComponent(encodedRoomId);
  } catch {
    return null;
  }
}

function urlHostForAddress(address: string): string {
  if (address === '::' || address === '0.0.0.0') return '127.0.0.1';
  if (address.includes(':')) return `[${address}]`;
  return address;
}
