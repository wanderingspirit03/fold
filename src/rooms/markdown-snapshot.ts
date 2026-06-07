import { createHash } from 'node:crypto';
import * as Y from 'yjs';
import {
  decryptUpdate,
  deriveRoomKey,
  encryptUpdate,
  type EncryptedPayload,
} from '../../spikes/e2ee-yjs-append-log/crypto.js';
import type { RoomAccess } from './room-reference.js';

export const MARKDOWN_YTEXT_NAME = 'markdown';
export const MARKDOWN_CANONICAL = 'y.text:markdown';
export const ENCRYPTED_SNAPSHOT_FORMAT = 'encrypted-yjs-update-v1';

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
  const doc = new Y.Doc();
  try {
    doc.getText(MARKDOWN_YTEXT_NAME).insert(0, markdown);
    const update = Y.encodeStateAsUpdate(doc);
    const roomKey = await deriveRoomKey(access.roomId, access.roomSecret);
    const encrypted = await encryptUpdate(update, roomKey, {
      roomId: access.roomId,
      senderId,
    });

    return {
      format: ENCRYPTED_SNAPSHOT_FORMAT,
      senderId,
      ...encrypted,
    };
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

export function summarizeMarkdown(markdown: string): MarkdownDocumentSummary {
  const bytes = Buffer.byteLength(markdown, 'utf8');
  return {
    canonical: MARKDOWN_CANONICAL,
    bytes,
    sha256: createHash('sha256').update(markdown).digest('hex'),
  };
}
