import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import {
  createEncryptedMarkdownSnapshot,
  createEncryptedMarkdownUpdate,
  createEncryptedMarkdownReplacementUpdateFromRecords,
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
  findRoomMetadataByAlias,
  listRoomMetadata,
  removeRoomMetadataByAlias,
  resolveSourcePath,
  upsertRoomMetadata,
  type RoomMetadataEntry,
} from '../rooms/metadata.js';
import {
  createEncryptedProjectSnapshot,
  decryptProjectSnapshotsFromRecords,
  normalizeProjectSnapshot,
  projectFileOrThrow,
  readMarkdownProject,
  replaceProjectFile,
  singleFileProject,
  summarizeProject,
  writeMarkdownProject,
  type ProjectSnapshot,
} from '../rooms/project-state.js';
import {
  createEncryptedProposalRecord,
  createProposalAcceptedEvent,
  createProposalRejectedEvent,
  replayProposalsFromRecords,
  type ProposalView,
} from '../rooms/proposals.js';
import {
  createComment,
  createCommentReplyEvent,
  createEncryptedCommentEvent,
  createEncryptedCommentRecord,
  replayCommentsFromRecords,
} from '../rooms/comments.js';
import { assignPersona } from '../rooms/personas.js';
import {
  createEncryptedTimelineEvent,
  createTimelineEvent,
} from '../rooms/timeline.js';
import type {
  DecideProposalResult,
  CommentResult,
  CommentsResult,
  ExportResult,
  PatchResult,
  ProposalSummaryResult,
  ProposalsResult,
  ProposeResult,
  PublicRoomResult,
  PublishResult,
  RoomCreateResult,
  RoomForgetResult,
  RoomInviteResult,
  RoomListResult,
  RoomProfileResult,
  ShowProposalResult,
  StatusResult,
} from './results.js';

const CLI_SENDER_ID = 'fold-cli:document';
const CLI_REVIEWER_FINGERPRINT = 'fold-cli:review';
const CLI_COMMENTER_FINGERPRINT = 'fold-cli:comment';

export interface PublishOptions {
  cwd: string;
  filePath: string;
  serverUrl?: string;
  appUrl?: string;
  syncUrl?: string;
  alias?: string;
  path?: string;
  save: boolean;
}

export interface ExportOptions {
  cwd: string;
  room: string;
  outputPath?: string;
  path?: string;
}

export interface StatusOptions {
  cwd: string;
  room: string;
}

export interface PatchOptions {
  cwd: string;
  filePath: string;
  room: string;
  path?: string;
  summary?: string;
}

export interface ProposeOptions {
  cwd: string;
  filePath: string;
  room: string;
  path?: string;
  title?: string;
  comment?: string;
}

export interface ProposalRoomOptions {
  cwd: string;
  room: string;
}

export interface CommentListOptions extends ProposalRoomOptions {
  path?: string;
}

export interface AddCommentOptions extends ProposalRoomOptions {
  path?: string;
  text: string;
  quote?: string;
}

export interface ReplyCommentOptions extends ProposalRoomOptions {
  commentId: string;
  text: string;
}

export interface ProposalIdOptions extends ProposalRoomOptions {
  proposalId: string;
}

export interface RoomAddOptions {
  cwd: string;
  room: string;
  alias: string;
}

export interface RoomCreateOptions {
  cwd: string;
  alias: string;
  serverUrl?: string;
  appUrl?: string;
  syncUrl?: string;
}

export interface RoomAliasOptions {
  cwd: string;
  alias: string;
}

export interface RoomSetUrlOptions extends RoomAliasOptions {
  appUrl?: string;
  syncUrl?: string;
}

export interface RoomInviteOptions extends RoomAliasOptions {
  audience: 'human' | 'agent';
}

