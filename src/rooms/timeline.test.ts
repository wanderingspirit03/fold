import { describe, expect, it } from 'vitest';
import { createRoomAccess } from './room-reference.js';
import {
  createEncryptedTimelineEvent,
  decryptTimelineEventsFromRecords,
  replayTimelineEvents,
  type TimelineEvent,
} from './timeline.js';
import type { EncryptedUpdateRecord } from '../server/append-log.js';

describe('encrypted room timeline', () => {
  it('decrypts and replays publish, proposal, accept, and reject events', async () => {
    const access = createRoomAccess();
    const events: TimelineEvent[] = [
      {
        schema: 'mdroom.timeline-event.v1',
        id: 'evt-publish',
        type: 'publish',
        createdAt: '2026-06-07T00:00:00.000Z',
        actorPersonaId: 'persona-agent',
        proposalId: null,
        documentSha256: 'sha-publish',
        message: 'Published Markdown room',
      },
      {
        schema: 'mdroom.timeline-event.v1',
        id: 'evt-propose',
        type: 'proposal_submitted',
        createdAt: '2026-06-07T00:01:00.000Z',
        actorPersonaId: 'persona-agent',
        proposalId: 'prop-1',
        documentSha256: 'sha-proposed',
        message: 'Submitted proposal',
      },
      {
        schema: 'mdroom.timeline-event.v1',
        id: 'evt-accept',
        type: 'proposal_accepted',
        createdAt: '2026-06-07T00:02:00.000Z',
        actorPersonaId: 'persona-human',
        proposalId: 'prop-1',
        documentSha256: 'sha-proposed',
        message: 'Accepted proposal',
      },
      {
        schema: 'mdroom.timeline-event.v1',
        id: 'evt-reject',
        type: 'proposal_rejected',
        createdAt: '2026-06-07T00:03:00.000Z',
        actorPersonaId: 'persona-human',
        proposalId: 'prop-2',
        documentSha256: null,
        message: 'Rejected proposal',
      },
    ];
    const records: EncryptedUpdateRecord[] = [];
    for (const event of events) {
      const update = await createEncryptedTimelineEvent(access, event);
      records.push({
        roomId: access.roomId,
        seq: records.length + 1,
        ...update,
      });
    }

    const decrypted = await decryptTimelineEventsFromRecords(access, records);
    expect(decrypted).toEqual(events);
    expect(replayTimelineEvents(decrypted)).toEqual(events);
  });
});
