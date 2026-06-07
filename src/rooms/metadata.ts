import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { EncryptedMarkdownSnapshot, MarkdownDocumentSummary } from './markdown-snapshot.js';

export const ROOM_METADATA_VERSION = 1;

export interface RoomMetadataFile {
  version: typeof ROOM_METADATA_VERSION;
  rooms: RoomMetadataEntry[];
}

export interface RoomMetadataEntry {
  roomId: string;
  serverUrl: string;
  roomUrl: string;
  token: string;
  sourcePath: string;
  createdAt: string;
  updatedAt: string;
  document: MarkdownDocumentSummary;
  encryptedSnapshot: EncryptedMarkdownSnapshot;
}

export function defaultMetadataPath(cwd: string): string {
  return join(cwd, '.mdroom', 'rooms.json');
}

export async function readRoomMetadata(path: string): Promise<RoomMetadataFile> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if (isNotFoundError(error)) {
      return emptyMetadata();
    }
    throw error;
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!isRoomMetadataFile(parsed)) {
    throw new Error(`Invalid room metadata schema at ${path}`);
  }

  return parsed;
}

export async function writeRoomMetadata(path: string, metadata: RoomMetadataFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
}

export async function upsertRoomMetadata(path: string, entry: RoomMetadataEntry): Promise<RoomMetadataFile> {
  const metadata = await readRoomMetadata(path);
  const existing = metadata.rooms.findIndex((room) => room.roomId === entry.roomId && room.serverUrl === entry.serverUrl);
  const rooms = [...metadata.rooms];
  if (existing === -1) {
    rooms.push(entry);
  } else {
    rooms[existing] = {
      ...entry,
      createdAt: rooms[existing]?.createdAt ?? entry.createdAt,
    };
  }

  const next: RoomMetadataFile = {
    version: ROOM_METADATA_VERSION,
    rooms,
  };
  await writeRoomMetadata(path, next);
  return next;
}

export async function findRoomMetadata(
  path: string,
  roomId: string,
  serverUrl: string,
): Promise<RoomMetadataEntry | undefined> {
  const metadata = await readRoomMetadata(path);
  return metadata.rooms.find((room) => room.roomId === roomId && room.serverUrl === serverUrl);
}

export function resolveSourcePath(cwd: string, filePath: string): string {
  return resolve(cwd, filePath);
}

function emptyMetadata(): RoomMetadataFile {
  return {
    version: ROOM_METADATA_VERSION,
    rooms: [],
  };
}

function isRoomMetadataFile(value: unknown): value is RoomMetadataFile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RoomMetadataFile>;
  return candidate.version === ROOM_METADATA_VERSION && Array.isArray(candidate.rooms);
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}
