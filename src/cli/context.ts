import type { CommandContext } from '@stricli/core';

export interface MdroomCommandContext extends CommandContext {
  cwd: string;
}
