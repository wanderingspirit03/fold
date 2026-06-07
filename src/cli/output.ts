import type { CommandContext } from '@stricli/core';
import type {
  DecideProposalResult,
  ExportResult,
  PatchResult,
  ProposalsResult,
  ProposeResult,
  PublishResult,
  ShowProposalResult,
  StatusResult,
} from './results.js';

export function writeJson(context: CommandContext, value: unknown): void {
  context.process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function writePublishHuman(context: CommandContext, result: PublishResult): void {
  context.process.stdout.write([
    '✓ Published encrypted Markdown room',
    `→ Room URL: ${result.room.url}`,
    `→ Token: ${result.room.token}`,
    `→ Server records: ${result.server.recordCount}`,
    result.metadata.saved
      ? `→ Saved metadata: ${result.metadata.path}`
      : '→ Metadata not saved (--no-save)',
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
