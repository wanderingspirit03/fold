import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultMetadataPath, readRoomMetadata } from '../rooms/metadata.js';
import { exportMarkdown, publishMarkdown, roomStatus } from './operations.js';

describe('CLI operations', () => {
  it('publishes Markdown as encrypted local metadata by default', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'mdroom-cli-'));
    try {
      await writeFile(join(cwd, 'report.md'), '# Agent Report\n\nPrivate body.', 'utf8');

      const result = await publishMarkdown({
        cwd,
        filePath: 'report.md',
        serverUrl: 'https://rooms.example.test',
        save: true,
      });

      expect(result.schema).toBe('mdroom.publish.result.v1');
      expect(result.mode).toBe('local-token');
      expect(result.room.url).toContain('#key=');
      expect(result.room.serverRoomUrl).not.toContain('#key=');
      expect(result.metadata.saved).toBe(true);
      expect(result.document.canonical).toBe('y.text:markdown');

      const rawMetadata = await readFile(defaultMetadataPath(cwd), 'utf8');
      expect(rawMetadata).not.toContain('Private body.');
      const metadata = await readRoomMetadata(defaultMetadataPath(cwd));
      expect(metadata.rooms).toHaveLength(1);
      expect(metadata.rooms[0]?.encryptedSnapshot.format).toBe('encrypted-yjs-update-v1');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('does not write metadata when --no-save behavior is requested', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'mdroom-cli-'));
    try {
      await writeFile(join(cwd, 'draft.md'), 'unsaved draft', 'utf8');

      const result = await publishMarkdown({
        cwd,
        filePath: 'draft.md',
        save: false,
      });

      expect(result.metadata.saved).toBe(false);
      await expect(readFile(defaultMetadataPath(cwd), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('exports Markdown by decrypting the saved Y.Text snapshot locally', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'mdroom-cli-'));
    try {
      const markdown = '# Export Me\n\n- from encrypted local metadata';
      await writeFile(join(cwd, 'export-me.md'), markdown, 'utf8');
      const published = await publishMarkdown({
        cwd,
        filePath: 'export-me.md',
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
      expect(await readFile(join(cwd, 'out', 'exported.md'), 'utf8')).toBe(markdown);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('reports local room status with a stable schema', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'mdroom-cli-'));
    try {
      await mkdir(join(cwd, 'nested'));
      await writeFile(join(cwd, 'nested', 'status.md'), 'status text', 'utf8');
      const published = await publishMarkdown({
        cwd,
        filePath: 'nested/status.md',
        save: true,
      });

      const status = await roomStatus({
        cwd,
        room: published.room.url,
      });

      expect(status.schema).toBe('mdroom.status.result.v1');
      expect(status.metadata.found).toBe(true);
      expect(status.document?.bytes).toBe(Buffer.byteLength('status text', 'utf8'));
      expect(status.server.checked).toBe(false);
      expect(status.room.serverRoomUrl).not.toContain('#key=');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('finds local metadata by room URL when the server has a base path', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'mdroom-cli-'));
    try {
      const markdown = '# Base Path Room\n\nURL lookup should preserve the server prefix.';
      await writeFile(join(cwd, 'base-path.md'), markdown, 'utf8');
      const published = await publishMarkdown({
        cwd,
        filePath: 'base-path.md',
        serverUrl: 'https://rooms.example.test/base',
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
      expect(exported.document.markdown).toBe(markdown);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
