import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import {
  createEncryptedMarkdownSnapshot,
  createEncryptedMarkdownUpdate,
  decryptMarkdownFromRecords,
  decryptMarkdownSnapshot,
  summarizeMarkdown,
} from '../rooms/markdown-snapshot.js';
import {
  createRoomAccess,
  createRoomToken,
  DEFAULT_SERVER_URL,
  parseRoomReference,
  roomUrlForAccess,
  serverRoomUrlForAccess,
  type RoomAccess,
} from '../rooms/room-reference.js';
import {
  appendEncryptedUpdate,
  fetchRoomStatus,
  listEncryptedUpdates,
} from '../rooms/append-log-api.js';
import {
  defaultMetadataPath,
  findRoomMetadata,
  resolveSourcePath,
  upsertRoomMetadata,
  type RoomMetadataEntry,
} from '../rooms/metadata.js';
import {
  createEncryptedProposalRecord,
  createProposalAcceptedEvent,
  createProposalRejectedEvent,
  replayProposalsFromRecords,
  type ProposalView,
} from '../rooms/proposals.js';
import { assignPersona } from '../rooms/personas.js';
import {
  createEncryptedTimelineEvent,
  createTimelineEvent,
} from '../rooms/timeline.js';
import type {
  DecideProposalResult,
  ExportResult,
  PatchResult,
  ProposalsResult,
  ProposeResult,
  PublicRoomResult,
  PublishResult,
  ShowProposalResult,
  StatusResult,
} from './results.js';

const CLI_SENDER_ID = 'mdroom-cli:document';
const CLI_REVIEWER_FINGERPRINT = 'mdroom-cli:review';

export interface PublishOptions {
  cwd: string;
  filePath: string;
  serverUrl?: string;
  save: boolean;
}

export interface ExportOptions {
  cwd: string;
  room: string;
  outputPath?: string;
}

export interface StatusOptions {
  cwd: string;
  room: string;
}

export interface PatchOptions {
  cwd: string;
  filePath: string;
  room: string;
  summary?: string;
}

export interface ProposeOptions {
  cwd: string;
  filePath: string;
  room: string;
  title?: string;
  comment?: string;
}

export interface ProposalRoomOptions {
  cwd: string;
  room: string;
}

export interface ProposalIdOptions extends ProposalRoomOptions {
  proposalId: string;
}

export async function publishMarkdown(options: PublishOptions): Promise<PublishResult> {
  const sourcePath = resolveSourcePath(options.cwd, options.filePath);
  const markdown = await readFile(sourcePath, 'utf8');
  const access = createRoomAccess(options.serverUrl ?? DEFAULT_SERVER_URL);
  const document = summarizeMarkdown(markdown);
  const encryptedUpdate = await createEncryptedMarkdownUpdate(markdown, access, CLI_SENDER_ID);
  const record = await appendEncryptedUpdate(access, encryptedUpdate);
  const publishPersona = assignPersona({
    roomId: access.roomId,
    participantKind: 'human',
    participantFingerprint: CLI_SENDER_ID,
  });
  const publishEvent = createTimelineEvent({
    idSeed: `publish:${document.sha256}`,
    type: 'publish',
    actorPersonaId: publishPersona.id,
    proposalId: null,
    documentSha256: document.sha256,
    message: 'Published Markdown room',
  });
  const eventRecord = await appendEncryptedUpdate(access, await createEncryptedTimelineEvent(access, publishEvent));
  const encryptedSnapshot = await createEncryptedMarkdownSnapshot(markdown, access, CLI_SENDER_ID);
  const token = createRoomToken(access);
  const metadataPath = defaultMetadataPath(options.cwd);
  const now = new Date().toISOString();

  if (options.save) {
    const entry: RoomMetadataEntry = {
      roomId: access.roomId,
      serverUrl: access.serverUrl,
      roomUrl: roomUrlForAccess(access),
      token,
      sourcePath,
      createdAt: now,
      updatedAt: now,
      document,
      encryptedSnapshot,
    };
    await upsertRoomMetadata(metadataPath, entry);
  }

  return {
    schema: 'mdroom.publish.result.v1',
    ok: true,
    mode: 'server-backed',
    room: publicRoomResult(access, token),
    metadata: {
      path: metadataPath,
      saved: options.save,
    },
    document,
    server: {
      recordCount: eventRecord.seq,
      latestSeq: eventRecord.seq,
    },
  };
}