export async function publishMarkdown(options: PublishOptions): Promise<PublishResult> {
  const sourcePath = resolveSourcePath(options.cwd, options.filePath);
  const project = await readMarkdownProject(options.cwd, options.filePath, options.path);
  const primary = projectFileOrThrow(project, project.primaryPath);
  const markdown = primary.markdown;
  const savedAlias = options.alias ?? defaultAliasForSource(options.filePath);
  const access = createRoomAccess(
    options.serverUrl ?? options.syncUrl ?? options.appUrl ?? DEFAULT_SERVER_URL,
    options.appUrl ?? options.serverUrl ?? options.syncUrl ?? DEFAULT_SERVER_URL,
    options.syncUrl ?? options.serverUrl ?? DEFAULT_SERVER_URL,
  );
  const document = summarizeMarkdown(markdown);
  const projectSummary = summarizeProject(project);
  const encryptedUpdate = await createEncryptedMarkdownUpdate(markdown, access, CLI_SENDER_ID);
  await appendEncryptedUpdate(access, encryptedUpdate);
  await appendEncryptedUpdate(access, await createEncryptedProjectSnapshot(access, project));
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
    documentSha256: projectSummary.sha256,
    message: 'Published Markdown project',
  });
  const eventRecord = await appendEncryptedUpdate(access, await createEncryptedTimelineEvent(access, publishEvent));
  const encryptedSnapshot = await createEncryptedMarkdownSnapshot(markdown, access, CLI_SENDER_ID);
  const token = createRoomToken(access);
  const metadataPath = defaultMetadataPath(options.cwd);
  const now = new Date().toISOString();

  if (options.save) {
    const entry: RoomMetadataEntry = {
      alias: savedAlias,
      roomId: access.roomId,
      appUrl: access.appUrl,
      syncUrl: access.syncUrl,
      serverUrl: access.serverUrl,
      roomUrl: roomUrlForAccess(access),
      token,
      sourcePath,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: now,
      document,
      encryptedSnapshot,
    };
    await upsertRoomMetadata(metadataPath, entry);
  }

  return {
    schema: 'fold.publish.result.v1',
    ok: true,
    mode: 'server-backed',
    room: publicRoomResult(options.save ? aliasAccess(access, savedAlias) : access, token),
    metadata: {
      path: metadataPath,
      saved: options.save,
    },
    document,
    project: projectSummary,
    server: {
      recordCount: eventRecord.seq,
      latestSeq: eventRecord.seq,
    },
  };
}

export async function createRoomProfile(options: RoomCreateOptions): Promise<RoomCreateResult> {
  const markdown = '';
  const project = singleFileProject('document.md', markdown);
  const access = createRoomAccess(
    options.serverUrl ?? options.syncUrl ?? options.appUrl ?? DEFAULT_SERVER_URL,
    options.appUrl ?? options.serverUrl ?? options.syncUrl ?? DEFAULT_SERVER_URL,
    options.syncUrl ?? options.serverUrl ?? DEFAULT_SERVER_URL,
  );
  const document = summarizeMarkdown(markdown);
  const projectSummary = summarizeProject(project);
  await appendEncryptedUpdate(access, await createEncryptedMarkdownUpdate(markdown, access, CLI_SENDER_ID));
  await appendEncryptedUpdate(access, await createEncryptedProjectSnapshot(access, project));
  const publishPersona = assignPersona({
    roomId: access.roomId,
    participantKind: 'human',
    participantFingerprint: CLI_SENDER_ID,
  });
  const publishEvent = createTimelineEvent({
    idSeed: `room-create:${access.roomId}`,
    type: 'publish',
    actorPersonaId: publishPersona.id,
    proposalId: null,
    documentSha256: projectSummary.sha256,
    message: 'Created empty Markdown project room',
  });
  const eventRecord = await appendEncryptedUpdate(access, await createEncryptedTimelineEvent(access, publishEvent));
  const encryptedSnapshot = await createEncryptedMarkdownSnapshot(markdown, access, CLI_SENDER_ID);
  const token = createRoomToken(access);
  const metadataPath = defaultMetadataPath(options.cwd);
  const now = new Date().toISOString();
  const entry: RoomMetadataEntry = {
    alias: options.alias,
    roomId: access.roomId,
    appUrl: access.appUrl,
    syncUrl: access.syncUrl,
    serverUrl: access.serverUrl,
    roomUrl: roomUrlForAccess(access),
    token,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    document,
    encryptedSnapshot,
  };
  await upsertRoomMetadata(metadataPath, entry);

  return {
    schema: 'fold.room.create.result.v1',
    ok: true,
    mode: 'server-backed',
    room: publicRoomResult(aliasAccess(access, options.alias), token),
    metadata: {
      path: metadataPath,
      alias: options.alias,
      saved: true,
    },
    document,
    project: projectSummary,
    server: {
      recordCount: eventRecord.seq,
      latestSeq: eventRecord.seq,
    },
  };
}

