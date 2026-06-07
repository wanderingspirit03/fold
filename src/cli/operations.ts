import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import {
  createEncryptedMarkdownSnapshot,
  decryptMarkdownSnapshot,
  summarizeMarkdown,
} from '../rooms/markdown-snapshot.js';
import {
  createRoomAccess,
  createRoomToken,
  DEFAULT_SERVER_URL,
  parseRoomReference,
  roomUrlForAccess,
  serverRoomUrlForAccess,
  type RoomAccess,
} from '../rooms/room-reference.js';
import {
  defaultMetadataPath,
  findRoomMetadata,
  resolveSourcePath,
  upsertRoomMetadata,
  type RoomMetadataEntry,
} from '../rooms/metadata.js';
import type { ExportResult, PublicRoomResult, PublishResult, StatusResult } from './results.js';

const CLI_SENDER_ID = 'mdroom-cli';
const SERVER_TODO = 'Server publish/export/status is not implemented in this bounded CLI skeleton; only local encrypted room metadata is used.';

export interface PublishOptions {
  cwd: string;
  filePath: string;
  serverUrl?: string;
  save: boolean;
}

export interface ExportOptions {
  cwd: string;
  room: string;
  outputPath?: string;
}

export interface StatusOptions {
  cwd: string;
  room: string;
}

export async function publishMarkdown(options: PublishOptions): Promise<PublishResult> {
  const sourcePath = resolveSourcePath(options.cwd, options.filePath);
  const markdown = await readFile(sourcePath, 'utf8');
  const access = createRoomAccess(options.serverUrl ?? DEFAULT_SERVER_URL);
  const document = summarizeMarkdown(markdown);
  const encryptedSnapshot = await createEncryptedMarkdownSnapshot(markdown, access, CLI_SENDER_ID);
  const token = createRoomToken(access);
  const metadataPath = defaultMetadataPath(options.cwd);
  const now = new Date().toISOString();

  if (options.save) {
    const entry: RoomMetadataEntry = {
      roomId: access.roomId,
      serverUrl: access.serverUrl,
      roomUrl: roomUrlForAccess(access),
      token,
      sourcePath,
      createdAt: now,
      updatedAt: now,
      document,
      encryptedSnapshot,
    };
    await upsertRoomMetadata(metadataPath, entry);
  }

  return {
    schema: 'mdroom.publish.result.v1',
    ok: true,
    mode: 'local-token',
    room: publicRoomResult(access, token),
    metadata: {
      path: metadataPath,
      saved: options.save,
    },
    document,
    todo: [SERVER_TODO],
  };
}

export async function exportMarkdown(options: ExportOptions): Promise<ExportResult> {
  const reference = parseRoomReference(options.room);
  const metadataPath = defaultMetadataPath(options.cwd);
  const entry = await findRoomMetadata(metadataPath, reference.roomId, reference.serverUrl);
  if (!entry) {
    throw new Error('No local metadata found for room; server export is not implemented in this CLI skeleton');
  }

  const markdown = await decryptMarkdownSnapshot(entry.encryptedSnapshot, reference);
  const document = summarizeMarkdown(markdown);
  const outputPath = options.outputPath ? resolve(options.cwd, options.outputPath) : null;
  if (outputPath) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, markdown, 'utf8');
  }

  return {
    schema: 'mdroom.export.result.v1',
    ok: true,
    mode: 'local-token',
    room: publicRoomResult(reference, createRoomToken(reference)),
    metadata: {
      path: metadataPath,
      found: true,
    },
    output: {
      path: outputPath,
      written: Boolean(outputPath),
      bytes: document.bytes,
      sha256: document.sha256,
    },
    document: {
      ...document,
      markdown,
    },
    todo: [SERVER_TODO],
  };
}

export async function roomStatus(options: StatusOptions): Promise<StatusResult> {
  const reference = parseRoomReference(options.room);
  const metadataPath = defaultMetadataPath(options.cwd);
  const entry = await findRoomMetadata(metadataPath, reference.roomId, reference.serverUrl);

  return {
    schema: 'mdroom.status.result.v1',
    ok: true,
    mode: 'local-token',
    room: publicRoomResult(reference, createRoomToken(reference)),
    metadata: {
      path: metadataPath,
      found: Boolean(entry),
      sourcePath: entry?.sourcePath ?? null,
      createdAt: entry?.createdAt ?? null,
      updatedAt: entry?.updatedAt ?? null,
    },
    document: entry?.document ?? null,
    server: {
      checked: false,
      reason: SERVER_TODO,
    },
    todo: [SERVER_TODO],
  };
}

function publicRoomResult(access: RoomAccess, token: string): PublicRoomResult {
  return {
    roomId: access.roomId,
    serverUrl: access.serverUrl,
    serverRoomUrl: serverRoomUrlForAccess(access),
    url: roomUrlForAccess(access),
    token,
    hasClientKey: true,
  };
}
