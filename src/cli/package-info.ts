import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FOLD_AGENT_PACKAGE_NAME = 'fold-agent';
export const FOLD_AGENT_VERSION = '0.1.0';
export const DEFAULT_FOLD_AGENT_COMMAND_PREFIX = `npx --yes ${FOLD_AGENT_PACKAGE_NAME}@${FOLD_AGENT_VERSION}`;

export function foldAgentPackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../..');
}

export function foldAgentBundledSkillPath(): string {
  return resolve(foldAgentPackageRoot(), 'skills/fold');
}
