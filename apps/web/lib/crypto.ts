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
  const sub = typeof window !== 'undefined' ? window.crypto.subtle : crypto.subtle;
  const inputKey = await sub.importKey(
    'raw',
    encoder.encode(roomSecret),
    'HKDF',
    false,
    ['deriveKey'],
  );

  return sub.deriveKey(
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
  const sub = typeof window !== 'undefined' ? window.crypto.subtle : crypto.subtle;
  const iv = (typeof window !== 'undefined' ? window.crypto : crypto).getRandomValues(new Uint8Array(12) as any);
  const ciphertext = await sub.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as any,
      additionalData: metadataAdditionalData(metadata) as any,
    },
    key,
    update as any,
  );

  return {
    nonce: toBase64Url(iv as any),
    ciphertext: toBase64Url(new Uint8Array(ciphertext) as any),
  };
}

export async function decryptUpdate(
  payload: EncryptedPayload,
  key: CryptoKey,
  metadata: EncryptedUpdateMetadata,
): Promise<Uint8Array> {
  const sub = typeof window !== 'undefined' ? window.crypto.subtle : crypto.subtle;
  const plaintext = await sub.decrypt(
    {
      name: 'AES-GCM',
      iv: fromBase64Url(payload.nonce) as any,
      additionalData: metadataAdditionalData(metadata) as any,
    },
    key,
    fromBase64Url(payload.ciphertext) as any,
  );

  return new Uint8Array(plaintext);
}

function metadataAdditionalData(metadata: EncryptedUpdateMetadata): Uint8Array {
  return encoder.encode(JSON.stringify({
    roomId: metadata.roomId,
    senderId: metadata.senderId,
  }));
}

export function toBase64Url(bytes: any): string {
  const binary = Array.from(bytes).map(b => String.fromCharCode(b as any)).join('');
  const b64 = typeof window !== 'undefined' ? window.btoa(binary) : Buffer.from(bytes as any).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array {
  let b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = typeof window !== 'undefined' ? window.atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
