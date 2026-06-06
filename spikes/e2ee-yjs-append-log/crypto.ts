import { webcrypto } from 'node:crypto';

const encoder = new TextEncoder();

export interface EncryptedPayload {
  nonce: string;
  ciphertext: string;
}

export interface EncryptedUpdateMetadata {
  roomId: string;
  senderId: string;
}

export async function deriveRoomKey(roomId: string, roomSecret: string): Promise<CryptoKey> {
  const inputKey = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(roomSecret),
    'HKDF',
    false,
    ['deriveKey'],
  );

  return webcrypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(`agent-md-rooms:${roomId}`),
      info: encoder.encode('yjs-update-append-log:v1'),
    },
    inputKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptUpdate(
  update: Uint8Array,
  key: CryptoKey,
  metadata: EncryptedUpdateMetadata,
): Promise<EncryptedPayload> {
  const nonce = webcrypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await webcrypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: metadataAdditionalData(metadata),
    },
    key,
    update,
  );

  return {
    nonce: toBase64Url(nonce),
    ciphertext: toBase64Url(new Uint8Array(ciphertext)),
  };
}

export async function decryptUpdate(
  payload: EncryptedPayload,
  key: CryptoKey,
  metadata: EncryptedUpdateMetadata,
): Promise<Uint8Array> {
  const plaintext = await webcrypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromBase64Url(payload.nonce),
      additionalData: metadataAdditionalData(metadata),
    },
    key,
    fromBase64Url(payload.ciphertext),
  );

  return new Uint8Array(plaintext);
}

function metadataAdditionalData(metadata: EncryptedUpdateMetadata): Uint8Array {
  return encoder.encode(JSON.stringify({
    roomId: metadata.roomId,
    senderId: metadata.senderId,
  }));
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

function fromBase64Url(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64url'));
}