export async function exportMarkdown(options: ExportOptions): Promise<ExportResult> {
  const reference = await resolveRoomReference(options.cwd, options.room);
  const metadataPath = defaultMetadataPath(options.cwd);
  const entry = await findRoomMetadata(metadataPath, reference.roomId, reference.serverUrl);
  const records = await listEncryptedUpdates(reference);
  const project = records.length > 0
    ? await currentProjectFromRecords(records, reference, entry)
    : singleFileProject(entry?.sourcePath ? basename(entry.sourcePath) : 'document.md', await decryptLocalSnapshotOrThrow(entry, reference));
  const selected = options.path ? projectFileOrThrow(project, options.path) : projectFileOrThrow(project, project.primaryPath);
  const markdown = selected.markdown;
  const document = summarizeMarkdown(markdown);
  const projectSummary = summarizeProject(project);
  const outputPath = options.outputPath ? resolve(options.cwd, options.outputPath) : null;
  let writtenPaths: string[] = [];
  if (options.outputPath) {
    writtenPaths = await writeMarkdownProject(options.cwd, options.outputPath, project, options.path);
  }

  return {
    schema: 'fold.export.result.v1',
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
      paths: writtenPaths,
    },
    document: {
      ...document,
      markdown,
    },
    project: projectSummary,
    server: {
      recordCount: records.length,
      latestSeq: records.at(-1)?.seq ?? null,
    },
  };
}

export async function roomStatus(options: StatusOptions): Promise<StatusResult> {
  const reference = await resolveRoomReference(options.cwd, options.room);
  const metadataPath = defaultMetadataPath(options.cwd);
  const entry = await findRoomMetadata(metadataPath, reference.roomId, reference.serverUrl);
  const status = await fetchRoomStatus(reference);
  const records = await listEncryptedUpdates(reference);
  const project = records.length > 0 ? await currentProjectFromRecords(records, reference, entry) : null;

  return {
    schema: 'fold.status.result.v1',
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
    project: project ? summarizeProject(project) : null,
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
    path: options.path,
    title: options.summary,
    comment: options.summary,
  });

  return {
    schema: 'fold.patch.result.v1',
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
  const reference = await resolveRoomReference(options.cwd, options.room);
  const metadataPath = defaultMetadataPath(options.cwd);
  const entry = await findRoomMetadata(metadataPath, reference.roomId, reference.serverUrl);
  const records = await listEncryptedUpdates(reference);
  const baseProject = records.length > 0
    ? await currentProjectFromRecords(records, reference, entry)
    : singleFileProject(entry?.sourcePath ? basename(entry.sourcePath) : 'document.md', await decryptLocalSnapshotOrThrow(entry, reference));
  const inputProject = await readMarkdownProject(options.cwd, options.filePath, options.path);
  const proposedPath = options.path ?? inferSingleFileProposalPath(baseProject, inputProject);
  const proposedProject = proposedPath
    ? replaceProjectFile(baseProject, proposedPath, projectFileOrThrow(inputProject, inputProject.primaryPath).markdown)
    : inputProject;
  const baseMarkdown = proposedPath
    ? projectFileOrThrow(baseProject, proposedPath).markdown
    : projectFileOrThrow(baseProject, baseProject.primaryPath).markdown;
  const proposedMarkdown = proposedPath
    ? projectFileOrThrow(proposedProject, proposedPath).markdown
    : projectFileOrThrow(proposedProject, proposedProject.primaryPath).markdown;
  const { update, proposal, timelineEvent } = await createEncryptedProposalRecord({
    access: reference,
    baseMarkdown,
    proposedMarkdown,
    baseProject,
    proposedProject,
    path: proposedPath,
    title: options.title,
    comment: options.comment,
  });
  await appendEncryptedUpdate(reference, update);
  const eventRecord = await appendEncryptedUpdate(
    reference,
    await createEncryptedTimelineEvent(reference, timelineEvent),
  );

  return {
    schema: 'fold.propose.result.v1',
    ok: true,
    mode: 'proposal',
    room: publicRoomResult(reference, createRoomToken(reference)),
    metadata: {
      path: metadataPath,
      found: Boolean(entry),
    },
    base: summarizeMarkdown(baseMarkdown),
    proposed: summarizeMarkdown(proposedMarkdown),
    project: {
      base: summarizeProject(baseProject),
      proposed: summarizeProject(proposedProject),
    },
    proposal: publicProposalSummary(proposal),
    timeline: timelineEvent,
    server: {
      recordCount: eventRecord.seq,
      latestSeq: eventRecord.seq,
    },
  };
}

