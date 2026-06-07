import { createHash } from 'node:crypto';
import * as Y from 'yjs';
import {
  decryptUpdate,
  deriveRoomKey,
  encryptUpdate,
  type EncryptedPayload,
} from '../../spikes/e2ee-yjs-append-log/crypto.js';
import type { EncryptedUpdateRecord, IncomingEncryptedUpdate } from '../../spikes/e2ee-yjs-append-log/server.js';
import type { RoomAccess } from './room-reference.js';

export const MARKDOWN_YTEXT_NAME = 'markdown';
export const MARKDOWN_CANONICAL = 'y.text:markdown';
export const ENCRYPTED_SNAPSHOT_FORMAT = 'encrypted-yjs-update-v1';
export const DOCUMENT_UPDATE_SENDER_ID = 'mdroom-cli:document';
export const SUGGESTION_UPDATE_SENDER_ID_PREFIX = 'mdroom-cli:suggestion';

export interface EncryptedMarkdownSnapshot extends EncryptedPayload {
  format: typeof ENCRYPTED_SNAPSHOT_FORMAT;
  senderId: string;
}

export interface MarkdownDocumentSummary {
  canonical: typeof MARKDOWN_CANONICAL;
  bytes: number;
  sha256: string;
}

export async function createEncryptedMarkdownSnapshot(
  markdown: string,
  access: RoomAccess,
  senderId: string,
): Promise<EncryptedMarkdownSnapshot> {
  const encrypted = await createEncryptedMarkdownUpdate(markdown, access, senderId);

  return {
    format: ENCRYPTED_SNAPSHOT_FORMAT,
    senderId,
    nonce: encrypted.nonce,
    ciphertext: encrypted.ciphertext,
  };
}

export async function createEncryptedMarkdownUpdate(
  markdown: string,
  access: RoomAccess,
  senderId = DOCUMENT_UPDATE_SENDER_ID,
): Promise<IncomingEncryptedUpdate> {
  const doc = new Y.Doc();
  try {
    doc.getText(MARKDOWN_YTEXT_NAME).insert(0, markdown);
    const update = Y.encodeStateAsUpdate(doc);
    return encryptMarkdownYjsUpdate(update, access, senderId);
  } finally {
    doc.destroy();
  }
}

export async function createEncryptedMarkdownReplacementUpdate(
  currentMarkdown: string,
  replacementMarkdown: string,
  access: RoomAccess,
  senderId = DOCUMENT_UPDATE_SENDER_ID,
): Promise<IncomingEncryptedUpdate> {
  const doc = new Y.Doc();
  try {
    const text = doc.getText(MARKDOWN_YTEXT_NAME);
    text.insert(0, currentMarkdown);
    const beforeReplacement = Y.encodeStateVector(doc);
    text.delete(0, text.length);
    text.insert(0, replacementMarkdown);
    const update = Y.encodeStateAsUpdate(doc, beforeReplacement);
    return encryptMarkdownYjsUpdate(update, access, senderId);
  } finally {
    doc.destroy();
  }
}

export async function createEncryptedMarkdownReplacementUpdateFromRecords(
  records: EncryptedUpdateRecord[],
  replacementMarkdown: string,
  access: RoomAccess,
  senderId = DOCUMENT_UPDATE_SENDER_ID,
): Promise<IncomingEncryptedUpdate> {
  const doc = new Y.Doc();
  try {
    assertContiguousRecords(records, access.roomId);
    const roomKey = await deriveRoomKey(access.roomId, access.roomSecret);
    for (const record of records) {
      if (record.senderId !== DOCUMENT_UPDATE_SENDER_ID) continue;

      const update = await decryptUpdate(record, roomKey, {
        roomId: record.roomId,
        senderId: record.senderId,
      });
      Y.applyUpdate(doc, update, 'server-replacement');
    }

    const text = doc.getText(MARKDOWN_YTEXT_NAME);
    const beforeReplacement = Y.encodeStateVector(doc);
    text.delete(0, text.length);
    text.insert(0, replacementMarkdown);
    const update = Y.encodeStateAsUpdate(doc, beforeReplacement);
    return encryptMarkdownYjsUpdate(update, access, senderId);
  } finally {
    doc.destroy();
  }
}

export async function decryptMarkdownSnapshot(
  snapshot: EncryptedMarkdownSnapshot,
  access: RoomAccess,
): Promise<string> {
  if (snapshot.format !== ENCRYPTED_SNAPSHOT_FORMAT) {
    throw new Error(`Unsupported encrypted snapshot format ${JSON.stringify(snapshot.format)}`);
  }

  const doc = new Y.Doc();
  try {
    const roomKey = await deriveRoomKey(access.roomId, access.roomSecret);
    const update = await decryptUpdate(snapshot, roomKey, {
      roomId: access.roomId,
      senderId: snapshot.senderId,
    });
    Y.applyUpdate(doc, update, 'local-export');
    return doc.getText(MARKDOWN_YTEXT_NAME).toString();
  } finally {
    doc.destroy();
  }
}

export async function decryptMarkdownFromRecords(
  records: EncryptedUpdateRecord[],
  access: RoomAccess,
): Promise<string> {
  const doc = new Y.Doc();
  try {
    assertContiguousRecords(records, access.roomId);
    const roomKey = await deriveRoomKey(access.roomId, access.roomSecret);
    for (const record of records) {
      if (record.senderId !== DOCUMENT_UPDATE_SENDER_ID) continue;

      const update = await decryptUpdate(record, roomKey, {
        roomId: record.roomId,
        senderId: record.senderId,
      });
      Y.applyUpdate(doc, update, 'server-export');
    }

    return doc.getText(MARKDOWN_YTEXT_NAME).toString();
  } finally {
    doc.destroy();
  }
}

export function summarizeMarkdown(markdown: string): MarkdownDocumentSummary {
  const bytes = Buffer.byteLength(markdown, 'utf8');
  return {
    canonical: MARKDOWN_CANONICAL,
    bytes,
    sha256: createHash('sha256').update(markdown).digest('hex'),
  };
}

async function encryptMarkdownYjsUpdate(
  update: Uint8Array,
  access: RoomAccess,
  senderId: string,
): Promise<IncomingEncryptedUpdate> {
  const roomKey = await deriveRoomKey(access.roomId, access.roomSecret);
  const encrypted = await encryptUpdate(update, roomKey, {
    roomId: access.roomId,
    senderId,
  });

  return {
    senderId,
    ...encrypted,
  };
}

function assertContiguousRecords(records: EncryptedUpdateRecord[], roomId: string): void {
  let expectedSeq = 1;
  for (const record of records) {
    if (record.roomId !== roomId) {
      throw new Error(`Received update for unexpected room ${JSON.stringify(record.roomId)}`);
    }

    if (!Number.isSafeInteger(record.seq) || record.seq < 1) {
      throw new Error(`Received invalid append-log sequence ${record.seq}`);
    }

    if (record.seq !== expectedSeq) {
      throw new Error(`Detected missing, duplicate, or reordered append-log sequence ${record.seq}; expected ${expectedSeq}`);
    }

    expectedSeq += 1;
  }
}
