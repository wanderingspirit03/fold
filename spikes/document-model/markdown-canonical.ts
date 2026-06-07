import * as Y from "yjs";

export type MarkdownCanonicalFeature =
  | "frontmatter"
  | "taskLists"
  | "tables"
  | "fencedCode"
  | "mermaidFence"
  | "mathFence"
  | "inlineMath"
  | "links"
  | "images"
  | "inlineCode";

export class MarkdownCanonicalDocument {
  readonly doc = new Y.Doc();
  readonly ytext = this.doc.getText("markdown");

  constructor(markdown: string) {
    if (markdown.length > 0) {
      this.ytext.insert(0, markdown);
    }
  }

  get text(): string {
    return this.ytext.toString();
  }

  insert(index: number, value: string): void {
    this.ytext.insert(index, value);
  }

  encodeState(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  applyUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update);
  }

  destroy(): void {
    this.doc.destroy();
  }
}

export type MarkdownCanonicalReport = {
  input: string;
  output: string;
  exactRoundTrip: boolean;
  detectedFeatureNames: MarkdownCanonicalFeature[];
  preservedFeatureNames: MarkdownCanonicalFeature[];
  lostFeatureNames: MarkdownCanonicalFeature[];
};

type Fence = {
  language: string;
  body: string;
};

export function createMarkdownCanonicalDocument(
  markdown: string,
): MarkdownCanonicalDocument {
  return new MarkdownCanonicalDocument(markdown);
}

export function serializeMarkdownCanonical(
  doc: MarkdownCanonicalDocument,
): string {
  return doc.text;
}

export function analyzeMarkdownCanonicalRoundTrip(
  markdown: string,
): MarkdownCanonicalReport {
  const doc = createMarkdownCanonicalDocument(markdown);
  const output = serializeMarkdownCanonical(doc);
  const detectedFeatureNames = detectFeatures(markdown);
  const preservedFeatureNames = detectFeatures(output).filter((feature) =>
    detectedFeatureNames.includes(feature),
  );

  return {
    input: markdown,
    output,
    exactRoundTrip: output === markdown,
    detectedFeatureNames,
    preservedFeatureNames,
    lostFeatureNames: detectedFeatureNames.filter(
      (feature) => !preservedFeatureNames.includes(feature),
    ),
  };
}

function detectFeatures(markdown: string): MarkdownCanonicalFeature[] {
  const fences = collectFences(markdown);
  const features: MarkdownCanonicalFeature[] = [];

  if (/^---\r?\n[\s\S]*?\r?\n---(?=\r?\n)/.test(markdown)) {
    features.push("frontmatter");
  }

  if (/(?:^|\n)\s*[-*+]\s+\[[ xX]\]\s+/.test(markdown)) {
    features.push("taskLists");
  }

  if (
    /^\|.+\|\s*\r?\n\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/m.test(
      markdown,
    )
  ) {
    features.push("tables");
  }

  if (fences.length > 0) {
    features.push("fencedCode");
  }

  if (fences.some((fence) => fence.language === "mermaid")) {
    features.push("mermaidFence");
  }

  if (fences.some((fence) => fence.language === "math")) {
    features.push("mathFence");
  }

  if (/(^|[^$])\$[^$\n]+\$(?!\$)/.test(markdown)) {
    features.push("inlineMath");
  }

  if (/(^|[^!])\[[^\]]+\]\([^)]+\)/.test(markdown)) {
    features.push("links");
  }

  if (/!\[[^\]]*]\([^)]+\)/.test(markdown)) {
    features.push("images");
  }

  if (/`[^`\n]+`/.test(markdown)) {
    features.push("inlineCode");
  }

  return features;
}

function collectFences(markdown: string): Fence[] {
  const fences: Fence[] = [];
  const fencePattern = /^```([^\s`]*)[^\n]*\n([\s\S]*?)^```/gm;
  let match: RegExpExecArray | null;

  while ((match = fencePattern.exec(markdown)) !== null) {
    fences.push({
      language: match[1] ?? "",
      body: match[2] ?? "",
    });
  }

  return fences;
}

export function syncMarkdownCanonicalDocuments(
  ...documents: MarkdownCanonicalDocument[]
): void {
  const updates = documents.map((document) => document.encodeState());

  for (const target of documents) {
    for (const update of updates) {
      target.applyUpdate(update);
    }
  }
}
