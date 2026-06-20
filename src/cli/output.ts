import type { CommandContext } from '@stricli/core';
import type {
  DecideProposalResult,
  BootstrapResult,
  CommentResult,
  CommentsResult,
  ExportResult,
  PatchResult,
  PostResult,
  ProposalsResult,
  ProposeResult,
  PublishResult,
  ResumeResult,
  RoomCreateResult,
  RoomForgetResult,
  RoomInviteResult,
  RoomListResult,
  RoomProfileResult,
  ShowProposalResult,
  SkillInstallResult,
  StatusResult,
} from './results.js';

export function writeJson(context: CommandContext, value: unknown): void {
  context.process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function writePublishHuman(context: CommandContext, result: PublishResult): void {
  const projectOutputPath = result.room.alias ? defaultAgentProjectOutputPath(result.room.alias) : './fold-project-room';
  const inviteLines = result.metadata.saved && result.room.alias
    ? [
      `→ Invite a human: fold room invite ${JSON.stringify(result.room.alias)} --for human`,
      `→ Invite an agent: fold room invite ${JSON.stringify(result.room.alias)} --for agent`,
      `→ Export for local work: fold export --room ${JSON.stringify(result.room.alias)} --output ${projectOutputPath}`,
    ]
    : [
      '→ Save this token with `fold room add ... --alias <name>` before generating invites.',
    ];

  context.process.stdout.write([
    '✓ Published encrypted Markdown room',
    `→ Room URL: ${result.room.url}`,
    `→ Token: ${result.room.token}`,
    `→ Server records: ${result.server.recordCount}`,
    result.metadata.saved
      ? `→ Saved metadata: ${result.metadata.path}`
      : '→ Metadata not saved (--no-save)',
    ...inviteLines,
    '',
  ].join('\n'));
}

export function writeRoomCreateHuman(context: CommandContext, result: RoomCreateResult): void {
  context.process.stdout.write([
    '✓ Created encrypted Fold room',
    `→ Room URL: ${result.room.url}`,
    `→ Token: ${result.room.token}`,
    `→ Saved alias: ${result.metadata.alias}`,
    `→ Server records: ${result.server.recordCount}`,
    `→ Invite a human: fold room invite ${JSON.stringify(result.metadata.alias)} --for human`,
    `→ Invite an agent: fold room invite ${JSON.stringify(result.metadata.alias)} --for agent`,
    `→ Post a fresh file: fold post ./project/README.md --room ${JSON.stringify(result.metadata.alias)} --path README.md`,
    '',
  ].join('\n'));
}

export function writeExportHuman(context: CommandContext, result: ExportResult): void {
  if (result.output.written) {
    context.process.stdout.write([
      `✓ Exported Markdown to ${result.output.path}`,
      `→ Source room: ${result.room.serverRoomUrl}`,
      `→ Server records: ${result.server.recordCount}`,
      '',
    ].join('\n'));
    return;
  }

  context.process.stdout.write(result.document.markdown);
}

export function writeStatusHuman(context: CommandContext, result: StatusResult): void {
  context.process.stdout.write([
    result.metadata.found ? '✓ Local room metadata found' : '⚠ Local room metadata not found',
    `→ Room: ${result.room.serverRoomUrl}`,
    `→ Metadata: ${result.metadata.path}`,
    result.document ? `→ Markdown bytes: ${result.document.bytes}` : '→ Markdown bytes: unknown',
    `→ Server records: ${result.server.recordCount}`,
    '',
  ].join('\n'));
}

export function writeResumeHuman(context: CommandContext, result: ResumeResult): void {
  const suggestedOutputPath = defaultAgentProjectOutputPath(result.metadata.alias);
  const outputLine = result.export?.output.written
    ? `→ Exported files: ${result.export.output.path}`
    : '→ Export skipped: pass --output <path> to write accepted files';
  context.process.stdout.write([
    '✓ Resumed encrypted Fold room',
    `→ Room: ${result.room.serverRoomUrl}`,
    `→ Alias: ${result.metadata.alias}`,
    outputLine,
    `→ Open requests: ${result.requests.comments.length}`,
    `→ Open comments: ${result.comments.comments.length}`,
    `→ Pending proposals: ${result.proposals.proposals.filter((proposal) => proposal.status === 'pending').length}`,
    `→ Agent skill: ${result.skill.url}`,
    '',
    'Next commands:',
    result.nextCommands.post ?? null,
    result.nextCommands.propose ?? `Run fold resume --room ${JSON.stringify(result.metadata.alias)} --output ${suggestedOutputPath} --json before proposing from exported files.`,
    result.nextCommands.requests,
    result.nextCommands.comments,
    result.nextCommands.proposals,
    '',
  ].filter((line): line is string => line !== null).join('\n'));
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

export function writeBootstrapHuman(context: CommandContext, result: BootstrapResult): void {
  const skillLine = result.skill
    ? `→ Skill install: ${result.skill.installed.length} installed, ${result.skill.updated.length} updated, ${result.skill.skipped.length} skipped`
    : '→ Skill install skipped';
  context.process.stdout.write([
    '✓ Bootstrapped Fold agent workspace',
    skillLine,
    `→ Alias: ${result.resume.metadata.alias}`,
    result.resume.export?.output.written
      ? `→ Exported files: ${result.resume.export.output.path}`
      : '→ Export skipped: pass --output <path> to write accepted files',
    '',
    'Next commands:',
    result.nextCommands.post ?? null,
    result.nextCommands.propose ?? null,
    result.nextCommands.requests,
    result.nextCommands.comments,
    result.nextCommands.proposals,
    '',
  ].filter((line): line is string => line !== null).join('\n'));
}

export function writeSkillHuman(context: CommandContext, result: SkillInstallResult): void {
  const lines = [
    result.installed.map((entry) => `✓ Installed Fold skill: ${entry.path}`),
    result.updated.map((entry) => `✓ Updated Fold skill: ${entry.path}`),
    result.skipped.map((entry) => {
      const reason = entry.reason ? ` (${entry.reason})` : '';
      return `→ Skipped Fold skill: ${entry.path}${reason}`;
    }),
  ].flat();
  context.process.stdout.write([
    lines.length > 0 ? lines.join('\n') : 'No Fold skill targets found.',
    '',
  ].join('\n'));
}

export function writePostHuman(context: CommandContext, result: PostResult): void {
  context.process.stdout.write([
    '✓ Posted encrypted Markdown file',
    `→ Room: ${result.room.serverRoomUrl}`,
    `→ File: ${result.file.path}`,
    `→ Project files: ${result.project.fileCount}`,
    `→ Server records: ${result.server.recordCount}`,
    '',
  ].join('\n'));
}

export function writePatchHuman(context: CommandContext, result: PatchResult): void {
  context.process.stdout.write([
    '✓ Submitted encrypted patch suggestion',
    `→ Room: ${result.room.serverRoomUrl}`,
    `→ Suggestion: ${result.suggestion.id}`,
    `→ Base: ${result.base.sha256}`,
    `→ Proposed: ${result.proposed.sha256}`,
    `→ Server records: ${result.server.recordCount}`,
    '',
  ].join('\n'));
}

export function writeProposeHuman(context: CommandContext, result: ProposeResult): void {
  context.process.stdout.write([
    '✓ Submitted encrypted proposal',
    `→ Room: ${result.room.serverRoomUrl}`,
    `→ Proposal: ${result.proposal.id}`,
    `→ Title: ${result.proposal.title}`,
    `→ Persona: ${result.proposal.persona.name} (${result.proposal.persona.label})`,
    `→ Status: ${result.proposal.status}`,
    `→ Server records: ${result.server.recordCount}`,
    '',
  ].join('\n'));
}

export function writeProposalsHuman(context: CommandContext, result: ProposalsResult): void {
  if (result.proposals.length === 0) {
    context.process.stdout.write('No proposals found.\n');
    return;
  }

  context.process.stdout.write(`${result.proposals.map((proposal) => [
    `${proposal.id}  ${proposal.status}  ${proposal.title}`,
    `  ${proposal.persona.name} (${proposal.persona.label})`,
  ].join('\n')).join('\n')}\n`);
}

export function writeShowProposalHuman(context: CommandContext, result: ShowProposalResult): void {
  context.process.stdout.write([
    `${result.proposal.id}  ${result.proposal.status}`,
    `Title: ${result.proposal.title}`,
    `Persona: ${result.proposal.persona.name} (${result.proposal.persona.label})`,
    result.proposal.comment ? `Comment: ${result.proposal.comment}` : null,
    `Base: ${result.proposal.base.sha256}`,
    `Proposed: ${result.proposal.proposed.sha256}`,
    '',
  ].filter(Boolean).join('\n'));
}

export function writeDecisionHuman(context: CommandContext, result: DecideProposalResult): void {
  context.process.stdout.write([
    `✓ Proposal ${result.status}`,
    `→ Proposal: ${result.proposal.id}`,
    result.document ? `→ Document: ${result.document.sha256}` : null,
    `→ Server records: ${result.server.recordCount}`,
    '',
  ].filter(Boolean).join('\n'));
}

export function writeCommentsHuman(context: CommandContext, result: CommentsResult): void {
  if (result.comments.length === 0) {
    context.process.stdout.write(`No ${commentListLabel(result)} found.\n`);
    return;
  }

  context.process.stdout.write(`${result.comments.map((comment) => [
    `${comment.id}  ${comment.type === 'request' ? 'request' : 'comment'}  ${comment.resolvedAt ? 'resolved' : 'open'}  ${comment.filePath ?? 'document'}`,
    `  ${comment.persona.name} (${comment.persona.label}): ${comment.text}`,
    ...(comment.replies || []).map((reply) => `  ↳ ${reply.id}  ${reply.persona.name}: ${reply.text}`),
  ].join('\n')).join('\n')}\n`);
}

export function writeCommentHuman(context: CommandContext, result: CommentResult): void {
  const kind = result.comment.type === 'request' ? 'request' : 'comment';
  context.process.stdout.write([
    result.schema === 'fold.reply.result.v1' ? `✓ Added encrypted ${kind} reply` : `✓ Added encrypted ${kind}`,
    `→ Room: ${result.room.serverRoomUrl}`,
    `→ ${result.comment.type === 'request' ? 'Request' : 'Comment'}: ${result.comment.id}`,
    `→ File: ${result.comment.filePath ?? 'document'}`,
    `→ Replies: ${result.comment.replies?.length ?? 0}`,
    `→ Server records: ${result.server.recordCount}`,
    '',
  ].join('\n'));
}

function commentListLabel(result: CommentsResult) {
  const base = result.filters.type === 'request'
    ? 'requests'
    : result.filters.type === 'comment'
      ? 'comments'
      : 'comments';
  return result.filters.open ? `open ${base}` : base;
}

export function writeRoomProfileHuman(context: CommandContext, result: RoomProfileResult): void {
  context.process.stdout.write([
    `✓ Saved room ${result.metadata.alias}`,
    `→ Room URL: ${result.room.url}`,
    `→ App URL: ${result.room.appUrl}`,
    `→ Sync URL: ${result.room.syncUrl}`,
    `→ Metadata: ${result.metadata.path}`,
    '',
  ].join('\n'));
}

export function writeRoomListHuman(context: CommandContext, result: RoomListResult): void {
  if (result.rooms.length === 0) {
    context.process.stdout.write('No saved rooms found.\n');
    return;
  }
  context.process.stdout.write(`${result.rooms.map((room) => [
    `${room.alias ?? room.roomId}  ${room.roomId}`,
    `  ${room.appUrl}`,
  ].join('\n')).join('\n')}\n`);
}

export function writeRoomForgetHuman(context: CommandContext, result: RoomForgetResult): void {
  context.process.stdout.write(`✓ Forgot room ${result.metadata.alias}\n`);
}

export function writeRoomInviteHuman(context: CommandContext, result: RoomInviteResult): void {
  const warnings = result.warnings.map((warning) => `⚠ ${warning}`);
  context.process.stdout.write([
    ...warnings,
    ...(warnings.length > 0 ? [''] : []),
    result.invite.text,
    '',
  ].join('\n'));
}
