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
  addProjectFile,
  createEncryptedProjectSnapshot,
  normalizeProjectSnapshot,
  projectFileOrThrow,
  PROJECT_UPDATE_SENDER_ID_PREFIX,
  readMarkdownProject,
  replaceProjectFile,
  singleFileProject,
  summarizeProject,
  isStaleProjectFileSnapshotSeq,
  WEB_PROJECT_FILE_SENDER_ID_PREFIX,
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
  type RoomComment,
  type ThreadType,
} from '../rooms/comments.js';
import { assignPersona } from '../rooms/personas.js';
import { resolvePublicOrigin } from '../deploy/public-origin.js';
import {
  createEncryptedTimelineEvent,
  createTimelineEvent,
  decryptTimelineEvent,
  TIMELINE_EVENT_SENDER_ID_PREFIX,
} from '../rooms/timeline.js';
import { decryptJsonRecord } from '../rooms/encrypted-records.js';
import type {
  BootstrapResult,
  DecideProposalResult,
  CommentResult,
  CommentsResult,
  ContextResult,
  ExportResult,
  PatchResult,
  PostResult,
  ProposalSummaryResult,
  ProposalsResult,
  ProposeResult,
  PublicRoomResult,
  PublishResult,
  ResumeResult,
  RoomCreateResult,
  RoomForgetResult,
  RoomInviteResult,
  RoomListResult,
  RoomProfileResult,
  SafeRoomResult,
  ShowProposalResult,
  SkillInstallScope,
  StatusResult,
} from './results.js';
import { installFoldSkill } from './skill-install.js';
import {
  DEFAULT_FOLD_AGENT_COMMAND_PREFIX,
  FOLD_AGENT_PACKAGE_NAME,
  FOLD_AGENT_VERSION,
} from './package-info.js';

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
  forceProjectDirectory?: boolean;
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

export interface PostOptions {
  cwd: string;
  filePath: string;
  room: string;
  path?: string;
}

export interface ProposalRoomOptions {
  cwd: string;
  room: string;
}

export interface CommentListOptions extends ProposalRoomOptions {
  path?: string;
  type?: 'all' | 'comment' | 'request';
  open?: boolean;
}

export interface AddCommentOptions extends ProposalRoomOptions {
  path?: string;
  text: string;
  quote?: string;
  type?: ThreadType;
}

export interface ReplyCommentOptions extends ProposalRoomOptions {
  commentId: string;
  text: string;
}

export interface ProposalIdOptions extends ProposalRoomOptions {
  proposalId: string;
}

export interface ResumeOptions {
  cwd: string;
  room: string;
  alias?: string;
  outputPath?: string;
  commandPrefix?: string;
}

