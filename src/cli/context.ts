import type { CommandContext } from '@stricli/core';

export interface FoldCommandContext extends CommandContext {
  cwd: string;
  commandPrefix?: string;
}
