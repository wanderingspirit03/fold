import { describe, expect, it } from 'vitest';
import { AppendLogStore } from '../server/append-log.js';
import { createEncryptedCommentRecord, replayCommentsFromRecords, type RoomComment } from './comments.js';
import { createRoomAccess } from './room-reference.js';

describe('encrypted room comments', () => {
  it('replays agent request thread records without exposing request text to the server log', async () => {
    const access = createRoomAccess();
    const store = new AppendLogStore();
    const request: RoomComment = {
      id: 'request-1',
      authorPersonaId: 'persona-agent-requester',
      persona: {
        schema: 'fold.persona.v1',
        id: 'persona-agent-requester',
        name: 'Branch Echo',
        label: 'Agent',
        kind: 'agent',
        color: '#1e3a8a',
        participantFingerprint: 'agent-requester',
      },
      filePath: 'docs/PLAN.md',
      text: 'Please check whether this section needs a proposal.',
      createdAt: new Date().toISOString(),
      type: 'request',
      anchorType: 'text-range',
      selectedQuote: 'Keep Markdown canonical.',
    };

    store.append(access.roomId, await createEncryptedCommentRecord(access, request));
    const replayed = await replayCommentsFromRecords(access, store.list(access.roomId));

    expect(replayed).toHaveLength(1);
    expect(replayed[0]?.type).toBe('request');
    expect(replayed[0]?.selectedQuote).toBe('Keep Markdown canonical.');
    expect(store.serialized(access.roomId)).not.toContain('Please check');
    expect(store.serialized(access.roomId)).not.toContain('Keep Markdown canonical');
  });
});
