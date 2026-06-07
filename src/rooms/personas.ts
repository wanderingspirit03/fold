import { createHash } from 'node:crypto';

export type ParticipantKind = 'human' | 'agent';

export interface RoomPersona {
  schema: 'mdroom.persona.v1';
  id: string;
  kind: ParticipantKind;
  name: string;
  label: 'Human' | 'Agent';
  color: string;
  participantFingerprint: string;
}

export interface AssignPersonaOptions {
  roomId: string;
  participantKind: ParticipantKind;
  participantFingerprint: string;
}

const AGENT_NAMES = [
  'Captain Diffbeard',
  'Markdown Goblin',
  'Professor Patchwell',
  'Syntax Ferret',
  'Lady Changelog',
  'Dr. Footnote',
] as const;

const HUMAN_NAMES = [
  'Reader North',
  'Editor Vale',
  'Reviewer Stone',
  'Writer Quinn',
  'Archivist Reed',
  'Curator Lane',
] as const;

const COLORS = [
  '#2563eb',
  '#16a34a',
  '#dc2626',
  '#9333ea',
  '#0891b2',
  '#ca8a04',
  '#db2777',
  '#475569',
] as const;

export function assignPersona(options: AssignPersonaOptions): RoomPersona {
  const seed = `${options.roomId}\0${options.participantKind}\0${options.participantFingerprint}`;
  const digest = createHash('sha256').update(seed).digest();
  const names = options.participantKind === 'agent' ? AGENT_NAMES : HUMAN_NAMES;
  const name = names[digest[0] % names.length] ?? names[0];
  const color = COLORS[digest[1] % COLORS.length] ?? COLORS[0];
  const id = createHash('sha256')
    .update(`persona\0${seed}`)
    .digest('hex')
    .slice(0, 24);

  return {
    schema: 'mdroom.persona.v1',
    id,
    kind: options.participantKind,
    name,
    label: options.participantKind === 'agent' ? 'Agent' : 'Human',
    color,
    participantFingerprint: options.participantFingerprint,
  };
}
