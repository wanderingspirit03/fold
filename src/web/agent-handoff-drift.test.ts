import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const EXPECTED_SKILL_INSTALL = 'gh skill install wanderingspirit03/fold packages/fold-skills/skills/fold@<tag-or-sha>';
const STALE_SKILL_INSTALL = 'gh skill install wanderingspirit03/fold fold@<tag-or-sha>';

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
      readFile('packages/fold-skills/skills/fold/SKILL.md', 'utf8'),
      readFile('skills/fold/references/cli.md', 'utf8'),
      readFile('packages/fold-skills/skills/fold/references/cli.md', 'utf8'),
    ]);

    for (const content of [cliInvite, webInvite, publicSkill, rootCliReference, packagedCliReference]) {
      expect(content).toContain(EXPECTED_SKILL_INSTALL);
      expect(content).not.toContain(STALE_SKILL_INSTALL);
    }
    for (const content of [cliInvite, webInvite, publicSkill, rootSkill, packagedSkill]) {
      expect(content).toContain('fold post');
    }
    expect(cliInvite).toContain('Skill installation does not install the Fold CLI.');
    expect(webInvite).toContain('Skill installation does not install the Fold CLI.');
    expect(publicSkill).toContain('Installing the Fold skill package does not install the CLI.');
  });
});
