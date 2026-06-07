import { describe, expect, it } from 'vitest';
import {
  createRoomToken,
  parseRoomReference,
  roomUrlForAccess,
  serverRoomUrlForAccess,
  type RoomAccess,
} from './room-reference.js';

describe('room references', () => {
  const access: RoomAccess = {
    roomId: 'room with spaces',
    roomSecret: 'client-side-secret',
    serverUrl: 'https://rooms.example.test',
  };

  it('round-trips mdroom tokens with stable client-side key material', () => {
    const token = createRoomToken(access);
    const parsed = parseRoomReference(token);

    expect(parsed).toMatchObject({
      kind: 'token',
      roomId: access.roomId,
      roomSecret: access.roomSecret,
      serverUrl: access.serverUrl,
    });
    expect(parsed.roomUrl).toBe(roomUrlForAccess(access));
    expect(parsed.serverRoomUrl).toBe(serverRoomUrlForAccess(access));
  });

  it('parses room URLs without leaking the fragment key into server URLs', () => {
    const parsed = parseRoomReference('https://rooms.example.test/room/abc123#key=private-key');

    expect(parsed.kind).toBe('url');
    expect(parsed.roomId).toBe('abc123');
    expect(parsed.roomSecret).toBe('private-key');
    expect(parsed.serverUrl).toBe('https://rooms.example.test');
    expect(parsed.serverRoomUrl).toBe('https://rooms.example.test/room/abc123');
    expect(parsed.serverRoomUrl).not.toContain('#');
    expect(parsed.serverRoomUrl).not.toContain('private-key');
  });

  it('preserves server base paths when parsing room URLs', () => {
    const parsed = parseRoomReference('https://rooms.example.test/base/room/abc123#key=private-key');

    expect(parsed.roomId).toBe('abc123');
    expect(parsed.roomSecret).toBe('private-key');
    expect(parsed.serverUrl).toBe('https://rooms.example.test/base');
    expect(parsed.serverRoomUrl).toBe('https://rooms.example.test/base/room/abc123');
    expect(parsed.roomUrl).toBe('https://rooms.example.test/base/room/abc123#key=private-key');
  });

  it('rejects room URLs without fragment key material', () => {
    expect(() => parseRoomReference('https://rooms.example.test/room/abc123')).toThrow(/#key/);
  });
});
