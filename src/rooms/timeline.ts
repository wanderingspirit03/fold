import { randomUUID } from 'node:crypto';
import type { EncryptedPayload } from './crypto.js';
import type { EncryptedUpdateRecord, IncomingEncryptedUpdate } from '../server/append-log.js';
import type { ProjectSnapshot } from './project-state.js';
import type { RoomAccess } from './room-reference.js';
import { decryptJsonRecord, encryptJsonRecord } from './encrypted-records.js';

export const TIMELINE_EVENT_SCHEMA = 'fold.timeline-event.v1';
export const TIMELINE_EVENT_SENDER_ID_PREFIX = 'fold-cli:event';

export type TimelineEventType =
  | 'publish'
  | 'file_posted'
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
  acceptedProject?: ProjectSnapshot;
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
    acceptedProject: input.acceptedProject,
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
    typeof candidate.message === 'string' &&
    (
      candidate.acceptedProject === undefined ||
      (
        candidate.acceptedProject.schema === 'fold.project.v1' &&
        typeof candidate.acceptedProject.primaryPath === 'string' &&
        typeof candidate.acceptedProject.updatedAt === 'string' &&
        Array.isArray(candidate.acceptedProject.files)
      )
    )
  );
}

function isTimelineEventType(value: unknown): value is TimelineEventType {
  return (
    value === 'publish' ||
    value === 'file_posted' ||
    value === 'proposal_submitted' ||
    value === 'proposal_accepted' ||
    value === 'proposal_rejected' ||
    value === 'export'
  );
}