export async function exportMarkdown(options: ExportOptions): Promise<ExportResult> {
  const reference = parseRoomReference(options.room);
  const metadataPath = defaultMetadataPath(options.cwd);
  const entry = await findRoomMetadata(metadataPath, reference.roomId, reference.serverUrl);
  const records = await listEncryptedUpdates(reference);
  const markdown = records.length > 0
    ? await currentMarkdownFromRecords(records, reference)
    : await decryptLocalSnapshotOrThrow(entry, reference);
  const document = summarizeMarkdown(markdown);
  const outputPath = options.outputPath ? resolve(options.cwd, options.outputPath) : null;
  if (outputPath) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, markdown, 'utf8');
  }

  return {
    schema: 'mdroom.export.result.v1',
    ok: true,
    mode: 'server-backed',
    room: publicRoomResult(reference, createRoomToken(reference)),
    metadata: {
      path: metadataPath,
      found: Boolean(entry),
    },
    output: {
      path: outputPath,
      written: Boolean(outputPath),
      bytes: document.bytes,
      sha256: document.sha256,
    },
    document: {
      ...document,
      markdown,
    },
    server: {
      recordCount: records.length,
      latestSeq: records.at(-1)?.seq ?? null,
    },
  };
}

export async function roomStatus(options: StatusOptions): Promise<StatusResult> {
  const reference = parseRoomReference(options.room);
  const metadataPath = defaultMetadataPath(options.cwd);
  const entry = await findRoomMetadata(metadataPath, reference.roomId, reference.serverUrl);
  const status = await fetchRoomStatus(reference);

  return {
    schema: 'mdroom.status.result.v1',
    ok: true,
    mode: 'server-backed',
    room: publicRoomResult(reference, createRoomToken(reference)),
    metadata: {
      path: metadataPath,
      found: Boolean(entry),
      sourcePath: entry?.sourcePath ?? null,
      createdAt: entry?.createdAt ?? null,
      updatedAt: entry?.updatedAt ?? null,
    },
    document: entry?.document ?? null,
    server: {
      checked: true,
      recordCount: status.recordCount,
      latestSeq: status.latestSeq,
    },
  };
}

export async function patchMarkdown(options: PatchOptions): Promise<PatchResult> {
  const proposed = await proposeMarkdown({
    cwd: options.cwd,
    filePath: options.filePath,
    room: options.room,
    title: options.summary,
    comment: options.summary,
  });

  return {
    schema: 'mdroom.patch.result.v1',
    ok: true,
    mode: 'suggestion',
    room: proposed.room,
    metadata: proposed.metadata,
    base: proposed.base,
    proposed: proposed.proposed,
    suggestion: {
      id: proposed.proposal.id,
      kind: 'whole-document-replacement',
      baseSha256: proposed.proposal.base.sha256,
      proposedSha256: proposed.proposal.proposed.sha256,
    },
    server: proposed.server,
  };
}

