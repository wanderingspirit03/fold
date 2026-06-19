import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { FOLD_AGENT_PACKAGE_NAME, FOLD_AGENT_VERSION, foldAgentBundledSkillPath } from './package-info.js';
import type { SkillInstallResult, SkillInstallScope, SkillInstallTargetResult } from './results.js';

type TargetReason =
  | 'same_version'
  | 'unmanaged_existing'
  | 'newer_managed'
  | 'modified_existing'
  | 'target_unavailable'
  | 'permission_denied';

type Target = {
  path: string;
  host: 'agents' | 'codex';
  autoLoadKnown: boolean;
};

const MANIFEST_FILE = '.fold-skill-manifest.json';
const VERSION_FILE = '.fold-skill-version';

export interface InstallFoldSkillOptions {
  cwd: string;
  scope: SkillInstallScope;
  mode: 'install' | 'status' | 'update';
}

export async function installFoldSkill(options: InstallFoldSkillOptions): Promise<SkillInstallResult> {
  const sourcePath = foldAgentBundledSkillPath();
  const targets = skillTargets(options.cwd, options.scope);
  const sourceManifest = await buildManifest(sourcePath);
  const installed: SkillInstallTargetResult[] = [];
  const updated: SkillInstallTargetResult[] = [];
  const skipped: SkillInstallTargetResult[] = [];

  for (const target of targets) {
    const outcome = await inspectTarget(target, sourceManifest);
    if (outcome.action === 'skip') {
      skipped.push({
        path: target.path,
        version: outcome.version,
        host: target.host,
        autoLoadKnown: target.autoLoadKnown,
        reason: outcome.reason,
      });
      continue;
    }

    if (options.mode === 'status') {
      skipped.push({
        path: target.path,
        version: outcome.version,
        host: target.host,
        autoLoadKnown: target.autoLoadKnown,
        reason: outcome.action === 'install' ? 'target_unavailable' : 'same_version',
      });
      continue;
    }

    await replaceSkillDirectory(sourcePath, target.path, sourceManifest);
    const targetResult = {
      path: target.path,
      version: FOLD_AGENT_VERSION,
      host: target.host,
      autoLoadKnown: target.autoLoadKnown,
    };
    if (outcome.action === 'install') installed.push(targetResult);
    else updated.push(targetResult);
  }

  return {
    schema: 'fold.skill.result.v1',
    ok: true,
    package: {
      name: FOLD_AGENT_PACKAGE_NAME,
      version: FOLD_AGENT_VERSION,
    },
    scope: options.scope,
    installed,
    updated,
    skipped,
  };
}

function skillTargets(cwd: string, scope: SkillInstallScope): Target[] {
  const home = process.env.HOME;
  const targets: Target[] = [];
  if (scope === 'project' || scope === 'all') {
    targets.push({
      path: resolve(cwd, '.agents/skills/fold'),
      host: 'agents',
      autoLoadKnown: false,
    });
  }
  if ((scope === 'global' || scope === 'all') && home) {
    targets.push({
      path: resolve(home, '.agents/skills/fold'),
      host: 'agents',
      autoLoadKnown: false,
    });
    targets.push({
      path: resolve(home, '.codex/skills/fold'),
      host: 'codex',
      autoLoadKnown: true,
    });
  }
  return targets;
}

async function inspectTarget(target: Target, sourceManifest: ManagedManifest): Promise<
  | { action: 'install'; version: string }
  | { action: 'update'; version: string }
  | { action: 'skip'; version: string; reason: TargetReason }
> {
  try {
    await stat(target.path);
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return { action: 'install', version: FOLD_AGENT_VERSION };
    if (isNodeError(error, 'EACCES') || isNodeError(error, 'EPERM')) {
      return { action: 'skip', version: FOLD_AGENT_VERSION, reason: 'permission_denied' };
    }
    return { action: 'skip', version: FOLD_AGENT_VERSION, reason: 'target_unavailable' };
  }

  const manifest = await readManagedManifest(target.path);
  if (!manifest) {
    return { action: 'skip', version: 'unknown', reason: 'unmanaged_existing' };
  }

  if (compareSemver(manifest.version, FOLD_AGENT_VERSION) > 0) {
    return { action: 'skip', version: manifest.version, reason: 'newer_managed' };
  }

  const currentManifest = await buildManifest(target.path, { ignoreManagedFiles: true });
  if (manifest.contentHash !== currentManifest.contentHash) {
    return { action: 'skip', version: manifest.version, reason: 'modified_existing' };
  }

  if (manifest.version === FOLD_AGENT_VERSION && manifest.contentHash === sourceManifest.contentHash) {
    return { action: 'skip', version: manifest.version, reason: 'same_version' };
  }

  return { action: 'update', version: manifest.version };
}

async function replaceSkillDirectory(sourcePath: string, targetPath: string, manifest: ManagedManifest): Promise<void> {
  await mkdir(dirname(targetPath), { recursive: true });
  const parent = dirname(targetPath);
  const unique = `${process.pid}-${Date.now()}-${basename(targetPath)}`;
  const tempPath = join(parent, `.fold-skill-${unique}.tmp`);
  const backupPath = join(parent, `.fold-skill-${unique}.backup`);
  await rm(tempPath, { force: true, recursive: true });
  await rm(backupPath, { force: true, recursive: true });
  await cp(sourcePath, tempPath, { recursive: true });
  await writeFile(join(tempPath, VERSION_FILE), `${FOLD_AGENT_VERSION}\n`, 'utf8');
  await writeFile(join(tempPath, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const hadTarget = await exists(targetPath);
  try {
    if (hadTarget) await rename(targetPath, backupPath);
    await rename(tempPath, targetPath);
    await rm(backupPath, { force: true, recursive: true });
  } catch (error) {
    await rm(tempPath, { force: true, recursive: true });
    if (hadTarget && await exists(backupPath) && !(await exists(targetPath))) {
      await rename(backupPath, targetPath);
    }
    throw error;
  }
}

type ManagedManifest = {
  package: 'fold-agent';
  version: string;
  contentHash: string;
  files: Array<{ path: string; sha256: string }>;
};

async function buildManifest(root: string, options: { ignoreManagedFiles?: boolean } = {}): Promise<ManagedManifest> {
  const files = await listFiles(root);
  const hashedFiles = [];
  for (const file of files) {
    if (options.ignoreManagedFiles && (file === MANIFEST_FILE || file === VERSION_FILE)) continue;
    const bytes = await readFile(join(root, file));
    hashedFiles.push({
      path: file,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  hashedFiles.sort((a, b) => a.path.localeCompare(b.path));
  const contentHash = createHash('sha256').update(JSON.stringify(hashedFiles)).digest('hex');
  return {
    package: 'fold-agent',
    version: FOLD_AGENT_VERSION,
    contentHash,
    files: hashedFiles,
  };
}

async function listFiles(root: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await listFiles(root, relative));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files;
}

async function readManagedManifest(targetPath: string): Promise<ManagedManifest | null> {
  try {
    const raw = await readFile(join(targetPath, MANIFEST_FILE), 'utf8');
    const parsed = JSON.parse(raw) as Partial<ManagedManifest>;
    if (parsed.package !== 'fold-agent' || typeof parsed.version !== 'string' || typeof parsed.contentHash !== 'string') {
      return null;
    }
    return parsed as ManagedManifest;
  } catch {
    return null;
  }
}

function isNodeError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return false;
    throw error;
  }
}

function compareSemver(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}
