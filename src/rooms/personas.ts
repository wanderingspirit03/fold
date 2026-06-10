import { createHash } from 'node:crypto';

export type ParticipantKind = 'human' | 'agent';

export interface RoomPersona {
  schema: 'fold.persona.v1';
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
  'Patch Pilot',
  'Diff Lantern',
  'Merge Signal',
  'Token Loom',
  'Branch Echo',
  'Commit Atlas',
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
  '#1e3a8a',
  '#0f766e',
  '#15803d',
  '#b45309',
  '#be123c',
  '#0369a1',
  '#334155',
  '#4338ca',
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
    schema: 'fold.persona.v1',
    id,
    kind: options.participantKind,
    name,
    label: options.participantKind === 'agent' ? 'Agent' : 'Human',
    color,
    participantFingerprint: options.participantFingerprint,
  };
}
