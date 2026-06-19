import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EncryptedAppendLogServer } from '../../spikes/e2ee-yjs-append-log/server.js';
import { runFoldCli } from './app.js';

describe('fold CLI app', () => {
  it('prints publish JSON through the Stricli route', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-cli-app-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    const output = buildOutputCapture();

    try {
      await writeFile(join(cwd, 'cli.md'), '# CLI JSON', 'utf8');
      await runFoldCli(['publish', 'cli.md', '--server', serverUrl, '--json'], {
        process: {
          stdout: { write: output.stdout.write },
          stderr: { write: output.stderr.write },
        },
        cwd,
      });

      expect(output.stderr.value).toBe('');
      const result = JSON.parse(output.stdout.value) as { schema?: string; room?: { serverRoomUrl?: string; url?: string } };
      expect(result.schema).toBe('fold.publish.result.v1');
      expect(result.room?.url).toContain('#key=');
      expect(result.room?.serverRoomUrl).not.toContain('#key=');
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('prints invite next steps after publishing for a fresh agent-created room', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-cli-app-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    const output = buildOutputCapture();

    try {
      await writeFile(join(cwd, 'plan.md'), '# Agent Created Room', 'utf8');
      await runFoldCli(['publish', 'plan.md', '--server', serverUrl, '--alias', 'launch'], {
        process: {
          stdout: { write: output.stdout.write },
          stderr: { write: output.stderr.write },
        },
        cwd,
      });

      expect(output.stderr.value).toBe('');
      expect(output.stdout.value).toContain('✓ Published encrypted Markdown room');
      expect(output.stdout.value).toContain('→ Invite a human: fold room invite "launch" --for human');
      expect(output.stdout.value).toContain('→ Invite an agent: fold room invite "launch" --for agent');
      expect(output.stdout.value).toContain('→ Export for local work: fold export --room "launch" --output ./fold-project');
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('creates an empty room through the room create route', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-cli-app-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    const output = buildOutputCapture();

    try {
      await runFoldCli(['room', 'create', '--alias', 'empty', '--server', serverUrl], {
        process: {
          stdout: { write: output.stdout.write },
          stderr: { write: output.stderr.write },
        },
        cwd,
      });

      expect(output.stderr.value).toBe('');
      expect(output.stdout.value).toContain('✓ Created encrypted Fold room');
      expect(output.stdout.value).toContain('→ Saved alias: empty');
      expect(output.stdout.value).toContain('→ Invite a human: fold room invite "empty" --for human');
      expect(output.stdout.value).toContain('→ Invite an agent: fold room invite "empty" --for agent');
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('prints patch JSON through the Stricli route', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-cli-app-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    const publishOutput = buildOutputCapture();
    const patchOutput = buildOutputCapture();

    try {
      await writeFile(join(cwd, 'base.md'), '# Base', 'utf8');
      await writeFile(join(cwd, 'proposal.md'), '# Proposal', 'utf8');
      await runFoldCli(['publish', 'base.md', '--server', serverUrl, '--json'], {
        process: {
          stdout: { write: publishOutput.stdout.write },
          stderr: { write: publishOutput.stderr.write },
        },
        cwd,
      });
      const published = JSON.parse(publishOutput.stdout.value) as { room?: { url?: string } };

      await runFoldCli(['patch', 'proposal.md', '--room', published.room?.url ?? '', '--json'], {
        process: {
          stdout: { write: patchOutput.stdout.write },
          stderr: { write: patchOutput.stderr.write },
        },
        cwd,
      });

      expect(patchOutput.stderr.value).toBe('');
      const result = JSON.parse(patchOutput.stdout.value) as { schema?: string; mode?: string };
      expect(result.schema).toBe('fold.patch.result.v1');
      expect(result.mode).toBe('suggestion');
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('prints post JSON through the Stricli route for fresh files', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-cli-app-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    const publishOutput = buildOutputCapture();
    const postOutput = buildOutputCapture();

    try {
      await writeFile(join(cwd, 'README.md'), '# Base', 'utf8');
      await writeFile(join(cwd, 'ABOUT.md'), '# About', 'utf8');
      await runFoldCli(['publish', 'README.md', '--server', serverUrl, '--alias', 'launch', '--json'], {
        process: {
          stdout: { write: publishOutput.stdout.write },
          stderr: { write: publishOutput.stderr.write },
        },
        cwd,
      });

      await runFoldCli(['post', 'ABOUT.md', '--room', 'launch', '--path', 'ABOUT.md', '--json'], {
        process: {
          stdout: { write: postOutput.stdout.write },
          stderr: { write: postOutput.stderr.write },
        },
        cwd,
      });

      expect(postOutput.stderr.value).toBe('');
      const result = JSON.parse(postOutput.stdout.value) as { schema?: string; mode?: string; room?: { url?: string; token?: string } };
      expect(result.schema).toBe('fold.post.result.v1');
      expect(result.mode).toBe('accepted-file');
      expect(result.room?.url).toBeUndefined();
      expect(result.room?.token).toBeUndefined();
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('routes resume JSON through the Stricli route', async () => {
    const ownerCwd = await mkdtemp(join(tmpdir(), 'fold-cli-app-owner-'));
    const agentCwd = await mkdtemp(join(tmpdir(), 'fold-cli-app-agent-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();
    const publishOutput = buildOutputCapture();
    const resumeOutput = buildOutputCapture();

    try {
      await writeFile(join(ownerCwd, 'base.md'), '# Resume Route', 'utf8');
      await runFoldCli(['publish', 'base.md', '--server', serverUrl, '--json'], {
        process: {
          stdout: { write: publishOutput.stdout.write },
          stderr: { write: publishOutput.stderr.write },
        },
        cwd: ownerCwd,
      });
      const published = JSON.parse(publishOutput.stdout.value) as { room?: { token?: string } };

      await runFoldCli([
        'resume',
        '--room',
        published.room?.token ?? '',
        '--alias',
        'launch',
        '--output',
        'fold-project',
        '--json',
      ], {
        process: {
          stdout: { write: resumeOutput.stdout.write },
          stderr: { write: resumeOutput.stderr.write },
        },
        cwd: agentCwd,
      });

      expect(resumeOutput.stderr.value).toBe('');
      const result = JSON.parse(resumeOutput.stdout.value) as {
        schema?: string;
        metadata?: { alias?: string; imported?: boolean };
        nextCommands?: { propose?: string };
      };
      expect(result.schema).toBe('fold.resume.result.v1');
      expect(result.metadata?.alias).toBe('launch');
      expect(result.metadata?.imported).toBe(true);
      expect(result.nextCommands?.propose).toContain('--room "launch"');
      expect(resumeOutput.stdout.value).not.toContain('fold:v1:');
      expect(resumeOutput.stdout.value).not.toContain('#key=');
    } finally {
      await server.stop();
      await rm(ownerCwd, { recursive: true, force: true });
      await rm(agentCwd, { recursive: true, force: true });
    }
  });

  it('routes proposal list/show/accept/reject commands with kebab-case names', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-cli-app-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();

    try {
      await writeFile(join(cwd, 'base.md'), '# Base', 'utf8');
      await writeFile(join(cwd, 'proposal.md'), '# Proposal', 'utf8');
      await writeFile(join(cwd, 'reject.md'), '# Rejected', 'utf8');

      const publishOutput = buildOutputCapture();
      await runFoldCli(['publish', 'base.md', '--server', serverUrl, '--json'], {
        process: {
          stdout: { write: publishOutput.stdout.write },
          stderr: { write: publishOutput.stderr.write },
        },
        cwd,
      });
      const published = JSON.parse(publishOutput.stdout.value) as { room?: { url?: string } };
      const room = published.room?.url ?? '';

      const proposeOutput = buildOutputCapture();
      await runFoldCli(['propose', 'proposal.md', '--room', room, '--title', 'Use proposal', '--json'], {
        process: {
          stdout: { write: proposeOutput.stdout.write },
          stderr: { write: proposeOutput.stderr.write },
        },
        cwd,
      });
      const proposed = JSON.parse(proposeOutput.stdout.value) as { proposal?: { id?: string } };

      const rejectOutput = buildOutputCapture();
      await runFoldCli(['propose', 'reject.md', '--room', room, '--title', 'Reject proposal', '--json'], {
        process: {
          stdout: { write: rejectOutput.stdout.write },
          stderr: { write: rejectOutput.stderr.write },
        },
        cwd,
      });
      const rejectCandidate = JSON.parse(rejectOutput.stdout.value) as { proposal?: { id?: string } };

      const listOutput = buildOutputCapture();
      await runFoldCli(['proposals', '--room', room, '--json'], {
        process: {
          stdout: { write: listOutput.stdout.write },
          stderr: { write: listOutput.stderr.write },
        },
        cwd,
      });
      const listed = JSON.parse(listOutput.stdout.value) as { proposals?: unknown[] };
      expect(listed.proposals).toHaveLength(2);

      const showOutput = buildOutputCapture();
      await runFoldCli(['show-proposal', proposed.proposal?.id ?? '', '--room', room, '--json'], {
        process: {
          stdout: { write: showOutput.stdout.write },
          stderr: { write: showOutput.stderr.write },
        },
        cwd,
      });
      const shown = JSON.parse(showOutput.stdout.value) as { schema?: string; proposal?: { proposed?: { markdown?: string } } };
      expect(shown.schema).toBe('fold.show-proposal.result.v1');
      expect(shown.proposal?.proposed?.markdown).toBe('# Proposal');

      const acceptOutput = buildOutputCapture();
      await runFoldCli(['accept', proposed.proposal?.id ?? '', '--room', room, '--json'], {
        process: {
          stdout: { write: acceptOutput.stdout.write },
          stderr: { write: acceptOutput.stderr.write },
        },
        cwd,
      });
      const accepted = JSON.parse(acceptOutput.stdout.value) as { schema?: string; proposal?: { status?: string } };
      expect(accepted.schema).toBe('fold.accept.result.v1');
      expect(accepted.proposal?.status).toBe('accepted');

      const finalRejectOutput = buildOutputCapture();
      await runFoldCli(['reject', rejectCandidate.proposal?.id ?? '', '--room', room, '--json'], {
        process: {
          stdout: { write: finalRejectOutput.stdout.write },
          stderr: { write: finalRejectOutput.stderr.write },
        },
        cwd,
      });
      const rejected = JSON.parse(finalRejectOutput.stdout.value) as { schema?: string; proposal?: { status?: string } };
      expect(rejected.schema).toBe('fold.reject.result.v1');
      expect(rejected.proposal?.status).toBe('rejected');
    } finally {
      await server.stop();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('routes encrypted request queues for agent replies', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fold-cli-app-'));
    const server = new EncryptedAppendLogServer();
    const serverUrl = await server.start();

    try {
      await writeFile(join(cwd, 'brief.md'), '# Brief\n\nAgent handoff target.', 'utf8');
      const publishOutput = buildOutputCapture();
      await runFoldCli(['publish', 'brief.md', '--server', serverUrl, '--json'], {
        process: {
          stdout: { write: publishOutput.stdout.write },
          stderr: { write: publishOutput.stderr.write },
        },
        cwd,
      });
      const published = JSON.parse(publishOutput.stdout.value) as { room?: { url?: string } };
      const room = published.room?.url ?? '';

      const addOutput = buildOutputCapture();
      await runFoldCli([
        'comment',
        '--room',
        room,
        '--path',
        'brief.md',
        '--quote',
        'Agent handoff target',
        '--type',
        'request',
        '--text',
        'Please answer this request.',
        '--json',
      ], {
        process: {
          stdout: { write: addOutput.stdout.write },
          stderr: { write: addOutput.stderr.write },
        },
        cwd,
      });
      const added = JSON.parse(addOutput.stdout.value) as { comment?: { id?: string; type?: string } };

      const requestsOutput = buildOutputCapture();
      await runFoldCli(['requests', '--room', room, '--json'], {
        process: {
          stdout: { write: requestsOutput.stdout.write },
          stderr: { write: requestsOutput.stderr.write },
        },
        cwd,
      });
      const requests = JSON.parse(requestsOutput.stdout.value) as {
        filters?: { type?: string; open?: boolean };
        comments?: Array<{ id?: string; type?: string }>;
      };

      const replyOutput = buildOutputCapture();
      await runFoldCli(['reply', added.comment?.id ?? '', '--room', room, '--text', 'Answering from the agent loop.', '--json'], {
        process: {
          stdout: { write: replyOutput.stdout.write },
          stderr: { write: replyOutput.stderr.write },
        },
        cwd,
      });
      const reply = JSON.parse(replyOutput.stdout.value) as { comment?: { type?: string; replies?: unknown[] } };

      expect(addOutput.stderr.value).toBe('');
      expect(requestsOutput.stderr.value).toBe('');
      expect(replyOutput.stderr.value).toBe('');
      expect(added.comment?.type).toBe('request');
      expect(requests.filters).toEqual({ type: 'request', open: true, path: null });
      expect(requests.comments?.map((comment) => ({ id: comment.id, type: comment.type }))).toEqual([
        { id: added.comment?.id, type: 'request' },
      ]);
      expect(reply.comment?.type).toBe('request');
      expect(reply.comment?.replies).toHaveLength(1);
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