export async function proposeMarkdown(options: ProposeOptions): Promise<ProposeResult> {
  const reference = parseRoomReference(options.room);
  const metadataPath = defaultMetadataPath(options.cwd);
  const entry = await findRoomMetadata(metadataPath, reference.roomId, reference.serverUrl);
  const records = await listEncryptedUpdates(reference);
  const baseMarkdown = records.length > 0
    ? await currentMarkdownFromRecords(records, reference)
    : await decryptLocalSnapshotOrThrow(entry, reference);
  const proposedMarkdown = await readFile(resolveSourcePath(options.cwd, options.filePath), 'utf8');
  const { update, proposal, timelineEvent } = await createEncryptedProposalRecord({
    access: reference,
    baseMarkdown,
    proposedMarkdown,
    title: options.title,
    comment: options.comment,
  });
  await appendEncryptedUpdate(reference, update);
  const eventRecord = await appendEncryptedUpdate(
    reference,
    await createEncryptedTimelineEvent(reference, timelineEvent),
  );

  return {
    schema: 'mdroom.propose.result.v1',
    ok: true,
    mode: 'proposal',
    room: publicRoomResult(reference, createRoomToken(reference)),
    metadata: {
      path: metadataPath,
      found: Boolean(entry),
    },
    base: summarizeMarkdown(baseMarkdown),
    proposed: summarizeMarkdown(proposedMarkdown),
    proposal,
    timeline: timelineEvent,
    server: {
      recordCount: eventRecord.seq,
      latestSeq: eventRecord.seq,
    },
  };
}

export async function listProposals(options: ProposalRoomOptions): Promise<ProposalsResult> {
  const reference = parseRoomReference(options.room);
  const records = await listEncryptedUpdates(reference);
  const replay = await replayProposalsFromRecords(reference, records);

  return {
    schema: 'mdroom.proposals.result.v1',
    ok: true,
    mode: 'proposal-list',
    room: publicRoomResult(reference, createRoomToken(reference)),
    proposals: replay.proposals.map((proposal) => ({
      id: proposal.id,
      title: proposal.title,
      comment: proposal.comment,
      status: proposal.status,
      createdAt: proposal.createdAt,
      updatedAt: proposal.statusUpdatedAt,
      persona: proposal.persona,
      base: proposal.base,
      proposed: summarizeMarkdown(proposal.proposed.markdown),
    })),
    server: {
      recordCount: records.length,
      latestSeq: records.at(-1)?.seq ?? null,
    },
  };
}

export async function showProposal(options: ProposalIdOptions): Promise<ShowProposalResult> {
  const { reference, records, proposal, timeline } = await getProposalOrThrow(options);
  return {
    schema: 'mdroom.show-proposal.result.v1',
    ok: true,
    mode: 'proposal',
    room: publicRoomResult(reference, createRoomToken(reference)),
    proposal,
    timeline: timeline.filter((event) => event.proposalId === proposal.id),
    server: {
      recordCount: records.length,
      latestSeq: records.at(-1)?.seq ?? null,
    },
  };
}

export async function acceptProposal(options: ProposalIdOptions): Promise<DecideProposalResult> {
  const { reference, records, proposal } = await getProposalOrThrow(options);
  assertPendingProposal(proposal);
  const currentMarkdown = await currentMarkdownFromRecords(records, reference);
  const currentDocument = summarizeMarkdown(currentMarkdown);
  if (currentDocument.sha256 !== proposal.base.sha256) {
    throw new Error(`Proposal ${proposal.id} is based on ${proposal.base.sha256} but current document is ${currentDocument.sha256}`);
  }
  const document = summarizeMarkdown(proposal.proposed.markdown);
  const reviewerPersona = assignPersona({
    roomId: reference.roomId,
    participantKind: 'human',
    participantFingerprint: CLI_REVIEWER_FINGERPRINT,
  });
  const eventUpdate = await createProposalAcceptedEvent(reference, proposal, document.sha256, reviewerPersona.id);
  const eventRecord = await appendEncryptedUpdate(reference, eventUpdate);
  const replay = await replayProposalsFromRecords(reference, await listEncryptedUpdates(reference));
  const updated = findProposalInReplay(replay.proposals, options.proposalId);

  return {
    schema: 'mdroom.accept.result.v1',
    ok: true,
    mode: 'proposal-decision',
    room: publicRoomResult(reference, createRoomToken(reference)),
    proposal: updated,
    status: 'accepted',
    document,
    timeline: replay.timeline.find((event) => event.proposalId === proposal.id && event.type === 'proposal_accepted')!,
    server: {
      recordCount: eventRecord.seq,
      latestSeq: eventRecord.seq,
    },
  };
}

