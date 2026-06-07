import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EncryptedAppendLogServer } from '../../spikes/e2ee-yjs-append-log/server.js';
import { runMdroomCli } from './app.js';

describe('mdroom CLI app', () => {
  it('prints publish JSON through the Stricli route', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'mdroom-cli-app-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    const output = buildOutputCapture();

    try {
      await writeFile(join(cwd, 'cli.md'), '# CLI JSON', 'utf8');
      await runMdroomCli(['publish', 'cli.md', '--server', serverUrl, '--json'], {
        process: {
          stdout: { write: output.stdout.write },
          stderr: { write: output.stderr.write },
        },
        cwd,
      });

      expect(output.stderr.value).toBe('');
      const result = JSON.parse(output.stdout.value) as { schema?: string; room?: { serverRoomUrl?: string; url?: string } };
      expect(result.schema).toBe('mdroom.publish.result.v1');
      expect(result.room?.url).toContain('#key=');
      expect(result.room?.serverRoomUrl).not.toContain('#key=');
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('prints patch JSON through the Stricli route', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'mdroom-cli-app-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    const publishOutput = buildOutputCapture();
    const patchOutput = buildOutputCapture();

    try {
      await writeFile(join(cwd, 'base.md'), '# Base', 'utf8');
      await writeFile(join(cwd, 'proposal.md'), '# Proposal', 'utf8');
      await runMdroomCli(['publish', 'base.md', '--server', serverUrl, '--json'], {
        process: {
          stdout: { write: publishOutput.stdout.write },
          stderr: { write: publishOutput.stderr.write },
        },
        cwd,
      });
      const published = JSON.parse(publishOutput.stdout.value) as { room?: { url?: string } };

      await runMdroomCli(['patch', 'proposal.md', '--room', published.room?.url ?? '', '--json'], {
        process: {
          stdout: { write: patchOutput.stdout.write },
          stderr: { write: patchOutput.stderr.write },
        },
        cwd,
      });

      expect(patchOutput.stderr.value).toBe('');
      const result = JSON.parse(patchOutput.stdout.value) as { schema?: string; mode?: string };
      expect(result.schema).toBe('mdroom.patch.result.v1');
      expect(result.mode).toBe('suggestion');
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('routes proposal list/show/accept/reject commands with kebab-case names', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'mdroom-cli-app-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();

    try {
      await writeFile(join(cwd, 'base.md'), '# Base', 'utf8');
      await writeFile(join(cwd, 'proposal.md'), '# Proposal', 'utf8');
      await writeFile(join(cwd, 'reject.md'), '# Rejected', 'utf8');

      const publishOutput = buildOutputCapture();
      await runMdroomCli(['publish', 'base.md', '--server', serverUrl, '--json'], {
        process: {
          stdout: { write: publishOutput.stdout.write },
          stderr: { write: publishOutput.stderr.write },
        },
        cwd,
      });
      const published = JSON.parse(publishOutput.stdout.value) as { room?: { url?: string } };
      const room = published.room?.url ?? '';

      const proposeOutput = buildOutputCapture();
      await runMdroomCli(['propose', 'proposal.md', '--room', room, '--title', 'Use proposal', '--json'], {
        process: {
          stdout: { write: proposeOutput.stdout.write },
          stderr: { write: proposeOutput.stderr.write },
        },
        cwd,
      });
      const proposed = JSON.parse(proposeOutput.stdout.value) as { proposal?: { id?: string } };

      const rejectOutput = buildOutputCapture();
      await runMdroomCli(['propose', 'reject.md', '--room', room, '--title', 'Reject proposal', '--json'], {
        process: {
          stdout: { write: rejectOutput.stdout.write },
          stderr: { write: rejectOutput.stderr.write },
        },
        cwd,
      });
      const rejectCandidate = JSON.parse(rejectOutput.stdout.value) as { proposal?: { id?: string } };

      const listOutput = buildOutputCapture();
      await runMdroomCli(['proposals', '--room', room, '--json'], {
        process: {
          stdout: { write: listOutput.stdout.write },
          stderr: { write: listOutput.stderr.write },
        },
        cwd,
      });
      const listed = JSON.parse(listOutput.stdout.value) as { proposals?: unknown[] };
      expect(listed.proposals).toHaveLength(2);

      const showOutput = buildOutputCapture();
      await runMdroomCli(['show-proposal', proposed.proposal?.id ?? '', '--room', room, '--json'], {
        process: {
          stdout: { write: showOutput.stdout.write },
          stderr: { write: showOutput.stderr.write },
        },
        cwd,
      });
      const shown = JSON.parse(showOutput.stdout.value) as { schema?: string; proposal?: { proposed?: { markdown?: string } } };
      expect(shown.schema).toBe('mdroom.show-proposal.result.v1');
      expect(shown.proposal?.proposed?.markdown).toBe('# Proposal');

      const acceptOutput = buildOutputCapture();
      await runMdroomCli(['accept', proposed.proposal?.id ?? '', '--room', room, '--json'], {
        process: {
          stdout: { write: acceptOutput.stdout.write },
          stderr: { write: acceptOutput.stderr.write },
        },
        cwd,
      });
      const accepted = JSON.parse(acceptOutput.stdout.value) as { schema?: string; proposal?: { status?: string } };
      expect(accepted.schema).toBe('mdroom.accept.result.v1');
      expect(accepted.proposal?.status).toBe('accepted');

      const finalRejectOutput = buildOutputCapture();
      await runMdroomCli(['reject', rejectCandidate.proposal?.id ?? '', '--room', room, '--json'], {
        process: {
          stdout: { write: finalRejectOutput.stdout.write },
          stderr: { write: finalRejectOutput.stderr.write },
        },
        cwd,
      });
      const rejected = JSON.parse(finalRejectOutput.stdout.value) as { schema?: string; proposal?: { status?: string } };
      expect(rejected.schema).toBe('mdroom.reject.result.v1');
      expect(rejected.proposal?.status).toBe('rejected');
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

function buildOutputCapture(): {
  stdout: { value: string; write: (str: string) => void };
  stderr: { value: string; write: (str: string) => void };
} {
  const stdout = {
    value: '',
    write(str: string) {
      stdout.value += str;
    },
  };
  const stderr = {
    value: '',
    write(str: string) {
      stderr.value += str;
    },
  };

  return { stdout, stderr };
}
