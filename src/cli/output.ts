import type { CommandContext } from '@stricli/core';
import type {
  DecideProposalResult,
  CommentResult,
  CommentsResult,
  ExportResult,
  PatchResult,
  ProposalsResult,
  ProposeResult,
  PublishResult,
  RoomCreateResult,
  RoomForgetResult,
  RoomInviteResult,
  RoomListResult,
  RoomProfileResult,
  ShowProposalResult,
  StatusResult,
} from './results.js';

export function writeJson(context: CommandContext, value: unknown): void {
  context.process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function writePublishHuman(context: CommandContext, result: PublishResult): void {
  const inviteLines = result.metadata.saved && result.room.alias
    ? [
      `→ Invite a human: fold room invite ${JSON.stringify(result.room.alias)} --for human`,
      `→ Invite an agent: fold room invite ${JSON.stringify(result.room.alias)} --for agent`,
      `→ Export for local work: fold export --room ${JSON.stringify(result.room.alias)} --output ./fold-project`,
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
    `→ Add files later: fold propose ./project --room ${JSON.stringify(result.metadata.alias)}`,
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
    context.process.stdout.write('No comments found.\n');
    return;
  }

  context.process.stdout.write(`${result.comments.map((comment) => [
    `${comment.id}  ${comment.resolvedAt ? 'resolved' : 'open'}  ${comment.filePath ?? 'document'}`,
    `  ${comment.persona.name} (${comment.persona.label}): ${comment.text}`,
    ...(comment.replies || []).map((reply) => `  ↳ ${reply.id}  ${reply.persona.name}: ${reply.text}`),
  ].join('\n')).join('\n')}\n`);
}

export function writeCommentHuman(context: CommandContext, result: CommentResult): void {
  context.process.stdout.write([
    result.schema === 'fold.reply.result.v1' ? '✓ Added encrypted comment reply' : '✓ Added encrypted comment',
    `→ Room: ${result.room.serverRoomUrl}`,
    `→ Comment: ${result.comment.id}`,
    `→ File: ${result.comment.filePath ?? 'document'}`,
    `→ Replies: ${result.comment.replies?.length ?? 0}`,
    `→ Server records: ${result.server.recordCount}`,
    '',
  ].join('\n'));
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
