import type { EncryptedPayload } from '../../spikes/e2ee-yjs-append-log/crypto.js';
import type { EncryptedUpdateRecord, IncomingEncryptedUpdate } from '../server/append-log.js';
import type { RoomAccess } from './room-reference.js';

export interface RoomStatusResponse {
  roomId: string;
  recordCount: number;
  latestSeq: number | null;
}

export interface AppendEncryptedUpdateResponse {
  record: EncryptedUpdateRecord;
}

export interface ListEncryptedUpdatesResponse {
  updates: EncryptedUpdateRecord[];
}

export async function appendEncryptedUpdate(
  access: RoomAccess,
  update: IncomingEncryptedUpdate,
): Promise<EncryptedUpdateRecord> {
  const response = await fetch(roomApiUrl(access, 'updates'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ update }),
  });
  const json = await readJsonResponse<AppendEncryptedUpdateResponse>(response);
  if (!isEncryptedUpdateRecord(json.record)) {
    throw new Error('Server returned an invalid encrypted append-log record');
  }
  return json.record;
}

export async function listEncryptedUpdates(access: RoomAccess): Promise<EncryptedUpdateRecord[]> {
  const response = await fetch(roomApiUrl(access, 'updates'));
  const json = await readJsonResponse<ListEncryptedUpdatesResponse>(response);
  if (!Array.isArray(json.updates) || !json.updates.every(isEncryptedUpdateRecord)) {
    throw new Error('Server returned invalid encrypted append-log updates');
  }
  return json.updates;
}

export async function fetchRoomStatus(access: RoomAccess): Promise<RoomStatusResponse> {
  const response = await fetch(roomApiUrl(access, 'status'));
  const json = await readJsonResponse<RoomStatusResponse>(response);
  if (!isRoomStatusResponse(json)) {
    throw new Error('Server returned invalid room status');
  }
  return json;
}

function roomApiUrl(access: RoomAccess, endpoint: 'updates' | 'status'): string {
  const base = new URL(access.serverUrl);
  const basePath = base.pathname.replace(/\/+$/, '');
  base.pathname = `${basePath}/rooms/${encodeURIComponent(access.roomId)}/${endpoint}`;
  base.search = '';
  base.hash = '';
  return base.toString();
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Server returned ${response.status}: ${text}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error('Server returned invalid JSON', { cause: error });
  }
}

function isEncryptedUpdateRecord(value: unknown): value is EncryptedUpdateRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<EncryptedUpdateRecord>;
  return (
    typeof record.roomId === 'string' &&
    Number.isSafeInteger(record.seq) &&
    typeof record.senderId === 'string' &&
    isEncryptedPayload(record)
  );
}

function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<EncryptedPayload>;
  return typeof payload.nonce === 'string' && typeof payload.ciphertext === 'string';
}

function isRoomStatusResponse(value: unknown): value is RoomStatusResponse {
  if (!value || typeof value !== 'object') return false;
  const status = value as Partial<RoomStatusResponse>;
  return (
    typeof status.roomId === 'string' &&
    Number.isSafeInteger(status.recordCount) &&
    (status.latestSeq === null || Number.isSafeInteger(status.latestSeq))
  );
}