export async function listProposals(options: ProposalRoomOptions): Promise<ProposalsResult> {
  const reference = await resolveRoomReference(options.cwd, options.room);
  const records = await listEncryptedUpdates(reference);
  const replay = await replayProposalsFromRecords(reference, records);

  return {
    schema: 'fold.proposals.result.v1',
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
      path: proposal.path,
      project: proposal.proposedProject ? summarizeProject(proposal.proposedProject) : undefined,
    })),
    server: {
      recordCount: records.length,
      latestSeq: records.at(-1)?.seq ?? null,
    },
  };
}

export async function listComments(options: CommentListOptions): Promise<CommentsResult> {
  const reference = await resolveRoomReference(options.cwd, options.room);
  const records = await listEncryptedUpdates(reference);
  const comments = await replayCommentsFromRecords(reference, records);
  const visibleComments = options.path
    ? comments.filter((comment) => comment.filePath === options.path)
    : comments;

  return {
    schema: 'fold.comments.result.v1',
    ok: true,
    mode: 'comment-list',
    room: publicRoomResult(reference, createRoomToken(reference)),
    comments: visibleComments,
    server: {
      recordCount: records.length,
      latestSeq: records.at(-1)?.seq ?? null,
    },
  };
}

export async function addComment(options: AddCommentOptions): Promise<CommentResult> {
  const text = options.text.trim();
  if (!text) throw new Error('Comment text is required');
  const reference = await resolveRoomReference(options.cwd, options.room);
  const records = await listEncryptedUpdates(reference);
  const project = await currentProjectFromRecords(records, reference);
  const filePath = options.path ?? project.primaryPath;
  const file = projectFileOrThrow(project, filePath);
  const persona = assignPersona({
    roomId: reference.roomId,
    participantKind: 'agent',
    participantFingerprint: CLI_COMMENTER_FINGERPRINT,
  });
  const comment = createComment({
    persona,
    text,
    markdown: file.markdown,
    filePath: file.path,
    selectedQuote: options.quote,
  });
  const record = await appendEncryptedUpdate(reference, await createEncryptedCommentRecord(reference, comment));

  return {
    schema: 'fold.comment.result.v1',
    ok: true,
    mode: 'comment',
    room: publicRoomResult(reference, createRoomToken(reference)),
    comment,
    server: {
      recordCount: record.seq,
      latestSeq: record.seq,
    },
  };
}