export async function rejectProposal(options: ProposalIdOptions): Promise<DecideProposalResult> {
  const { reference, proposal } = await getProposalOrThrow(options);
  assertPendingProposal(proposal);
  const reviewerPersona = assignPersona({
    roomId: reference.roomId,
    participantKind: 'human',
    participantFingerprint: CLI_REVIEWER_FINGERPRINT,
  });
  const eventUpdate = await createProposalRejectedEvent(reference, proposal, reviewerPersona.id);
  const eventRecord = await appendEncryptedUpdate(reference, eventUpdate);
  const replay = await replayProposalsFromRecords(reference, await listEncryptedUpdates(reference));
  const updated = findProposalInReplay(replay.proposals, options.proposalId);

  return {
    schema: 'mdroom.reject.result.v1',
    ok: true,
    mode: 'proposal-decision',
    room: publicRoomResult(reference, createRoomToken(reference)),
    proposal: updated,
    status: 'rejected',
    document: null,
    timeline: replay.timeline.find((event) => event.proposalId === proposal.id && event.type === 'proposal_rejected')!,
    server: {
      recordCount: eventRecord.seq,
      latestSeq: eventRecord.seq,
    },
  };
}

function publicRoomResult(access: RoomAccess, token: string): PublicRoomResult {
  return {
    roomId: access.roomId,
    serverUrl: access.serverUrl,
    serverRoomUrl: serverRoomUrlForAccess(access),
    url: roomUrlForAccess(access),
    token,
    hasClientKey: true,
  };
}

async function decryptLocalSnapshotOrThrow(
  entry: RoomMetadataEntry | undefined,
  access: RoomAccess,
): Promise<string> {
  if (!entry) {
    throw new Error('No server records or local metadata found for room');
  }
  return decryptMarkdownSnapshot(entry.encryptedSnapshot, access);
}

async function currentMarkdownFromRecords(
  records: Awaited<ReturnType<typeof listEncryptedUpdates>>,
  access: RoomAccess,
): Promise<string> {
  let markdown = await decryptMarkdownFromRecords(records, access);
  const replay = await replayProposalsFromRecords(access, records);
  for (const event of replay.timeline) {
    if (event.type !== 'proposal_accepted' || !event.proposalId) continue;
    const accepted = replay.proposals.find((proposal) => proposal.id === event.proposalId);
    if (accepted) markdown = accepted.proposed.markdown;
  }
  return markdown;
}

async function getProposalOrThrow(options: ProposalIdOptions): Promise<{
  reference: ReturnType<typeof parseRoomReference>;
  records: Awaited<ReturnType<typeof listEncryptedUpdates>>;
  proposal: ProposalView;
  timeline: Awaited<ReturnType<typeof replayProposalsFromRecords>>['timeline'];
}> {
  const reference = parseRoomReference(options.room);
  const records = await listEncryptedUpdates(reference);
  const replay = await replayProposalsFromRecords(reference, records);
  return {
    reference,
    records,
    proposal: findProposalInReplay(replay.proposals, options.proposalId),
    timeline: replay.timeline,
  };
}

function findProposalInReplay(proposals: ProposalView[], proposalId: string): ProposalView {
  const proposal = proposals.find((candidate) => candidate.id === proposalId);
  if (!proposal) {
    throw new Error(`Proposal not found: ${proposalId}`);
  }
  return proposal;
}

function assertPendingProposal(proposal: ProposalView): void {
  if (proposal.status !== 'pending') {
    throw new Error(`Proposal ${proposal.id} is already ${proposal.status}`);
  }
}
