import { describe, expect, it } from 'vitest';
import { assignPersona } from './personas.js';

describe('room personas', () => {
  it('assigns stable agent personas from room and participant fingerprint', () => {
    const first = assignPersona({
      roomId: 'room-a',
      participantKind: 'agent',
      participantFingerprint: 'mdroom-cli:proposal',
    });
    const second = assignPersona({
      roomId: 'room-a',
      participantKind: 'agent',
      participantFingerprint: 'mdroom-cli:proposal',
    });

    expect(second).toEqual(first);
    expect(first.kind).toBe('agent');
    expect(first.label).toBe('Agent');
    expect(first.name).toMatch(/Captain Diffbeard|Markdown Goblin|Professor Patchwell|Syntax Ferret|Lady Changelog|Dr\. Footnote/);
  });

  it('separates human and agent persona namespaces', () => {
    const base = {
      roomId: 'room-a',
      participantFingerprint: 'same-participant',
    };

    const human = assignPersona({ ...base, participantKind: 'human' });
    const agent = assignPersona({ ...base, participantKind: 'agent' });

    expect(human.kind).toBe('human');
    expect(agent.kind).toBe('agent');
    expect(human.id).not.toBe(agent.id);
    expect(human.label).toBe('Human');
    expect(agent.label).toBe('Agent');
  });
});
