export type ParticipantKind = "human" | "agent";

export interface RoomPersona {
  schema: "fold.persona.v1";
  id: string;
  kind: ParticipantKind;
  name: string;
  label: "Human" | "Agent";
  color: string;
  participantFingerprint: string;
}

const AGENT_NAMES = [
  "Patch Pilot",
  "Diff Lantern",
  "Merge Signal",
  "Token Loom",
  "Branch Echo",
  "Commit Atlas",
] as const;

const HUMAN_NAMES = [
  "Reader North",
  "Editor Vale",
  "Reviewer Stone",
  "Writer Quinn",
  "Archivist Reed",
  "Curator Lane",
] as const;

const COLORS = [
  "#1e3a8a",
  "#0f766e",
  "#15803d",
  "#b45309",
  "#be123c",
  "#0369a1",
  "#334155",
  "#4338ca",
] as const;

export function assignWebPersona(options: {
  roomId: string;
  participantKind: "human" | "agent";
  participantFingerprint: string;
}): RoomPersona {
  const seed = `${options.roomId}\0${options.participantKind}\0${options.participantFingerprint}`;
  const digest = simpleHashBytes(seed);
  const names = options.participantKind === "agent" ? AGENT_NAMES : HUMAN_NAMES;
  const name = names[digest[0] % names.length] ?? names[0];
  const color = COLORS[digest[1] % COLORS.length] ?? COLORS[0];
  const id = simpleHashBytes(`persona\0${seed}`)
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return {
    schema: "fold.persona.v1",
    id,
    kind: options.participantKind,
    name,
    label: options.participantKind === "agent" ? "Agent" : "Human",
    color,
    participantFingerprint: options.participantFingerprint,
  };
}

function simpleHashBytes(value: string): number[] {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  const bytes: number[] = [];
  let state = hash;
  for (let index = 0; index < 32; index += 1) {
    let mixed = (state += 0x6d2b79f5);
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    bytes.push(((mixed ^ (mixed >>> 14)) >>> 0) % 256);
  }
  return bytes;
}
