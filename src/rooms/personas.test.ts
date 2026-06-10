import { describe, expect, it } from 'vitest';
import { assignPersona } from './personas.js';

describe('room personas', () => {
  it('assigns stable agent personas from room and participant fingerprint', () => {
    const first = assignPersona({
      roomId: 'room-a',
      participantKind: 'agent',
      participantFingerprint: 'fold-cli:proposal',
    });
    const second = assignPersona({
      roomId: 'room-a',
      participantKind: 'agent',
      participantFingerprint: 'fold-cli:proposal',
    });

    expect(second).toEqual(first);
    expect(first.kind).toBe('agent');
    expect(first.label).toBe('Agent');
    expect(first.name).toMatch(/Patch Pilot|Diff Lantern|Merge Signal|Token Loom|Branch Echo|Commit Atlas/);
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
