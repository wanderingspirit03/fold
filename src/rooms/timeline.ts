import { randomUUID } from 'node:crypto';
import {
  decryptUpdate,
  deriveRoomKey,
  encryptUpdate,
  type EncryptedPayload,
} from '../../spikes/e2ee-yjs-append-log/crypto.js';
import type { EncryptedUpdateRecord, IncomingEncryptedUpdate } from '../server/append-log.js';
import type { RoomAccess } from './room-reference.js';

export const TIMELINE_EVENT_SCHEMA = 'mdroom.timeline-event.v1';
export const TIMELINE_EVENT_SENDER_ID_PREFIX = 'mdroom-cli:event';

export type TimelineEventType =
  | 'publish'
  | 'proposal_submitted'
  | 'proposal_accepted'
  | 'proposal_rejected'
  | 'export';

export interface TimelineEvent {
  schema: typeof TIMELINE_EVENT_SCHEMA;
  id: string;
  type: TimelineEventType;
  createdAt: string;
  actorPersonaId: string;
  proposalId: string | null;
  documentSha256: string | null;
  message: string;
}

export async function createEncryptedTimelineEvent(
  access: RoomAccess,
  event: TimelineEvent,
): Promise<IncomingEncryptedUpdate> {
  const senderId = `${TIMELINE_EVENT_SENDER_ID_PREFIX}:${event.id}`;
  return encryptJsonRecord(access, senderId, event);
}

export function createTimelineEvent(input: Omit<TimelineEvent, 'schema' | 'id' | 'createdAt'> & {
  idSeed?: string;
  createdAt?: string;
}): TimelineEvent {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    schema: TIMELINE_EVENT_SCHEMA,
    id: randomUUID(),
    type: input.type,
    createdAt,
    actorPersonaId: input.actorPersonaId,
    proposalId: input.proposalId,
    documentSha256: input.documentSha256,
    message: input.message,
  };
}

export async function decryptTimelineEventsFromRecords(
  access: RoomAccess,
  records: EncryptedUpdateRecord[],
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  for (const record of records) {
    if (!record.senderId.startsWith(TIMELINE_EVENT_SENDER_ID_PREFIX)) continue;
    events.push(await decryptTimelineEvent(access, record, record.senderId));
  }
  return replayTimelineEvents(events);
}

export function replayTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function decryptTimelineEvent(
  access: RoomAccess,
  payload: EncryptedPayload,
  senderId: string,
): Promise<TimelineEvent> {
  const value = await decryptJsonRecord(access, payload, senderId);
  if (!isTimelineEvent(value)) {
    throw new Error('Invalid encrypted timeline event payload');
  }
  return value;
}

export async function encryptJsonRecord(
  access: RoomAccess,
  senderId: string,
  value: unknown,
): Promise<IncomingEncryptedUpdate> {
  const roomKey = await deriveRoomKey(access.roomId, access.roomSecret);
  const encrypted = await encryptUpdate(Buffer.from(JSON.stringify(value), 'utf8'), roomKey, {
    roomId: access.roomId,
    senderId,
  });
  return {
    senderId,
    ...encrypted,
  };
}

export async function decryptJsonRecord(
  access: RoomAccess,
  payload: EncryptedPayload,
  senderId: string,
): Promise<unknown> {
  const roomKey = await deriveRoomKey(access.roomId, access.roomSecret);
  const bytes = await decryptUpdate(payload, roomKey, {
    roomId: access.roomId,
    senderId,
  });
  return JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown;
}

function isTimelineEvent(value: unknown): value is TimelineEvent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TimelineEvent>;
  return (
    candidate.schema === TIMELINE_EVENT_SCHEMA &&
    isTimelineEventType(candidate.type) &&
    typeof candidate.id === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.actorPersonaId === 'string' &&
    (typeof candidate.proposalId === 'string' || candidate.proposalId === null) &&
    (typeof candidate.documentSha256 === 'string' || candidate.documentSha256 === null) &&
    typeof candidate.message === 'string'
  );
}

function isTimelineEventType(value: unknown): value is TimelineEventType {
  return (
    value === 'publish' ||
    value === 'proposal_submitted' ||
    value === 'proposal_accepted' ||
    value === 'proposal_rejected' ||
    value === 'export'
  );
}
