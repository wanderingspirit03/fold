import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface MarkdownSample {
  name: string;
  path: string;
  markdown: string;
}

const sampleNames = [
  'agent-plan.md',
  'code-report.md',
  'rich-agent-output.md',
] as const;

export async function loadMarkdownSamples(): Promise<MarkdownSample[]> {
  return Promise.all(sampleNames.map(async (name) => {
    const path = join('spikes/document-model/samples', name);
    return {
      name,
      path,
      markdown: await readFile(path, 'utf8'),
    };
  }));
}

export function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