export async function replyToComment(options: ReplyCommentOptions): Promise<CommentResult> {
  const text = options.text.trim();
  if (!text) throw new Error('Reply text is required');
  const reference = await resolveRoomReference(options.cwd, options.room);
  const records = await listEncryptedUpdates(reference);
  const comments = await replayCommentsFromRecords(reference, records);
  const comment = comments.find((candidate) => candidate.id === options.commentId);
  if (!comment) throw new Error(`Comment not found: ${options.commentId}`);
  if (comment.resolvedAt) throw new Error(`Comment ${options.commentId} is resolved; reopen it before replying`);

  const persona = assignPersona({
    roomId: reference.roomId,
    participantKind: 'agent',
    participantFingerprint: CLI_COMMENTER_FINGERPRINT,
  });
  const event = createCommentReplyEvent({ comment, persona, text });
  const record = await appendEncryptedUpdate(reference, await createEncryptedCommentEvent(reference, event));
  const updated = {
    ...comment,
    replies: [...(comment.replies || []), event.reply!].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
  };

  return {
    schema: 'fold.reply.result.v1',
    ok: true,
    mode: 'comment',
    room: publicRoomResult(reference, createRoomToken(reference)),
    comment: updated,
    server: {
      recordCount: record.seq,
      latestSeq: record.seq,
    },
  };
}

export async function showProposal(options: ProposalIdOptions): Promise<ShowProposalResult> {
  const { reference, records, proposal, timeline } = await getProposalOrThrow(options);
  return {
    schema: 'fold.show-proposal.result.v1',
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
  const currentProject = await currentProjectFromRecords(records, reference);
  const currentDocument = proposal.baseProject ? summarizeProject(currentProject) : summarizeMarkdown(projectFileOrThrow(currentProject, currentProject.primaryPath).markdown);
  if (proposal.baseProject && currentDocument.sha256 !== proposal.baseProject.sha256) {
    throw new Error(`Proposal ${proposal.id} is based on project ${proposal.baseProject.sha256} but current document/project is ${currentDocument.sha256}`);
  }
  if (!proposal.baseProject && currentDocument.sha256 !== proposal.base.sha256) {
    throw new Error(`Proposal ${proposal.id} is based on ${proposal.base.sha256} but current document is ${currentDocument.sha256}`);
  }
  const document = summarizeMarkdown(proposal.proposed.markdown);
  const acceptedProject = proposal.proposedProject ?? singleFileProject(proposal.path ?? currentProject.primaryPath, proposal.proposed.markdown);
  const primaryMarkdown = projectFileOrThrow(acceptedProject, acceptedProject.primaryPath).markdown;
  const documentUpdate = await createEncryptedMarkdownReplacementUpdateFromRecords(
    records,
    primaryMarkdown,
    reference,
  );
  await appendEncryptedUpdate(reference, documentUpdate);
  await appendEncryptedUpdate(reference, await createEncryptedProjectSnapshot(reference, acceptedProject));
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
    schema: 'fold.accept.result.v1',
    ok: true,
    mode: 'proposal-decision',
    room: publicRoomResult(reference, createRoomToken(reference)),
    proposal: publicProposalSummary(updated),
    status: 'accepted',
    document,
    project: summarizeProject(acceptedProject),
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
    schema: 'fold.reject.result.v1',
    ok: true,
    mode: 'proposal-decision',
    room: publicRoomResult(reference, createRoomToken(reference)),
    proposal: publicProposalSummary(updated),
    status: 'rejected',
    document: null,
    project: null,
    timeline: replay.timeline.find((event) => event.proposalId === proposal.id && event.type === 'proposal_rejected')!,
    server: {
      recordCount: eventRecord.seq,
      latestSeq: eventRecord.seq,
    },
  };
}

