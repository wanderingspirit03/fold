import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EncryptedAppendLogServer } from '../../spikes/e2ee-yjs-append-log/server.js';
import { defaultMetadataPath, readRoomMetadata } from '../rooms/metadata.js';
import {
  acceptProposal,
  exportMarkdown,
  listProposals,
  patchMarkdown,
  proposeMarkdown,
  publishMarkdown,
  rejectProposal,
  roomStatus,
  showProposal,
} from './operations.js';

describe('CLI operations', () => {
  it('publishes Markdown as encrypted local metadata by default', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'mdroom-cli-'));
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

      expect(result.schema).toBe('mdroom.publish.result.v1');
      expect(result.mode).toBe('server-backed');
      expect(result.room.url).toContain('#key=');
      expect(result.room.serverRoomUrl).not.toContain('#key=');
      expect(result.metadata.saved).toBe(true);
      expect(result.document.canonical).toBe('y.text:markdown');
      expect(result.server.recordCount).toBe(2);

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
    const cwd = await mkdtemp(join(tmpdir(), 'mdroom-cli-'));
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
      expect(result.server.recordCount).toBe(2);
      await expect(readFile(defaultMetadataPath(cwd), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('exports Markdown by decrypting the saved Y.Text snapshot locally', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'mdroom-cli-'));
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

      expect(exported.schema).toBe('mdroom.export.result.v1');
      expect(exported.document.markdown).toBe(markdown);
      expect(exported.output.written).toBe(true);
      expect(exported.server.recordCount).toBe(2);
      expect(await readFile(join(cwd, 'out', 'exported.md'), 'utf8')).toBe(markdown);
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('reports local room status with a stable schema', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'mdroom-cli-'));
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

      expect(status.schema).toBe('mdroom.status.result.v1');
      expect(status.metadata.found).toBe(true);
      expect(status.document?.bytes).toBe(Buffer.byteLength('status text', 'utf8'));
      expect(status.server.checked).toBe(true);
      expect(status.server.recordCount).toBe(2);
      expect(status.room.serverRoomUrl).not.toContain('#key=');
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('finds local metadata by room URL when the server has a base path', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'mdroom-cli-'));
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
      expect(status.server.recordCount).toBe(2);
      expect(exported.document.markdown).toBe(markdown);
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('submits encrypted whole-document patch suggestions as proposals without changing export', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'mdroom-cli-'));
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

      expect(patch.schema).toBe('mdroom.patch.result.v1');
      expect(patch.mode).toBe('suggestion');
      expect(patch.server.recordCount).toBe(4);
      expect(patch.base.sha256).toBe(published.document.sha256);
      expect(patch.proposed.bytes).toBe(Buffer.byteLength(proposed, 'utf8'));
      expect(exported.document.markdown).toBe(original);

      const serverStorage = server.store.serialized(published.room.roomId);
      expect(serverStorage).not.toContain(original);
      expect(serverStorage).not.toContain(proposed);
      const proposalRecord = server.store.list(published.room.roomId)[2];
      expect(proposalRecord?.senderId).toContain('mdroom-cli:proposal');
      const proposals = await listProposals({ cwd, room: published.room.url });
      expect(proposals.proposals).toHaveLength(1);
      expect(proposals.proposals[0]?.title).toBe('Update body copy');
      expect(proposals.proposals[0]?.status).toBe('pending');
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('lists, shows, accepts, and rejects encrypted proposal records by replaying events', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'mdroom-cli-'));
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

      expect(accepted.schema).toBe('mdroom.accept.result.v1');
      expect(accepted.proposal.status).toBe('accepted');
      expect(rejected.schema).toBe('mdroom.reject.result.v1');
      expect(rejected.proposal.status).toBe('rejected');
      expect(proposals.proposals.map((proposal) => proposal.status)).toEqual(['accepted', 'rejected']);
      expect(exported.document.markdown).toBe(acceptedMarkdown);

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
});
