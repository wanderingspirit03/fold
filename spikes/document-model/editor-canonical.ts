import type { Node as ProseMirrorNode } from "prosemirror-model";
import {
  defaultMarkdownParser,
  defaultMarkdownSerializer,
} from "prosemirror-markdown";

export type EditorCanonicalFeature =
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

export type FeatureResult = {
  feature: EditorCanonicalFeature;
  detected: boolean;
  preserved: boolean;
  detail: string;
};

export type EditorCanonicalReport = {
  input: string;
  output: string;
  nodeCounts: Record<string, number>;
  features: FeatureResult[];
  detectedFeatureCount: number;
  preservedFeatureCount: number;
  preservedFeatureNames: EditorCanonicalFeature[];
  lostFeatureNames: EditorCanonicalFeature[];
};

type Fence = {
  language: string;
  body: string;
};

export function parseEditorCanonical(markdown: string): ProseMirrorNode {
  return defaultMarkdownParser.parse(markdown);
}

export function serializeEditorCanonical(doc: ProseMirrorNode): string {
  return defaultMarkdownSerializer.serialize(doc);
}

export function analyzeEditorCanonicalRoundTrip(
  markdown: string,
): EditorCanonicalReport {
  const doc = parseEditorCanonical(markdown);
  const output = serializeEditorCanonical(doc);
  const features = analyzeFeatures(markdown, output);
  const detectedFeatures = features.filter((feature) => feature.detected);
  const preservedFeatures = detectedFeatures.filter((feature) => feature.preserved);

  return {
    input: markdown,
    output,
    nodeCounts: countNodes(doc),
    features,
    detectedFeatureCount: detectedFeatures.length,
    preservedFeatureCount: preservedFeatures.length,
    preservedFeatureNames: preservedFeatures.map((feature) => feature.feature),
    lostFeatureNames: detectedFeatures
      .filter((feature) => !feature.preserved)
      .map((feature) => feature.feature),
  };
}

export function summarizeEditorCanonicalReports(
  reports: readonly EditorCanonicalReport[],
): Record<EditorCanonicalFeature, { detected: number; preserved: number }> {
  const summary = Object.fromEntries(
    featureOrder.map((feature) => [feature, { detected: 0, preserved: 0 }]),
  ) as Record<EditorCanonicalFeature, { detected: number; preserved: number }>;

  for (const report of reports) {
    for (const feature of report.features) {
      if (feature.detected) {
        summary[feature.feature].detected += 1;
      }

      if (feature.detected && feature.preserved) {
        summary[feature.feature].preserved += 1;
      }
    }
  }

  return summary;
}

const featureOrder: EditorCanonicalFeature[] = [
  "frontmatter",
  "taskLists",
  "tables",
  "fencedCode",
  "mermaidFence",
  "mathFence",
  "inlineMath",
  "links",
  "images",
  "inlineCode",
];

function analyzeFeatures(input: string, output: string): FeatureResult[] {
  const inputFences = collectFences(input);
  const outputFences = collectFences(output);

  return [
    featureResult(
      "frontmatter",
      hasFrontmatter(input),
      hasFrontmatter(output),
      "YAML frontmatter should remain a leading metadata block.",
    ),
    featureResult(
      "taskLists",
      hasTaskListItems(input),
      hasTaskListItems(output),
      "GFM task list markers should survive as task items, not escaped text.",
    ),
    featureResult(
      "tables",
      hasPipeTable(input),
      hasPipeTable(output),
      "Pipe tables should remain multi-row table Markdown.",
    ),
    featureResult(
      "fencedCode",
      inputFences.length > 0,
      inputFences.every((inputFence) =>
        outputFences.some(
          (outputFence) =>
            outputFence.language === inputFence.language &&
            normalizeText(outputFence.body) === normalizeText(inputFence.body),
        ),
      ),
      "Fenced code blocks should preserve language info strings and bodies.",
    ),
    featureResult(
      "mermaidFence",
      hasFenceLanguage(inputFences, "mermaid"),
      hasFenceLanguage(outputFences, "mermaid"),
      "Mermaid diagrams should remain mermaid code fences.",
    ),
    featureResult(
      "mathFence",
      hasFenceLanguage(inputFences, "math"),
      hasFenceLanguage(outputFences, "math"),
      "Block math should remain math code fences.",
    ),
    featureResult(
      "inlineMath",
      hasInlineMath(input),
      hasInlineMath(output),
      "Inline math is plain text in this parser but should not disappear.",
    ),
    featureResult(
      "links",
      hasLinks(input),
      hasLinks(output),
      "Markdown links should survive parse and serialize.",
    ),
    featureResult(
      "images",
      hasImages(input),
      hasImages(output),
      "Markdown images should survive parse and serialize.",
    ),
    featureResult(
      "inlineCode",
      hasInlineCode(input),
      hasInlineCode(output),
      "Inline code should survive parse and serialize.",
    ),
  ];
}

function featureResult(
  feature: EditorCanonicalFeature,
  detected: boolean,
  preserved: boolean,
  detail: string,
): FeatureResult {
  return {
    feature,
    detected,
    preserved: detected ? preserved : false,
    detail,
  };
}

function countNodes(doc: ProseMirrorNode): Record<string, number> {
  const counts: Record<string, number> = {};

  doc.descendants((node) => {
    counts[node.type.name] = (counts[node.type.name] ?? 0) + 1;
  });

  return counts;
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

function hasFenceLanguage(fences: readonly Fence[], language: string): boolean {
  return fences.some((fence) => fence.language === language);
}

function hasFrontmatter(markdown: string): boolean {
  return /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n)/.test(markdown);
}

function hasTaskListItems(markdown: string): boolean {
  return /(?:^|\n)\s*[-*+]\s+\[[ xX]\]\s+/.test(markdown);
}

function hasPipeTable(markdown: string): boolean {
  return /^\|.+\|\s*\r?\n\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/m.test(
    markdown,
  );
}

function hasInlineMath(markdown: string): boolean {
  return /(^|[^$])\$[^$\n]+\$(?!\$)/.test(markdown);
}

function hasLinks(markdown: string): boolean {
  return /(^|[^!])\[[^\]]+\]\([^)]+\)/.test(markdown);
}

function hasImages(markdown: string): boolean {
  return /!\[[^\]]*]\([^)]+\)/.test(markdown);
}

function hasInlineCode(markdown: string): boolean {
  return /`[^`\n]+`/.test(markdown);
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").trimEnd();
}
