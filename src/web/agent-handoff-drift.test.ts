import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const EXPECTED_BOOTSTRAP = 'npx --yes fold-agent@0.1.2 bootstrap';
const STALE_SKILL_PACKAGE = 'packages/fold-skills';

describe('agent handoff copy drift', () => {
  it('keeps CLI, web, and public skill handoffs aligned on bootstrap policy', async () => {
    const [
      cliInvite,
      webInvite,
      publicSkill,
      rootSkill,
      packagedSkill,
      rootCliReference,
      packagedCliReference,
    ] = await Promise.all([
      readFile('src/cli/operations.ts', 'utf8'),
      readFile('apps/web/app/room/[roomId]/page.tsx', 'utf8'),
      readFile('apps/web/public/.well-known/fold/agent-skill.md', 'utf8'),
      readFile('skills/fold/SKILL.md', 'utf8'),
      readFile('packages/fold-agent/skills/fold/SKILL.md', 'utf8'),
      readFile('skills/fold/references/cli.md', 'utf8'),
      readFile('packages/fold-agent/skills/fold/references/cli.md', 'utf8'),
    ]);

    for (const content of [publicSkill, rootCliReference, packagedCliReference]) {
      expect(content).toContain(EXPECTED_BOOTSTRAP);
      expect(content).not.toContain(STALE_SKILL_PACKAGE);
    }
    expect(cliInvite).toContain('DEFAULT_FOLD_AGENT_COMMAND_PREFIX');
    expect(cliInvite).toContain('bootstrap --room');
    expect(cliInvite).not.toContain(STALE_SKILL_PACKAGE);
    expect(webInvite).toContain('FOLD_AGENT_COMMAND_PREFIX');
    expect(webInvite).toContain('bootstrap --room');
    expect(webInvite).not.toContain(STALE_SKILL_PACKAGE);
    expect(packagedSkill).toBe(rootSkill);
    expect(packagedCliReference).toBe(rootCliReference);
    for (const content of [cliInvite, webInvite, publicSkill, rootSkill, packagedSkill]) {
      expect(content).toContain('fold-agent');
      expect(content).toContain('post');
    }
    expect(cliInvite).toContain('Do not use /usr/bin/fold.');
    expect(webInvite).toContain('Do not use /usr/bin/fold.');
    expect(publicSkill).toContain('Do not use `/usr/bin/fold`.');
  });
});