export async function addRoomProfile(options: RoomAddOptions): Promise<RoomProfileResult> {
  const reference = parseRoomReference(options.room);
  const metadataPath = defaultMetadataPath(options.cwd);
  const now = new Date().toISOString();
  const entry: RoomMetadataEntry = {
    alias: options.alias,
    roomId: reference.roomId,
    appUrl: reference.appUrl,
    syncUrl: reference.syncUrl,
    serverUrl: reference.serverUrl,
    roomUrl: roomUrlForAccess(reference),
    token: createRoomToken(reference),
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    document: summarizeMarkdown(''),
    encryptedSnapshot: await createEncryptedMarkdownSnapshot('', reference, CLI_SENDER_ID),
  };
  await upsertRoomMetadata(metadataPath, entry);
  return {
    schema: 'fold.room.add.result.v1',
    ok: true,
    room: publicRoomResult(aliasAccess(reference, options.alias), createRoomToken(reference)),
    metadata: {
      path: metadataPath,
      alias: options.alias,
    },
  };
}

export async function listRoomProfiles(options: { cwd: string }): Promise<RoomListResult> {
  const metadataPath = defaultMetadataPath(options.cwd);
  const rooms = await listRoomMetadata(metadataPath);
  return {
    schema: 'fold.room.list.result.v1',
    ok: true,
    metadata: { path: metadataPath },
    rooms: rooms.map((room) => publicRoomListResult(accessFromEntry(room))),
  };
}

export async function showRoomProfile(options: RoomAliasOptions): Promise<RoomProfileResult> {
  const metadataPath = defaultMetadataPath(options.cwd);
  const entry = await roomEntryByAliasOrThrow(metadataPath, options.alias);
  return {
    schema: 'fold.room.show.result.v1',
    ok: true,
    room: publicRoomResult(accessFromEntry(entry), entry.token),
    metadata: {
      path: metadataPath,
      alias: entry.alias ?? options.alias,
    },
  };
}

export async function setRoomProfileUrls(options: RoomSetUrlOptions): Promise<RoomProfileResult> {
  const metadataPath = defaultMetadataPath(options.cwd);
  const entry = await roomEntryByAliasOrThrow(metadataPath, options.alias);
  const access = accessFromEntry(entry);
  const nextAccess: RoomAccess = {
    ...access,
    appUrl: options.appUrl ?? access.appUrl,
    syncUrl: options.syncUrl ?? access.syncUrl,
    serverUrl: options.syncUrl ?? access.syncUrl,
  };
  const now = new Date().toISOString();
  const nextEntry: RoomMetadataEntry = {
    ...entry,
    appUrl: nextAccess.appUrl,
    syncUrl: nextAccess.syncUrl,
    serverUrl: nextAccess.serverUrl,
    roomUrl: roomUrlForAccess(nextAccess),
    token: createRoomToken(nextAccess),
    updatedAt: now,
    lastUsedAt: now,
  };
  await upsertRoomMetadata(metadataPath, nextEntry);
  return {
    schema: 'fold.room.set-url.result.v1',
    ok: true,
    room: publicRoomResult(accessFromEntry(nextEntry), nextEntry.token),
    metadata: {
      path: metadataPath,
      alias: options.alias,
    },
  };
}

export async function forgetRoomProfile(options: RoomAliasOptions): Promise<RoomForgetResult> {
  const metadataPath = defaultMetadataPath(options.cwd);
  await removeRoomMetadataByAlias(metadataPath, options.alias);
  return {
    schema: 'fold.room.forget.result.v1',
    ok: true,
    metadata: {
      path: metadataPath,
      alias: options.alias,
    },
  };
}

