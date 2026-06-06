import { setTimeout as delay } from 'node:timers/promises';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { decryptUpdate, deriveRoomKey, encryptUpdate } from './crypto.js';
import type { EncryptedUpdateRecord } from './server.js';

export interface EncryptedYjsClientOptions {
  serverUrl: string;
  roomId: string;
  roomSecret: string;
  clientId: string;
}

export class EncryptedYjsClient {
  readonly doc = new Y.Doc();
  readonly markdown = this.doc.getText('markdown');

  private readonly options: EncryptedYjsClientOptions;
  private roomKey?: CryptoKey;
  private socket?: WebSocket;
  private messageQueue = Promise.resolve();

  constructor(options: EncryptedYjsClientOptions) {
    this.options = options;
  }

  async connect(): Promise<void> {
    this.roomKey = await deriveRoomKey(this.options.roomId, this.options.roomSecret);
    this.socket = new WebSocket(this.wsUrl());

    const initialSync = new Promise<void>((resolve, reject) => {
      this.socket?.on('message', (raw) => {
        this.messageQueue = this.messageQueue
          .then(() => this.handleServerMessage(raw.toString()))
          .then((isInitialSyncComplete) => {
            if (isInitialSyncComplete) resolve();
          })
          .catch(reject);
      });
      this.socket?.once('close', () => reject(new Error('Socket closed before initial sync completed')));
      this.socket?.once('error', reject);
    });

    await new Promise<void>((resolve, reject) => {
      this.socket?.once('open', resolve);
      this.socket?.once('error', reject);
    });
    await initialSync;

    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === this) return;
      void this.sendEncryptedUpdate(update);
    });
  }

  disconnect(): void {
    this.socket?.close();
    this.doc.destroy();
  }

  async waitForText(expected: string, timeoutMs = 2_000): Promise<void> {
    const started = performance.now();
    while (performance.now() - started < timeoutMs) {
      if (this.markdown.toString() === expected) return;
      await delay(20);
    }

    throw new Error(`Timed out waiting for text ${JSON.stringify(expected)}. Current text: ${JSON.stringify(this.markdown.toString())}`);
  }

  private async handleServerMessage(raw: string): Promise<boolean> {
    const message = JSON.parse(raw) as { type?: string; record?: EncryptedUpdateRecord };
    if (message.type === 'sync-complete') return true;
    if (message.type !== 'encrypted-update' || !message.record) return false;

    const update = await decryptUpdate(message.record, this.key(), {
      roomId: message.record.roomId,
      senderId: message.record.senderId,
    });
    Y.applyUpdate(this.doc, update, this);
    return false;
  }

  private async sendEncryptedUpdate(update: Uint8Array): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    const encrypted = await encryptUpdate(update, this.key(), {
      roomId: this.options.roomId,
      senderId: this.options.clientId,
    });
    this.socket.send(JSON.stringify({
      type: 'encrypted-update',
      update: {
        senderId: this.options.clientId,
        ...encrypted,
      },
    }));
  }

  private wsUrl(): string {
    const url = new URL(this.options.serverUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = `/rooms/${encodeURIComponent(this.options.roomId)}/ws`;
    return url.toString();
  }

  private key(): CryptoKey {
    if (!this.roomKey) throw new Error('Room key is not initialized');
    return this.roomKey;
  }
}
