import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import type { EncryptedUpdateRecord, IncomingEncryptedUpdate } from '../server/append-log.js';
import type { MarkdownDocumentSummary } from './markdown-snapshot.js';
import { summarizeMarkdown } from './markdown-snapshot.js';
import type { RoomAccess } from './room-reference.js';
import { decryptJsonRecord, encryptJsonRecord } from './encrypted-records.js';
import { assertContiguousRecords } from './append-log-validation.js';

export const PROJECT_SCHEMA = 'fold.project.v1';
export const PROJECT_UPDATE_SENDER_ID_PREFIX = 'fold-cli:project';
export const WEB_PROJECT_FILE_SENDER_ID_PREFIX = 'web-client:file';

export interface ProjectFile {
  path: string;
  markdown: string;
}

export interface ProjectSnapshot {
  schema: typeof PROJECT_SCHEMA;
  primaryPath: string;
  files: ProjectFile[];
  updatedAt: string;
}

interface WebProjectFileSnapshot {
  type: 'project_file_snapshot';
  path: string;
  markdown: string;
  updatedAt: string;
}

export interface ProjectSummary {
  canonical: 'project.markdown-files:v1';
  fileCount: number;
  bytes: number;
  sha256: string;
  primaryPath: string;
  files: Array<MarkdownDocumentSummary & { path: string }>;
}

export async function readMarkdownProject(cwd: string, sourcePath: string, roomPath?: string): Promise<ProjectSnapshot> {
  const absolute = resolve(cwd, sourcePath);
  const info = await stat(absolute);
  const files = info.isDirectory()
    ? await readMarkdownDirectory(absolute)
    : [{
      path: normalizeProjectPath(roomPath ?? defaultRoomPathForFile(sourcePath)),
      markdown: await readFile(absolute, 'utf8'),
    }];

  if (files.length === 0) {
    throw new Error(`No Markdown files found at ${sourcePath}`);
  }

  return normalizeProjectSnapshot({
    schema: PROJECT_SCHEMA,
    primaryPath: files[0]!.path,
    files,
    updatedAt: new Date().toISOString(),
  });
}

export async function writeMarkdownProject(
  cwd: string,
  outputPath: string,
  project: ProjectSnapshot,
  selectedPath?: string,
  options: { forceDirectory?: boolean } = {},
): Promise<string[]> {
  const output = resolve(cwd, outputPath);
  const files = selectedPath
    ? [projectFileOrThrow(project, selectedPath)]
    : project.files;

  if (selectedPath || (files.length === 1 && !options.forceDirectory)) {
    const target = selectedPath ? output : output;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, files[0]!.markdown, 'utf8');
    return [target];
  }

  const written: string[] = [];
  for (const file of files) {
    const target = resolve(output, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.markdown, 'utf8');
    written.push(target);
  }
  return written;
}