export async function createRoomInvite(options: RoomInviteOptions): Promise<RoomInviteResult> {
  const metadataPath = defaultMetadataPath(options.cwd);
  const entry = await roomEntryByAliasOrThrow(metadataPath, options.alias);
  const access = accessFromEntry(entry);
  const roomUrl = roomUrlForAccess(access);
  const warnings = shareabilityWarnings(access);
  const skillUrl = `${access.appUrl.replace(/\/$/, '')}/.well-known/fold/agent-skill.md`;
  const agentInviteText = [
    'Join this Fold project room:',
    '',
    `1. Read the agent skill: ${skillUrl}`,
    '',
    '2. Save the room alias:',
    `   fold room add ${JSON.stringify(entry.token)} --alias ${JSON.stringify(options.alias)}`,
    '',
    '   If the Fold CLI is not globally installed in this repo, use:',
    `   npm run --silent cli -- room add ${JSON.stringify(entry.token)} --alias ${JSON.stringify(options.alias)}`,
    '',
    '3. Confirm access:',
    `   fold status --room ${JSON.stringify(options.alias)} --json`,
    '',
    '4. Work through proposals, not direct mutation:',
    `   fold export --room ${JSON.stringify(options.alias)} --output ./fold-project --json`,
    `   fold propose ./fold-project --room ${JSON.stringify(options.alias)} --title "Describe the change" --comment "Summarize what changed." --json`,
    '',
    '5. Join comment threads when clarification is better than a proposal:',
    `   fold comments --room ${JSON.stringify(options.alias)} --json`,
    `   fold reply "<comment-id>" --room ${JSON.stringify(options.alias)} --text "Short reply." --json`,
    `   fold comment --room ${JSON.stringify(options.alias)} --path "docs/PLAN.md" --text "Short note." --json`,
  ].join('\n');
  const text = options.audience === 'agent'
    ? agentInviteText
    : [
      'Open this Fold project:',
      roomUrl,
      '',
      'This link contains the room key. Anyone with it can decrypt the project.',
    ].join('\n');

  return {
    schema: 'fold.room.invite.result.v1',
    ok: true,
    audience: options.audience,
    room: options.audience === 'agent'
      ? publicRoomListResult(access)
      : publicRoomResult(access, entry.token),
    warnings,
    invite: {
      text,
      skillUrl: options.audience === 'agent' ? skillUrl : null,
    },
  };
}

function publicRoomResult(access: RoomAccess, token: string): PublicRoomResult {
  return {
    roomId: access.roomId,
    alias: 'alias' in access && typeof (access as { alias?: unknown }).alias === 'string'
      ? (access as { alias: string }).alias
      : null,
    appUrl: access.appUrl,
    syncUrl: access.syncUrl,
    serverUrl: access.serverUrl,
    serverRoomUrl: serverRoomUrlForAccess(access),
    url: roomUrlForAccess(access),
    token,
    hasClientKey: true,
  };
}

function publicRoomListResult(access: RoomAccess & { alias?: string }): PublicRoomResult {
  return {
    roomId: access.roomId,
    alias: access.alias ?? null,
    appUrl: access.appUrl,
    syncUrl: access.syncUrl,
    serverUrl: access.serverUrl,
    serverRoomUrl: serverRoomUrlForAccess(access),
    url: serverRoomUrlForAccess(access),
    token: '[redacted]',
    hasClientKey: false,
  };
}

function publicProposalSummary(proposal: ProposalView): ProposalSummaryResult {
  return {
    id: proposal.id,
    kind: proposal.kind,
    title: proposal.title,
    comment: proposal.comment,
    status: proposal.status,
    createdAt: proposal.createdAt,
    updatedAt: proposal.statusUpdatedAt,
    persona: proposal.persona,
    base: proposal.base,
    proposed: summarizeMarkdown(proposal.proposed.markdown),
    path: proposal.path,
    project: proposal.proposedProject ? summarizeProject(proposal.proposedProject) : undefined,
  };
}

async function resolveRoomReference(cwd: string, input: string): Promise<ReturnType<typeof parseRoomReference>> {
  try {
    return parseRoomReference(input);
  } catch (error) {
    const metadataPath = defaultMetadataPath(cwd);
    const entry = await findRoomMetadataByAlias(metadataPath, input);
    if (!entry) throw error;
    return {
      ...parseRoomReference(entry.token),
      kind: 'token',
      ...aliasAccess(accessFromEntry(entry), entry.alias ?? input),
      roomUrl: roomUrlForAccess(accessFromEntry(entry)),
      serverRoomUrl: serverRoomUrlForAccess(accessFromEntry(entry)),
    };
  }
}

