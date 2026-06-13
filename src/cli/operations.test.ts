import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EncryptedAppendLogServer } from '../../spikes/e2ee-yjs-append-log/server.js';
import { decryptMarkdownFromRecords } from '../rooms/markdown-snapshot.js';
import { defaultMetadataPath, readRoomMetadata } from '../rooms/metadata.js';
import { createRoomToken, parseRoomReference, type RoomAccess } from '../rooms/room-reference.js';
import {
  acceptProposal,
  addComment,
  addRoomProfile,
  createRoomInvite,
  createRoomProfile,
  exportMarkdown,
  listComments,
  listRoomProfiles,
  listProposals,
  patchMarkdown,
  proposeMarkdown,
  publishMarkdown,
  rejectProposal,
  replyToComment,
  roomStatus,
  showProposal,
} from './operations.js';

describe('CLI operations', () => {
  it('publishes Markdown as encrypted local metadata by default', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-cli-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    try {
      await writeFile(join(cwd, 'report.md'), '# Agent Report\n\nPrivate body.', 'utf8');

      const result = await publishMarkdown({
        cwd,
        filePath: 'report.md',
        serverUrl,
        save: true,
      });

      expect(result.schema).toBe('fold.publish.result.v1');
      expect(result.mode).toBe('server-backed');
      expect(result.room.url).toContain('#key=');
      expect(result.room.serverRoomUrl).not.toContain('#key=');
      expect(result.room.alias).toBe('report');
      expect(result.metadata.saved).toBe(true);
      expect(result.document.canonical).toBe('y.text:markdown');
      expect(result.server.recordCount).toBe(3);
      expect(result.project.fileCount).toBe(1);

      const rawMetadata = await readFile(defaultMetadataPath(cwd), 'utf8');
      expect(rawMetadata).not.toContain('Private body.');
      const metadata = await readRoomMetadata(defaultMetadataPath(cwd));
      expect(metadata.rooms).toHaveLength(1);
      expect(metadata.rooms[0]?.encryptedSnapshot.format).toBe('encrypted-yjs-update-v1');
      expect(server.store.serialized(result.room.roomId)).not.toContain('Private body.');
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('does not write metadata when --no-save behavior is requested', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-cli-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    try {
      await writeFile(join(cwd, 'draft.md'), 'unsaved draft', 'utf8');

      const result = await publishMarkdown({
        cwd,
        filePath: 'draft.md',
        serverUrl,
        save: false,
      });

      expect(result.metadata.saved).toBe(false);
      expect(result.room.alias).toBeNull();
      expect(result.server.recordCount).toBe(3);
      await expect(readFile(defaultMetadataPath(cwd), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('creates an empty encrypted room without requiring a source file', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-room-create-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    try {
      const created = await createRoomProfile({
        cwd,
        alias: 'empty',
        serverUrl,
      });
      const exported = await exportMarkdown({
        cwd,
        room: 'empty',
        outputPath: 'empty.md',
      });
      const humanInvite = await createRoomInvite({
        cwd,
        alias: 'empty',
        audience: 'human',
      });
      const agentInvite = await createRoomInvite({
        cwd,
        alias: 'empty',
        audience: 'agent',
      });

      expect(created.schema).toBe('fold.room.create.result.v1');
      expect(created.room.alias).toBe('empty');
      expect(created.room.url).toContain('#key=');
      expect(created.project.primaryPath).toBe('document.md');
      expect(created.project.fileCount).toBe(1);
      expect(created.server.recordCount).toBe(3);
      expect(exported.document.markdown).toBe('');
      expect(await readFile(join(cwd, 'empty.md'), 'utf8')).toBe('');
      expect(humanInvite.invite.text).toContain(created.room.url);
      expect(agentInvite.invite.text).toContain('fold room add');
      expect(agentInvite.invite.text).toContain('fold export --room "empty" --output ./fold-project --json');
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('exports Markdown by decrypting the saved Y.Text snapshot locally', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-cli-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    try {
      const markdown = '# Export Me\n\n- from encrypted local metadata';
      await writeFile(join(cwd, 'export-me.md'), markdown, 'utf8');
      const published = await publishMarkdown({
        cwd,
        filePath: 'export-me.md',
        serverUrl,
        save: true,
      });

      const exported = await exportMarkdown({
        cwd,
        room: published.room.token,
        outputPath: 'out/exported.md',
      });

      expect(exported.schema).toBe('fold.export.result.v1');
      expect(exported.document.markdown).toBe(markdown);
      expect(exported.output.written).toBe(true);
      expect(exported.server.recordCount).toBe(3);
      expect(await readFile(join(cwd, 'out', 'exported.md'), 'utf8')).toBe(markdown);
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('reports local room status with a stable schema', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-cli-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    try {
      await mkdir(join(cwd, 'nested'));
      await writeFile(join(cwd, 'nested', 'status.md'), 'status text', 'utf8');
      const published = await publishMarkdown({
        cwd,
        filePath: 'nested/status.md',
        serverUrl,
        save: true,
      });

      const status = await roomStatus({
        cwd,
        room: published.room.url,
      });

      expect(status.schema).toBe('fold.status.result.v1');
      expect(status.metadata.found).toBe(true);
      expect(status.document?.bytes).toBe(Buffer.byteLength('status text', 'utf8'));
      expect(status.server.checked).toBe(true);
      expect(status.server.recordCount).toBe(3);
      expect(status.room.serverRoomUrl).not.toContain('#key=');
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('lets agents add and reply to encrypted room comments', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-cli-comments-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    try {
      await writeFile(join(cwd, 'plan.md'), '# Plan\n\nKeep comments inline.', 'utf8');
      const published = await publishMarkdown({
        cwd,
        filePath: 'plan.md',
        serverUrl,
        save: true,
      });

      const added = await addComment({
        cwd,
        room: published.room.alias!,
        path: 'plan.md',
        quote: 'comments inline',
        text: 'Can an agent clarify this?',
      });
      const replied = await replyToComment({
        cwd,
        room: published.room.alias!,
        commentId: added.comment.id,
        text: 'Yes, threaded replies are encrypted room records.',
      });
      const listed = await listComments({
        cwd,
        room: published.room.alias!,
      });

      expect(added.schema).toBe('fold.comment.result.v1');
      expect(added.comment.persona.kind).toBe('agent');
      expect(added.comment.anchorType).toBe('text-range');
      expect(replied.schema).toBe('fold.reply.result.v1');
      expect(replied.comment.replies).toHaveLength(1);
      expect(listed.comments).toHaveLength(1);
      expect(listed.comments[0]?.replies?.[0]?.text).toBe('Yes, threaded replies are encrypted room records.');
      expect(server.store.serialized(published.room.roomId)).not.toContain('Can an agent clarify this?');
      expect(server.store.serialized(published.room.roomId)).not.toContain('threaded replies');
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('finds local metadata by room URL when the server has a base path', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-cli-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    try {
      const markdown = '# Base Path Room\n\nURL lookup should preserve the server prefix.';
      await writeFile(join(cwd, 'base-path.md'), markdown, 'utf8');
      const published = await publishMarkdown({
        cwd,
        filePath: 'base-path.md',
        serverUrl: `${serverUrl}/base`,
        save: true,
      });

      const status = await roomStatus({
        cwd,
        room: published.room.url,
      });
      const exported = await exportMarkdown({
        cwd,
        room: published.room.url,
      });

      expect(published.room.serverRoomUrl).toContain('/base/room/');
      expect(status.metadata.found).toBe(true);
      expect(status.server.recordCount).toBe(3);
      expect(exported.document.markdown).toBe(markdown);
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('submits encrypted whole-document patch suggestions as proposals without changing export', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-cli-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    try {
      const original = '# Patch Base\n\nOriginal body.';
      const proposed = '# Patch Base\n\nProposed body.';
      await writeFile(join(cwd, 'room.md'), original, 'utf8');
      await writeFile(join(cwd, 'proposal.md'), proposed, 'utf8');
      const published = await publishMarkdown({
        cwd,
        filePath: 'room.md',
        serverUrl,
        save: true,
      });

      const patch = await patchMarkdown({
        cwd,
        filePath: 'proposal.md',
        room: published.room.url,
        summary: 'Update body copy',
      });
      const exported = await exportMarkdown({
        cwd,
        room: published.room.url,
      });

      expect(patch.schema).toBe('fold.patch.result.v1');
      expect(patch.mode).toBe('suggestion');
      expect(patch.server.recordCount).toBe(5);
      expect(patch.base.sha256).toBe(published.document.sha256);
      expect(patch.proposed.bytes).toBe(Buffer.byteLength(proposed, 'utf8'));
      expect(exported.document.markdown).toBe(original);

      const serverStorage = server.store.serialized(published.room.roomId);
      expect(serverStorage).not.toContain(original);
      expect(serverStorage).not.toContain(proposed);
      const proposalRecord = server.store.list(published.room.roomId)[3];
      expect(proposalRecord?.senderId).toContain('fold-cli:proposal');
      const proposals = await listProposals({ cwd, room: published.room.url });
      expect(proposals.proposals).toHaveLength(1);
      expect(proposals.proposals[0]?.title).toBe('Update body copy');
      expect(proposals.proposals[0]?.status).toBe('pending');
      expect(JSON.stringify(patch)).not.toContain(proposed);
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('lists, shows, accepts, and rejects encrypted proposal records by replaying events', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-cli-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    try {
      const original = '# Proposal Base\n\nOriginal body.';
      const acceptedMarkdown = '# Proposal Base\n\nAccepted body.';
      const rejectedMarkdown = '# Proposal Base\n\nRejected body.';
      await writeFile(join(cwd, 'room.md'), original, 'utf8');
      await writeFile(join(cwd, 'accepted.md'), acceptedMarkdown, 'utf8');
      await writeFile(join(cwd, 'rejected.md'), rejectedMarkdown, 'utf8');
      const published = await publishMarkdown({
        cwd,
        filePath: 'room.md',
        serverUrl,
        save: true,
      });

      const acceptedProposal = await proposeMarkdown({
        cwd,
        filePath: 'accepted.md',
        room: published.room.token,
        title: 'Accept me',
        comment: 'Apply this one.',
      });
      const rejectedProposal = await proposeMarkdown({
        cwd,
        filePath: 'rejected.md',
        room: published.room.token,
        title: 'Reject me',
        comment: 'Do not apply this one.',
      });

      let proposals = await listProposals({ cwd, room: published.room.token });
      expect(proposals.proposals.map((proposal) => proposal.status)).toEqual(['pending', 'pending']);
      expect(proposals.proposals[0]?.persona.kind).toBe('agent');
      expect(proposals.proposals[0]?.proposed).not.toHaveProperty('markdown');

      const shown = await showProposal({
        cwd,
        room: published.room.token,
        proposalId: acceptedProposal.proposal.id,
      });
      expect(JSON.stringify(acceptedProposal)).not.toContain(acceptedMarkdown);
      expect(shown.proposal.proposed.markdown).toBe(acceptedMarkdown);
      expect(shown.timeline.map((event) => event.type)).toContain('proposal_submitted');

      const accepted = await acceptProposal({
        cwd,
        room: published.room.token,
        proposalId: acceptedProposal.proposal.id,
      });
      await expect(acceptProposal({
        cwd,
        room: published.room.token,
        proposalId: rejectedProposal.proposal.id,
      })).rejects.toThrow(/current document/);
      const rejected = await rejectProposal({
        cwd,
        room: published.room.token,
        proposalId: rejectedProposal.proposal.id,
      });
      proposals = await listProposals({ cwd, room: published.room.token });
      const exported = await exportMarkdown({ cwd, room: published.room.token });
      const canonicalMarkdown = await decryptMarkdownFromRecords(
        server.store.list(published.room.roomId),
        parseRoomReference(published.room.token),
      );

      expect(accepted.schema).toBe('fold.accept.result.v1');
      expect(accepted.proposal.status).toBe('accepted');
      expect(JSON.stringify(accepted)).not.toContain(acceptedMarkdown);
      expect(rejected.schema).toBe('fold.reject.result.v1');
      expect(rejected.proposal.status).toBe('rejected');
      expect(proposals.proposals.map((proposal) => proposal.status)).toEqual(['accepted', 'rejected']);
      expect(exported.document.markdown).toBe(acceptedMarkdown);
      expect(canonicalMarkdown).toBe(acceptedMarkdown);
      expect(server.store.list(published.room.roomId).filter((record) => record.senderId === 'fold-cli:document')).toHaveLength(2);

      const serverStorage = server.store.serialized(published.room.roomId);
      expect(serverStorage).not.toContain(original);
      expect(serverStorage).not.toContain(acceptedMarkdown);
      expect(serverStorage).not.toContain(rejectedMarkdown);
      await expect(rejectProposal({
        cwd,
        room: published.room.token,
        proposalId: acceptedProposal.proposal.id,
      })).rejects.toThrow(/already accepted/);
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('saves room aliases and generates agent invites with local URL warnings', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-room-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    try {
      await writeFile(join(cwd, 'room.md'), '# Alias Room', 'utf8');
      const published = await publishMarkdown({
        cwd,
        filePath: 'room.md',
        serverUrl,
        alias: 'launch',
        save: true,
      });

      const status = await roomStatus({ cwd, room: 'launch' });
      const list = await listRoomProfiles({ cwd });
      const invite = await createRoomInvite({
        cwd,
        alias: 'launch',
        audience: 'agent',
      });
      const humanInvite = await createRoomInvite({
        cwd,
        alias: 'launch',
        audience: 'human',
      });

      expect(status.room.alias).toBe('launch');
      expect(invite.invite.text).toContain('fold room add');
      expect(invite.invite.text).toContain('npm run --silent cli -- room add');
      expect(invite.invite.text).toContain('fold export --room "launch" --output ./fold-project --json');
      expect(invite.invite.text).toContain('fold propose ./fold-project --room "launch"');
      expect(invite.invite.text).toContain('--alias');
      expect(invite.invite.text).toContain('fold:v1:');
      expect(invite.invite.text).not.toContain('#key=');
      expect(invite.warnings.length).toBeGreaterThan(0);
      expect(invite.room.url).toBe(published.room.serverRoomUrl);
      expect(invite.room.token).toBe('[redacted]');
      expect(invite.room.hasClientKey).toBe(false);
      expect(humanInvite.invite.text).toContain('Open this Fold project:');
      expect(humanInvite.invite.text).toContain('#key=');
      expect(humanInvite.room.hasClientKey).toBe(true);
      expect(list.rooms[0]?.token).toBe('[redacted]');
      expect(list.rooms[0]?.url).not.toContain('#key=');
      expect(list.rooms[0]?.hasClientKey).toBe(false);
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('agent invite tokens preserve split app and sync URLs when imported', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-split-url-'));
    const otherCwd = await mkdtemp(join(tmpdir(), 'fold-split-url-other-'));
    try {
      const access: RoomAccess = {
        roomId: 'split-room',
        roomSecret: 'split-secret',
        appUrl: 'https://app.example.test',
        syncUrl: 'https://sync.example.test',
        serverUrl: 'https://sync.example.test',
      };
      const added = await addRoomProfile({
        cwd,
        room: createRoomToken(access),
        alias: 'split',
      });
      const invite = await createRoomInvite({ cwd, alias: 'split', audience: 'agent' });
      const token = /fold:v1:[A-Za-z0-9_-]+/.exec(invite.invite.text)?.[0] ?? '';
      const imported = await addRoomProfile({ cwd: otherCwd, room: token, alias: 'split' });
      expect(added.room.appUrl).toBe('https://app.example.test');
      expect(added.room.syncUrl).toBe('https://sync.example.test');
      expect(imported.room.appUrl).toBe('https://app.example.test');
      expect(imported.room.syncUrl).toBe('https://sync.example.test');
    } finally {
      await rm(cwd, { recursive: true, force: true });
      await rm(otherCwd, { recursive: true, force: true });
    }
  });

  it('publishes, exports, proposes, and accepts a Markdown project directory through existing verbs', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-project-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    try {
      await mkdir(join(cwd, 'project', 'docs'), { recursive: true });
      await writeFile(join(cwd, 'project', 'README.md'), '# Project\n\nOriginal readme.', 'utf8');
      await writeFile(join(cwd, 'project', 'docs', 'PLAN.md'), '# Plan\n\nOriginal plan.', 'utf8');
      const published = await publishMarkdown({
        cwd,
        filePath: 'project',
        serverUrl,
        alias: 'project',
        save: true,
      });

      const exported = await exportMarkdown({
        cwd,
        room: 'project',
        outputPath: 'exported',
      });
      expect(published.project.fileCount).toBe(2);
      expect(exported.project.files.map((file) => file.path)).toEqual(['docs/PLAN.md', 'README.md']);
      expect(await readFile(join(cwd, 'exported', 'docs', 'PLAN.md'), 'utf8')).toContain('Original plan.');

      await mkdir(join(cwd, 'next', 'docs'), { recursive: true });
      await writeFile(join(cwd, 'next', 'README.md'), '# Project\n\nUpdated readme.', 'utf8');
      await writeFile(join(cwd, 'next', 'docs', 'PLAN.md'), '# Plan\n\nUpdated plan.', 'utf8');
      const proposed = await proposeMarkdown({
        cwd,
        filePath: 'next',
        room: 'project',
        title: 'Update project',
      });
      expect(proposed.proposal.kind).toBe('project-replacement');
      expect(proposed.project.proposed.fileCount).toBe(2);

      await acceptProposal({
        cwd,
        room: 'project',
        proposalId: proposed.proposal.id,
      });
      await exportMarkdown({
        cwd,
        room: 'project',
        outputPath: 'accepted',
      });
      expect(await readFile(join(cwd, 'accepted', 'README.md'), 'utf8')).toContain('Updated readme.');
      expect(await readFile(join(cwd, 'accepted', 'docs', 'PLAN.md'), 'utf8')).toContain('Updated plan.');
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('merges a single-file proposal into a multi-file project without dropping other files', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-file-proposal-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    try {
      await mkdir(join(cwd, 'project', 'docs'), { recursive: true });
      await writeFile(join(cwd, 'project', 'README.md'), '# Readme\n\nKeep me.', 'utf8');
      await writeFile(join(cwd, 'project', 'docs', 'PLAN.md'), '# Plan\n\nOld plan.', 'utf8');
      const published = await publishMarkdown({
        cwd,
        filePath: 'project',
        serverUrl,
        alias: 'merge',
        save: true,
      });
      await mkdir(join(cwd, 'draft', 'docs'), { recursive: true });
      await writeFile(join(cwd, 'draft', 'docs', 'PLAN.md'), '# Plan\n\nNew plan.', 'utf8');

      const proposed = await proposeMarkdown({
        cwd,
        filePath: 'draft/docs/PLAN.md',
        room: 'merge',
        path: 'docs/PLAN.md',
        title: 'Update plan only',
      });
      expect(proposed.proposal.kind).toBe('file-replacement');
      await acceptProposal({ cwd, room: 'merge', proposalId: proposed.proposal.id });
      await exportMarkdown({ cwd, room: published.room.token, outputPath: 'merged' });

      expect(await readFile(join(cwd, 'merged', 'README.md'), 'utf8')).toContain('Keep me.');
      expect(await readFile(join(cwd, 'merged', 'docs', 'PLAN.md'), 'utf8')).toContain('New plan.');
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('replays web-created project file snapshots in CLI project exports', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-web-file-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    try {
      await writeFile(join(cwd, 'README.md'), '# Project\n\nOriginal readme.', 'utf8');
      const published = await publishMarkdown({
        cwd,
        filePath: 'README.md',
        serverUrl,
        alias: 'web-files',
        save: true,
      });
      const access = parseRoomReference(published.room.token);
      const { encryptJsonRecord } = await import('../rooms/timeline.js');
      await server.store.append(access.roomId, await encryptJsonRecord(access, 'web-client:file:test', {
        type: 'project_file_snapshot',
        path: 'docs/PLAN.md',
        markdown: '# Plan\n\nCreated in the web UI.',
        updatedAt: new Date().toISOString(),
      }));

      await exportMarkdown({
        cwd,
        room: 'web-files',
        outputPath: 'web-export',
      });

      expect(await readFile(join(cwd, 'web-export', 'README.md'), 'utf8')).toContain('Original readme.');
      expect(await readFile(join(cwd, 'web-export', 'docs', 'PLAN.md'), 'utf8')).toContain('Created in the web UI.');
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
