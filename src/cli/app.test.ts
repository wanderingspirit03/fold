import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runMdroomCli } from './app.js';

describe('mdroom CLI app', () => {
  it('prints publish JSON through the Stricli route', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'mdroom-cli-app-'));
    const output = buildOutputCapture();

    try {
      await writeFile(join(cwd, 'cli.md'), '# CLI JSON', 'utf8');
      await runMdroomCli(['publish', 'cli.md', '--json'], {
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