function accessFromEntry(entry: RoomMetadataEntry): RoomAccess & { alias?: string } {
  return aliasAccess({
    roomId: entry.roomId,
    roomSecret: parseRoomReference(entry.token).roomSecret,
    appUrl: entry.appUrl ?? entry.serverUrl,
    syncUrl: entry.syncUrl ?? entry.serverUrl,
    serverUrl: entry.syncUrl ?? entry.serverUrl,
  }, entry.alias);
}

function aliasAccess<T extends RoomAccess>(access: T, alias?: string): T & { alias?: string } {
  return alias ? { ...access, alias } : access;
}

async function roomEntryByAliasOrThrow(metadataPath: string, alias: string): Promise<RoomMetadataEntry> {
  const entry = await findRoomMetadataByAlias(metadataPath, alias);
  if (!entry) throw new Error(`Room alias not found: ${alias}`);
  return entry;
}

function defaultAliasForSource(filePath: string): string {
  return basename(filePath).replace(/\.md$/i, '') || 'room';
}

function shareabilityWarnings(access: RoomAccess): string[] {
  const warnings: string[] = [];
  for (const [label, value] of [['appUrl', access.appUrl], ['syncUrl', access.syncUrl]] as const) {
    const host = new URL(value).hostname;
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      warnings.push(`${label} ${value} may only be reachable on the host machine or local network.`);
    }
  }
  return warnings;
}

function inferSingleFileProposalPath(baseProject: ProjectSnapshot, inputProject: ProjectSnapshot): string | undefined {
  if (inputProject.files.length !== 1) return undefined;
  const inputPath = inputProject.files[0]!.path;
  if (baseProject.files.some((file) => file.path === inputPath)) return inputPath;
  if (baseProject.files.length === 1) return baseProject.primaryPath;
  throw new Error(`Use --path to choose which room file ${inputPath} should replace`);
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
  const project = await currentProjectFromRecords(records, access);
  return projectFileOrThrow(project, project.primaryPath).markdown;
}

async function currentProjectFromRecords(
  records: Awaited<ReturnType<typeof listEncryptedUpdates>>,
  access: RoomAccess,
  entry?: RoomMetadataEntry,
): Promise<ProjectSnapshot> {
  const snapshots = await decryptProjectSnapshotsFromRecords(access, records);
  let project = snapshots.at(-1);
  if (!project) {
    const markdown = records.length > 0
      ? await decryptMarkdownFromRecords(records, access)
      : await decryptLocalSnapshotOrThrow(entry, access);
    project = singleFileProject(entry?.sourcePath ? basename(entry.sourcePath) : 'document.md', markdown);
  }

  const replay = await replayProposalsFromRecords(access, records);
  for (const event of replay.timeline) {
    if (event.type !== 'proposal_accepted' || !event.proposalId) continue;
    const accepted = replay.proposals.find((proposal) => proposal.id === event.proposalId);
    if (accepted?.proposedProject) {
      project = normalizeProjectSnapshot(accepted.proposedProject);
    } else if (accepted) {
      project = singleFileProject(accepted.path ?? project.primaryPath, accepted.proposed.markdown);
    }
  }
  return project;
}

async function getProposalOrThrow(options: ProposalIdOptions): Promise<{
  reference: ReturnType<typeof parseRoomReference>;
  records: Awaited<ReturnType<typeof listEncryptedUpdates>>;
  proposal: ProposalView;
  timeline: Awaited<ReturnType<typeof replayProposalsFromRecords>>['timeline'];
}> {
  const reference = await resolveRoomReference(options.cwd, options.room);
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