export interface BootstrapOptions extends ResumeOptions {
  skipSkill?: boolean;
  skillScope: SkillInstallScope;
  nextCommandPrefix?: string;
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
  const metadataPath = defaultMetadataPath(options.cwd);
  if (options.save) {
    await assertAliasUnused(metadataPath, savedAlias);
  }
  const urls = resolvePublicOrigin({
    serverUrl: options.serverUrl,
    appUrl: options.appUrl,
    syncUrl: options.syncUrl,
    defaultUrl: DEFAULT_SERVER_URL,
  });
  const access = createRoomAccess(urls.syncUrl, urls.appUrl, urls.syncUrl);
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
  const metadataPath = defaultMetadataPath(options.cwd);
  await assertAliasUnused(metadataPath, options.alias);
  const urls = resolvePublicOrigin({
    serverUrl: options.serverUrl,
    appUrl: options.appUrl,
    syncUrl: options.syncUrl,
    defaultUrl: DEFAULT_SERVER_URL,
  });
  const access = createRoomAccess(urls.syncUrl, urls.appUrl, urls.syncUrl);
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
    writtenPaths = await writeMarkdownProject(options.cwd, options.outputPath, project, options.path, {
      forceDirectory: options.forceProjectDirectory,
    });
  }

  return {
    schema: 'fold.export.result.v1',
    ok: true,
    mode: 'server-backed',
    room: safeRoomResult(reference),
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

export async function postMarkdown(options: PostOptions): Promise<PostResult> {
  const reference = await resolveRoomReference(options.cwd, options.room);
  const metadataPath = defaultMetadataPath(options.cwd);
  const entry = await findRoomMetadata(metadataPath, reference.roomId, reference.serverUrl);
  const records = await listEncryptedUpdates(reference);
  const baseProject = records.length > 0
    ? await currentProjectFromRecords(records, reference, entry)
    : singleFileProject(entry?.sourcePath ? basename(entry.sourcePath) : 'document.md', await decryptLocalSnapshotOrThrow(entry, reference));
  const inputProject = await readMarkdownProject(options.cwd, options.filePath, options.path);
  if (inputProject.files.length !== 1) {
    throw new Error('fold post accepts one Markdown file; use one command per fresh file');
  }
  const inputFile = projectFileOrThrow(inputProject, inputProject.primaryPath);
  if (baseProject.files.some((file) => file.path === inputFile.path)) {
    throw new Error(`Project file already exists: ${inputFile.path}. Use fold propose to change existing files.`);
  }

  const postedProject = addProjectFile(baseProject, inputFile.path, inputFile.markdown);
  const projectSummary = summarizeProject(postedProject);
  const fileSummary = summarizeMarkdown(inputFile.markdown);
  await appendEncryptedUpdate(reference, await createEncryptedProjectSnapshot(reference, postedProject));
  const persona = assignPersona({
    roomId: reference.roomId,
    participantKind: 'agent',
    participantFingerprint: CLI_SENDER_ID,
  });
  const event = createTimelineEvent({
    type: 'file_posted',
    actorPersonaId: persona.id,
    proposalId: null,
    documentSha256: projectSummary.sha256,
    message: `Posted ${inputFile.path}`,
    acceptedProject: postedProject,
  });
  const eventRecord = await appendEncryptedUpdate(reference, await createEncryptedTimelineEvent(reference, event));

  return {
    schema: 'fold.post.result.v1',
    ok: true,
    mode: 'accepted-file',
    room: safeRoomResult(reference),
    metadata: {
      path: metadataPath,
      found: Boolean(entry),
    },
    file: {
      path: inputFile.path,
      ...fileSummary,
    },
    project: projectSummary,
    timeline: event,
    server: {
      recordCount: eventRecord.seq,
      latestSeq: eventRecord.seq,
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
  const replayedDocument = project
    ? summarizeMarkdown(projectFileOrThrow(project, project.primaryPath).markdown)
    : null;

  return {
    schema: 'fold.status.result.v1',
    ok: true,
    mode: 'server-backed',
    room: safeRoomResult(reference),
    metadata: {
      path: metadataPath,
      found: Boolean(entry),
      sourcePath: entry?.sourcePath ?? null,
      createdAt: entry?.createdAt ?? null,
      updatedAt: entry?.updatedAt ?? null,
    },
    document: replayedDocument ?? entry?.document ?? null,
    project: project ? summarizeProject(project) : null,
    server: {
      checked: true,
      recordCount: status.recordCount,
      latestSeq: status.latestSeq,
    },
  };
}

export async function roomContext(options: StatusOptions): Promise<ContextResult> {
  const reference = await resolveRoomReference(options.cwd, options.room);
  const metadataPath = defaultMetadataPath(options.cwd);
  const entry = await findRoomMetadata(metadataPath, reference.roomId, reference.serverUrl);
  const records = await listEncryptedUpdates(reference);
  const project = await currentProjectFromRecords(records, reference, entry);
  const projectSummary = summarizeProject(project);
  const primary = projectFileOrThrow(project, project.primaryPath);
  const document = summarizeMarkdown(primary.markdown);
  const comments = await replayCommentsFromRecords(reference, records);
  const proposalReplay = await replayProposalsFromRecords(reference, records);
  const proposals = proposalReplay.proposals.map(publicProposalListItem);

  return {
    schema: 'fold.context.result.v1',
    ok: true,
    mode: 'agent-context',
    room: safeRoomResult(reference),
    document,
    project: projectSummary,
    files: project.files.map((file) => ({
      path: file.path,
      markdown: file.markdown,
      ...summarizeMarkdown(file.markdown),
    })),
    comments: {
      unresolved: comments.filter((comment) => !comment.resolvedAt),
    },
    proposals: {
      pending: proposals.filter((proposal) => proposal.status === 'pending'),
      accepted: proposals.filter((proposal) => proposal.status === 'accepted'),
      rejected: proposals.filter((proposal) => proposal.status === 'rejected'),
    },
    server: {
      recordCount: records.length,
      latestSeq: records.at(-1)?.seq ?? null,
    },
  };
}

export async function resumeRoom(options: ResumeOptions): Promise<ResumeResult> {
  const parsedSecretReference = tryParseRoomReference(options.room);
  if (!parsedSecretReference && options.alias) {
    throw new Error('--alias is only valid when --room is a fold:v1 token or room URL; repeat agents should use --room <alias> without --alias');
  }
  if (parsedSecretReference && !options.alias) {
    throw new Error('Resuming from a room URL or fold:v1 token requires --alias so follow-up commands do not echo secret room access material');
  }

  const imported = Boolean(parsedSecretReference && options.alias);
  if (imported && options.alias) {
    await addRoomProfile({
      cwd: options.cwd,
      room: options.room,
      alias: options.alias,
    });
  }

  const room = options.alias ?? options.room;
  const status = await roomStatus({ cwd: options.cwd, room });
  const exported = options.outputPath
    ? await exportMarkdown({ cwd: options.cwd, room, outputPath: options.outputPath, forceProjectDirectory: true })
    : null;
  const context = await roomContext({ cwd: options.cwd, room });
  const requests = await listComments({
    cwd: options.cwd,
    room,
    type: 'request',
    open: true,
  });
  const comments = await listComments({
    cwd: options.cwd,
    room,
    type: 'comment',
    open: true,
  });
  const proposals = await listProposals({ cwd: options.cwd, room });
  const commandPrefix = options.commandPrefix ?? 'fold';
  const roomArgument = JSON.stringify(room);
  const outputArgument = options.outputPath ? JSON.stringify(options.outputPath) : null;
  const skillUrl = `${context.room.appUrl.replace(/\/$/, '')}/.well-known/fold/agent-skill.md`;

  return {
    schema: 'fold.resume.result.v1',
    ok: true,
    mode: 'agent-resume',
    room: context.room,
    metadata: {
      path: defaultMetadataPath(options.cwd),
      alias: room,
      imported,
    },
    skill: {
      url: skillUrl,
      install: {
        required: false,
        repeatAgents: `If the Fold skill is already installed, do not reinstall it; run ${commandPrefix} resume with the saved alias.`,
        command: `${commandPrefix} skill`,
        updateCommand: `${commandPrefix} skill update`,
      },
    },
    status,
    export: exported,
    context,
    requests,
    comments,
    proposals,
    nextCommands: {
      post: outputArgument
        ? `${commandPrefix} post ${outputArgument}/NEW_FILE.md --room ${roomArgument} --path "NEW_FILE.md" --json`
        : null,
      propose: outputArgument
        ? `${commandPrefix} propose ${outputArgument} --room ${roomArgument} --title "Describe the change" --comment "Summarize what changed." --json`
        : null,
      requests: `${commandPrefix} requests --room ${roomArgument} --json`,
      comments: `${commandPrefix} comments --room ${roomArgument} --type comment --open --json`,
      proposals: `${commandPrefix} proposals --room ${roomArgument} --json`,
      reply: `${commandPrefix} reply "<thread-id>" --room ${roomArgument} --text "Short reply." --json`,
      context: `${commandPrefix} context --room ${roomArgument} --json`,
    },
  };
}

export async function bootstrapRoom(options: BootstrapOptions): Promise<BootstrapResult> {
  const commandPrefix = options.nextCommandPrefix ?? DEFAULT_FOLD_AGENT_COMMAND_PREFIX;
  const skill = options.skipSkill
    ? null
    : await installFoldSkill({
      cwd: options.cwd,
      scope: options.skillScope,
      mode: 'update',
    });
  const resume = await resumeRoom({
    cwd: options.cwd,
    room: options.room,
    alias: options.alias,
    outputPath: options.outputPath,
    commandPrefix,
  });

  return {
    schema: 'fold.bootstrap.result.v1',
    ok: true,
    package: {
      name: FOLD_AGENT_PACKAGE_NAME,
      version: FOLD_AGENT_VERSION,
    },
    skill,
    resume,
    nextCommands: resume.nextCommands,
  };
}

function tryParseRoomReference(input: string): RoomAccess | null {
  try {
    return parseRoomReference(input);
  } catch {
    return null;
  }
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
  const inputPrimary = projectFileOrThrow(inputProject, inputProject.primaryPath);
  const existingBaseFile = proposedPath
    ? baseProject.files.find((file) => file.path === proposedPath)
    : null;
  if (proposedPath && !existingBaseFile) {
    throw new Error(`Fresh project files must be posted directly with fold post: ${proposedPath}`);
  }
  const newInputPaths = proposedPath ? [] : projectNewFilePaths(baseProject, inputProject);
  if (newInputPaths.length > 0) {
    throw new Error(`Fresh project files must be posted directly with fold post: ${newInputPaths.join(', ')}`);
  }
  const proposedProject = proposedPath
    ? replaceProjectFile(baseProject, proposedPath, inputPrimary.markdown)
    : preserveBasePrimaryPath(baseProject, inputProject);
  const baseMarkdown = existingBaseFile
    ? existingBaseFile.markdown
    : proposedPath
      ? ''
      : projectFileOrThrow(baseProject, baseProject.primaryPath).markdown;
  const proposedMarkdown = proposedPath
    ? projectFileOrThrow(proposedProject, proposedPath).markdown
    : projectFileOrThrow(proposedProject, proposedProject.primaryPath).markdown;
  const { update, proposal, timelineEvent } = await createEncryptedProposalRecord({
    access: reference,
    baseMarkdown,
    proposedMarkdown,
    baseProject,
    proposedProject: proposedPath ? undefined : proposedProject,
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
    room: safeRoomResult(reference),
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
    room: safeRoomResult(reference),
    proposals: replay.proposals.map(publicProposalListItem),
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
  const type = options.type ?? 'all';
  const visibleComments = comments.filter((comment) => commentMatchesFilter(comment, {
    path: options.path,
    type,
    open: options.open ?? false,
  }));

  return {
    schema: 'fold.comments.result.v1',
    ok: true,
    mode: 'comment-list',
    room: safeRoomResult(reference),
    filters: {
      type,
      open: options.open ?? false,
      path: options.path ?? null,
    },
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
    type: options.type,
  });
  const record = await appendEncryptedUpdate(reference, await createEncryptedCommentRecord(reference, comment));

  return {
    schema: 'fold.comment.result.v1',
    ok: true,
    mode: 'comment',
    room: safeRoomResult(reference),
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
    room: safeRoomResult(reference),
    comment: updated,
    server: {
      recordCount: record.seq,
      latestSeq: record.seq,
    },
  };
}

function commentMatchesFilter(
  comment: RoomComment,
  filter: { path?: string; type: 'all' | 'comment' | 'request'; open: boolean },
) {
  if (filter.path && comment.filePath !== filter.path) return false;
  if (filter.open && comment.resolvedAt) return false;
  if (filter.type === 'request' && comment.type !== 'request') return false;
  if (filter.type === 'comment' && comment.type !== 'note') return false;
  return true;
}

export async function showProposal(options: ProposalIdOptions): Promise<ShowProposalResult> {
  const { reference, records, proposal, timeline } = await getProposalOrThrow(options);
  return {
    schema: 'fold.show-proposal.result.v1',
    ok: true,
    mode: 'proposal',
    room: safeRoomResult(reference),
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
  const acceptedProject = proposal.proposedProject
    ?? (proposal.path
      ? replaceProjectFile(currentProject, proposal.path, proposal.proposed.markdown)
      : singleFileProject(currentProject.primaryPath, proposal.proposed.markdown));
  const primaryMarkdown = projectFileOrThrow(acceptedProject, acceptedProject.primaryPath).markdown;
  const reviewerPersona = assignPersona({
    roomId: reference.roomId,
    participantKind: 'human',
    participantFingerprint: CLI_REVIEWER_FINGERPRINT,
  });
  const eventUpdate = await createProposalAcceptedEvent(reference, proposal, document.sha256, reviewerPersona.id, acceptedProject);
  const eventRecord = await appendEncryptedUpdate(reference, eventUpdate);

  // The accepted event carries the accepted project so replay can recover even if
  // these redundant compatibility snapshots fail after the decision is durable.
  const documentUpdate = await createEncryptedMarkdownReplacementUpdateFromRecords(
    records,
    primaryMarkdown,
    reference,
  );
  await appendEncryptedUpdate(reference, documentUpdate);
  await appendEncryptedUpdate(reference, await createEncryptedProjectSnapshot(reference, acceptedProject));
  const replay = await replayProposalsFromRecords(reference, await listEncryptedUpdates(reference));
  const updated = findProposalInReplay(replay.proposals, options.proposalId);

  return {
    schema: 'fold.accept.result.v1',
    ok: true,
    mode: 'proposal-decision',
    room: safeRoomResult(reference),
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
    room: safeRoomResult(reference),
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
  await assertAliasAvailableForAccess(metadataPath, options.alias, reference);
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
    rooms: rooms.map((room) => safeRoomResult(accessFromEntry(room))),
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
  const outputPath = defaultAgentProjectOutputPath(options.alias);
  const bootstrapCommand = `${DEFAULT_FOLD_AGENT_COMMAND_PREFIX} bootstrap --room ${JSON.stringify(entry.token)} --alias ${JSON.stringify(options.alias)} --output ${outputPath} --json`;
  const agentInviteText = [
    'Join this Fold project room:',
    '',
    '1. Run the pinned Fold agent CLI. It installs the Fold skill locally and resumes the encrypted project:',
    `   ${bootstrapCommand}`,
    '',
    '   Do not use /usr/bin/fold. That is the Unix text wrapper, not Fold.',
    '   The Fold skill teaches agent behavior; fold-agent performs encrypted room operations.',
    '',
    `2. Optional reference skill: ${skillUrl}`,
    '',
    '   Inside a cloned Fold repo during development, the equivalent local command is:',
    `   npm run --silent cli -- bootstrap --room ${JSON.stringify(entry.token)} --alias ${JSON.stringify(options.alias)} --output ${outputPath} --json`,
    '',
    '3. Post fresh Markdown files directly; propose changes to existing files:',
    `   ${DEFAULT_FOLD_AGENT_COMMAND_PREFIX} post ${outputPath}/NEW_FILE.md --room ${JSON.stringify(options.alias)} --path "NEW_FILE.md" --json`,
    `   ${DEFAULT_FOLD_AGENT_COMMAND_PREFIX} propose ${outputPath} --room ${JSON.stringify(options.alias)} --title "Describe the change" --comment "Summarize what changed." --json`,
    '',
    '4. Answer human requests and join comment threads when clarification is better than a proposal:',
    `   ${DEFAULT_FOLD_AGENT_COMMAND_PREFIX} requests --room ${JSON.stringify(options.alias)} --json`,
    `   ${DEFAULT_FOLD_AGENT_COMMAND_PREFIX} comments --room ${JSON.stringify(options.alias)} --type comment --open --json`,
    `   ${DEFAULT_FOLD_AGENT_COMMAND_PREFIX} reply "<thread-id>" --room ${JSON.stringify(options.alias)} --text "Short reply." --json`,
    `   ${DEFAULT_FOLD_AGENT_COMMAND_PREFIX} comment --room ${JSON.stringify(options.alias)} --path "docs/PLAN.md" --text "Short note." --json`,
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
      ? safeRoomResult(access)
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

function safeRoomResult(access: RoomAccess & { alias?: string }): SafeRoomResult {
  return {
    roomId: access.roomId,
    alias: access.alias ?? null,
    appUrl: access.appUrl,
    syncUrl: access.syncUrl,
    serverUrl: access.serverUrl,
    serverRoomUrl: serverRoomUrlForAccess(access),
    hasClientKey: true,
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

function publicProposalListItem(proposal: ProposalView) {
  return {
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

async function assertAliasUnused(metadataPath: string, alias: string): Promise<void> {
  const existing = await findRoomMetadataByAlias(metadataPath, alias);
  if (!existing) return;
  throw new Error(`Room alias already exists: ${alias}. Choose a different alias or forget the existing room first.`);
}

async function assertAliasAvailableForAccess(
  metadataPath: string,
  alias: string,
  access: RoomAccess,
): Promise<void> {
  const existing = await findRoomMetadataByAlias(metadataPath, alias);
  if (!existing) return;
  const existingAccess = accessFromEntry(existing);
  const existingSyncUrl = existingAccess.syncUrl ?? existingAccess.serverUrl;
  const nextSyncUrl = access.syncUrl ?? access.serverUrl;
  if (
    existingAccess.roomId === access.roomId &&
    existingAccess.roomSecret === access.roomSecret &&
    existingSyncUrl === nextSyncUrl
  ) return;
  throw new Error(`Room alias already exists: ${alias}. Choose a different alias or forget the existing room first.`);
}

function defaultAliasForSource(filePath: string): string {
  return basename(filePath).replace(/\.md$/i, '') || 'room';
}

function defaultAgentProjectOutputPath(alias: string): string {
  const slug = alias
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `./fold-project-${slug || 'room'}`;
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

function preserveBasePrimaryPath(baseProject: ProjectSnapshot, inputProject: ProjectSnapshot): ProjectSnapshot {
  return normalizeProjectSnapshot({
    ...inputProject,
    primaryPath: inputProject.files.some((file) => file.path === baseProject.primaryPath)
      ? baseProject.primaryPath
      : inputProject.primaryPath,
  });
}

function projectNewFilePaths(baseProject: ProjectSnapshot, inputProject: ProjectSnapshot): string[] {
  const basePaths = new Set(baseProject.files.map((file) => file.path));
  return inputProject.files
    .map((file) => file.path)
    .filter((path) => !basePaths.has(path));
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
  let proposalsById: Map<string, ProposalView> | undefined;
  const fileAppliedSeq = new Map<string, number>();
  let project: ProjectSnapshot | undefined;

  for (const record of records) {
    if (record.senderId.startsWith(PROJECT_UPDATE_SENDER_ID_PREFIX)) {
      const value = await decryptJsonRecord(access, record, record.senderId);
      if (!isReplayProjectSnapshot(value)) {
        throw new Error('Invalid encrypted project snapshot payload');
      }
      project = normalizeProjectSnapshot(value);
      fileAppliedSeq.clear();
      for (const file of project.files) fileAppliedSeq.set(file.path, record.seq);
      continue;
    }

    if (record.senderId.startsWith(WEB_PROJECT_FILE_SENDER_ID_PREFIX)) {
      const value = await decryptJsonRecord(access, record, record.senderId);
      if (!isReplayWebProjectFileSnapshot(value)) {
        throw new Error('Invalid encrypted web project file snapshot payload');
      }
      if (isStaleProjectFileSnapshotSeq(fileAppliedSeq.get(value.path), record.seq)) continue;
      project = replaceProjectFile(project ?? singleFileProject(value.path, value.markdown), value.path, value.markdown);
      project = normalizeProjectSnapshot({ ...project, updatedAt: value.updatedAt });
      fileAppliedSeq.set(projectFileOrThrow(project, value.path).path, record.seq);
      continue;
    }

    if (!record.senderId.startsWith(TIMELINE_EVENT_SENDER_ID_PREFIX)) continue;
    const event = await decryptTimelineEvent(access, record, record.senderId);
    if (event.type !== 'proposal_accepted' || !event.proposalId) continue;
    if (event.acceptedProject) {
      project = normalizeProjectSnapshot(event.acceptedProject);
    } else {
      if (!proposalsById) {
        const replay = await replayProposalsFromRecords(access, records);
        proposalsById = new Map(replay.proposals.map((proposal) => [proposal.id, proposal]));
      }
      const accepted = proposalsById.get(event.proposalId);
      if (accepted?.proposedProject) {
        project = normalizeProjectSnapshot(accepted.proposedProject);
      } else if (accepted) {
        project = singleFileProject(accepted.path ?? project?.primaryPath ?? 'document.md', accepted.proposed.markdown);
      }
    }
    if (project) {
      fileAppliedSeq.clear();
      for (const file of project.files) fileAppliedSeq.set(file.path, record.seq);
    }
  }

  if (!project) {
    const markdown = records.length > 0
      ? await decryptMarkdownFromRecords(records, access)
      : await decryptLocalSnapshotOrThrow(entry, access);
    project = singleFileProject(entry?.sourcePath ? basename(entry.sourcePath) : 'document.md', markdown);
  }

  return project;
}

function isReplayProjectSnapshot(value: unknown): value is ProjectSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProjectSnapshot>;
  return candidate.schema === 'fold.project.v1'
    && typeof candidate.primaryPath === 'string'
    && typeof candidate.updatedAt === 'string'
    && Array.isArray(candidate.files)
    && candidate.files.every((file) => (
      file &&
      typeof file === 'object' &&
      typeof (file as { path?: unknown }).path === 'string' &&
      typeof (file as { markdown?: unknown }).markdown === 'string'
    ));
}

function isReplayWebProjectFileSnapshot(value: unknown): value is { path: string; markdown: string; updatedAt: string } {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { type?: unknown; path?: unknown; markdown?: unknown; updatedAt?: unknown };
  return candidate.type === 'project_file_snapshot'
    && typeof candidate.path === 'string'
    && typeof candidate.markdown === 'string'
    && typeof candidate.updatedAt === 'string';
}

function isStaleProjectFileSnapshot(currentUpdatedAt: string | undefined, nextUpdatedAt: string) {
  if (!currentUpdatedAt) return false;
  const currentTime = Date.parse(currentUpdatedAt);
  const nextTime = Date.parse(nextUpdatedAt);
  if (!Number.isNaN(currentTime) && !Number.isNaN(nextTime)) {
    return nextTime < currentTime;
  }
  return nextUpdatedAt < currentUpdatedAt;
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