export function normalizeProjectSnapshot(snapshot: ProjectSnapshot): ProjectSnapshot {
  const byPath = new Map<string, ProjectFile>();
  for (const file of snapshot.files) {
    const path = normalizeProjectPath(file.path);
    if (!path.endsWith('.md')) {
      throw new Error(`Project file must be Markdown: ${file.path}`);
    }
    byPath.set(path, { path, markdown: file.markdown });
  }

  const files = [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
  const primaryPath = normalizeProjectPath(snapshot.primaryPath || files[0]?.path || 'document.md');
  return {
    schema: PROJECT_SCHEMA,
    primaryPath: files.some((file) => file.path === primaryPath) ? primaryPath : files[0]?.path ?? primaryPath,
    files,
    updatedAt: snapshot.updatedAt,
  };
}

export function singleFileProject(path: string, markdown: string): ProjectSnapshot {
  return normalizeProjectSnapshot({
    schema: PROJECT_SCHEMA,
    primaryPath: normalizeProjectPath(path),
    files: [{ path: normalizeProjectPath(path), markdown }],
    updatedAt: new Date().toISOString(),
  });
}

export function replaceProjectFile(project: ProjectSnapshot, path: string, markdown: string): ProjectSnapshot {
  const normalized = normalizeProjectSnapshot(project);
  const targetPath = normalizeProjectPath(path);
  const files = normalized.files.filter((file) => file.path !== targetPath);
  files.push({ path: targetPath, markdown });
  return normalizeProjectSnapshot({
    schema: PROJECT_SCHEMA,
    primaryPath: normalized.primaryPath || targetPath,
    files,
    updatedAt: new Date().toISOString(),
  });
}

export function addProjectFile(project: ProjectSnapshot, path: string, markdown: string): ProjectSnapshot {
  const normalized = normalizeProjectSnapshot(project);
  const targetPath = normalizeProjectPath(path);
  if (normalized.files.some((file) => file.path === targetPath)) {
    throw new Error(`Project file already exists: ${targetPath}`);
  }
  return normalizeProjectSnapshot({
    schema: PROJECT_SCHEMA,
    primaryPath: normalized.primaryPath,
    files: [
      ...normalized.files,
      { path: targetPath, markdown },
    ],
    updatedAt: new Date().toISOString(),
  });
}

export function projectFileOrThrow(project: ProjectSnapshot, path: string): ProjectFile {
  const normalized = normalizeProjectPath(path);
  const file = project.files.find((candidate) => candidate.path === normalized);
  if (!file) throw new Error(`Project file not found: ${normalized}`);
  return file;
}

export function summarizeProject(project: ProjectSnapshot): ProjectSummary {
  const normalized = normalizeProjectSnapshot(project);
  const encoded = JSON.stringify(normalized.files.map((file) => [file.path, file.markdown]));
  const files = normalized.files.map((file) => ({
    path: file.path,
    ...summarizeMarkdown(file.markdown),
  }));
  return {
    canonical: 'project.markdown-files:v1',
    fileCount: files.length,
    bytes: files.reduce((total, file) => total + file.bytes, 0),
    sha256: createHash('sha256').update(encoded).digest('hex'),
    primaryPath: normalized.primaryPath,
    files,
  };
}

export async function createEncryptedProjectSnapshot(
  access: RoomAccess,
  project: ProjectSnapshot,
): Promise<IncomingEncryptedUpdate> {
  return encryptJsonRecord(
    access,
    `${PROJECT_UPDATE_SENDER_ID_PREFIX}:${Date.now()}`,
    normalizeProjectSnapshot(project),
  );
}

export async function decryptProjectSnapshotsFromRecords(
  access: RoomAccess,
  records: EncryptedUpdateRecord[],
): Promise<ProjectSnapshot[]> {
  assertContiguousRecords(records, access.roomId);
  const snapshots: ProjectSnapshot[] = [];
  const fileAppliedSeq = new Map<string, number>();
  let current: ProjectSnapshot | undefined;
  for (const record of records) {
    if (record.senderId.startsWith(PROJECT_UPDATE_SENDER_ID_PREFIX)) {
      const value = await decryptJsonRecord(access, record, record.senderId);
      if (!isProjectSnapshot(value)) {
        throw new Error('Invalid encrypted project snapshot payload');
      }
      current = normalizeProjectSnapshot(value);
      fileAppliedSeq.clear();
      for (const file of current.files) {
        fileAppliedSeq.set(file.path, record.seq);
      }
      snapshots.push(current);
      continue;
    }

    if (record.senderId.startsWith(WEB_PROJECT_FILE_SENDER_ID_PREFIX)) {
      const value = await decryptJsonRecord(access, record, record.senderId);
      if (!isWebProjectFileSnapshot(value)) {
        throw new Error('Invalid encrypted web project file snapshot payload');
      }
      const path = normalizeProjectPath(value.path);
      if (isStaleProjectFileSnapshotSeq(fileAppliedSeq.get(path), record.seq)) {
        continue;
      }
      current = replaceProjectFile(
        current ?? singleFileProject(value.path, value.markdown),
        path,
        value.markdown,
      );
      fileAppliedSeq.set(path, record.seq);
      current = normalizeProjectSnapshot({
        ...current,
        updatedAt: value.updatedAt,
      });
      snapshots.push(current);
    }
  }
  return snapshots;
}

export function normalizeProjectPath(input: string): string {
  const withoutLeadingSlash = input.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
  const segments = withoutLeadingSlash.split('/');
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === '..') ||
    /^[a-zA-Z]:/.test(segments[0] ?? '')
  ) {
    throw new Error(`Invalid project path: ${input}`);
  }
  const normalized = segments.filter((segment) => segment && segment !== '.').join('/');
  if (!normalized) {
    throw new Error(`Invalid project path: ${input}`);
  }
  return normalized;
}

async function readMarkdownDirectory(root: string): Promise<ProjectFile[]> {
  const files: ProjectFile[] = [];
  await walk(root, async (absolute) => {
    if (!absolute.toLowerCase().endsWith('.md')) return;
    files.push({
      path: normalizeProjectPath(relative(root, absolute).split(sep).join('/')),
      markdown: await readFile(absolute, 'utf8'),
    });
  });
  return files;
}

async function walk(directory: string, onFile: (path: string) => Promise<void>): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.fold') continue;
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(absolute, onFile);
    } else if (entry.isFile()) {
      await onFile(absolute);
    }
  }
}

function isProjectSnapshot(value: unknown): value is ProjectSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProjectSnapshot>;
  return (
    candidate.schema === PROJECT_SCHEMA &&
    typeof candidate.primaryPath === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    Array.isArray(candidate.files) &&
    candidate.files.every((file) => (
      file &&
      typeof file === 'object' &&
      typeof (file as Partial<ProjectFile>).path === 'string' &&
      typeof (file as Partial<ProjectFile>).markdown === 'string'
    ))
  );
}

function isWebProjectFileSnapshot(value: unknown): value is WebProjectFileSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WebProjectFileSnapshot>;
  return (
    candidate.type === 'project_file_snapshot' &&
    typeof candidate.path === 'string' &&
    typeof candidate.markdown === 'string' &&
    typeof candidate.updatedAt === 'string'
  );
}

export function isStaleProjectFileSnapshot(currentUpdatedAt: string | undefined, nextUpdatedAt: string): boolean {
  if (!currentUpdatedAt) return false;
  const currentTime = Date.parse(currentUpdatedAt);
  const nextTime = Date.parse(nextUpdatedAt);
  if (!Number.isNaN(currentTime) && !Number.isNaN(nextTime)) {
    return nextTime < currentTime;
  }
  return nextUpdatedAt < currentUpdatedAt;
}

export function isStaleProjectFileSnapshotSeq(currentSeq: number | undefined, nextSeq: number): boolean {
  return currentSeq !== undefined && nextSeq <= currentSeq;
}

function defaultRoomPathForFile(sourcePath: string): string {
  if (sourcePath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(sourcePath)) {
    return sourcePath.split(/[\\/]/).pop() ?? 'document.md';
  }
  return sourcePath;
}
