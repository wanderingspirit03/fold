import { JSDOM } from "jsdom";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import type { Node as ProseMirrorNode } from "@milkdown/prose/model";
import { extractMarkdownProperties } from "../../apps/web/lib/markdown-properties.js";
import type { EditorCanonicalFeature, FeatureResult } from "./editor-canonical.js";

export type MilkdownCanonicalReport = {
  input: string;
  output: string;
  exactRoundTrip: boolean;
  nodeCounts: Record<string, number>;
  semantics: MilkdownSemanticSummary;
  normalization: MilkdownNormalizationSummary;
  features: FeatureResult[];
  detectedFeatureCount: number;
  preservedFeatureCount: number;
  preservedFeatureNames: EditorCanonicalFeature[];
  lostFeatureNames: EditorCanonicalFeature[];
};

export type MilkdownNormalizationCategory =
  | "frontmatterLoss"
  | "taskListMarkerStyle"
  | "tableFormatting"
  | "blankLineSpacing"
  | "trailingFinalNewline"
  | "other";

export type MilkdownNormalizationSummary = {
  changed: boolean;
  categories: MilkdownNormalizationCategory[];
  changedLineCount: number;
  uncategorizedLineChanges: number;
};

export type MilkdownSemanticSummary = {
  taskListItems: {
    checked: number;
    unchecked: number;
    total: number;
  };
  tables: Array<{
    headerRows: number;
    bodyRows: number;
    columns: number;
    totalCells: number;
  }>;
};

type Fence = {
  language: string;
  body: string;
};

type MilkdownCoreRuntime = {
  Editor: { make: () => MilkdownEditorBuilder };
  defaultValueCtx: unknown;
  parserCtx: unknown;
  rootCtx: unknown;
  serializerCtx: unknown;
};

type MilkdownEditorBuilder = {
  config: (configure: (ctx: MilkdownContext) => void) => MilkdownEditorBuilder;
  use: (plugins: unknown) => MilkdownEditorBuilder;
  create: () => Promise<MilkdownEditor>;
};

type MilkdownEditor = {
  action: <T>(action: (ctx: MilkdownContext) => T) => T;
  destroy: (clearPlugins?: boolean) => Promise<unknown>;
};

type MilkdownContext = {
  set: (slice: unknown, value: unknown) => void;
  get: (slice: unknown) => unknown;
};

type MilkdownParser = (markdown: string) => ProseMirrorNode;
type MilkdownSerializer = (doc: ProseMirrorNode) => string;

type BrowserGlobalKey =
  | "window"
  | "document"
  | "navigator"
  | "HTMLElement"
  | "Node"
  | "Event"
  | "CustomEvent"
  | "getSelection"
  | "addEventListener"
  | "removeEventListener"
  | "dispatchEvent";

let browserDom: JSDOM | null = null;

// Milkdown owns browser-like global event timers during initialization. Keep
// this harness sequential; parallel calls would share the same jsdom root.
export async function analyzeMilkdownCanonicalRoundTrip(
  markdown: string,
): Promise<MilkdownCanonicalReport> {
  return analyzeMilkdownMarkdown(markdown, markdown);
}

export async function analyzeMilkdownWithPropertiesRoundTrip(
  markdown: string,
): Promise<MilkdownCanonicalReport> {
  const properties = extractMarkdownProperties(markdown);
  const bodyReport = await analyzeMilkdownMarkdown(properties.content, markdown);
  const output = `${properties.propertySource}${bodyReport.output}`;
  const features = analyzeFeatures(markdown, output);
  const detectedFeatures = features.filter((feature) => feature.detected);
  const preservedFeatures = detectedFeatures.filter((feature) => feature.preserved);

  return {
    input: markdown,
    output,
    exactRoundTrip: output === markdown,
    nodeCounts: bodyReport.nodeCounts,
    semantics: bodyReport.semantics,
    normalization: analyzeNormalization(markdown, output),
    features,
    detectedFeatureCount: detectedFeatures.length,
    preservedFeatureCount: preservedFeatures.length,
    preservedFeatureNames: preservedFeatures.map((feature) => feature.feature),
    lostFeatureNames: detectedFeatures
      .filter((feature) => !feature.preserved)
      .map((feature) => feature.feature),
  };
}

async function analyzeMilkdownMarkdown(
  editorMarkdown: string,
  reportInput: string,
): Promise<MilkdownCanonicalReport> {
  installBrowserGlobals();
  const editorRoot = document.querySelector("#editor");

  if (!editorRoot) {
    throw new Error("Milkdown fidelity harness could not create an editor root.");
  }

  const {
    Editor,
    defaultValueCtx,
    parserCtx,
    rootCtx,
    serializerCtx,
  } = await loadMilkdownCore();
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, editorRoot as HTMLElement);
      ctx.set(defaultValueCtx, editorMarkdown);
    })
    .use(commonmark)
    .use(gfm)
    .create();

  try {
    const { output, doc } = editor.action((ctx) => {
      const parser = ctx.get(parserCtx) as MilkdownParser;
      const serializer = ctx.get(serializerCtx) as MilkdownSerializer;
      const parsedDoc = parser(editorMarkdown);

      return {
        doc: parsedDoc,
        output: serializer(parsedDoc),
      };
    });
    const features = analyzeFeatures(reportInput, output);
    const detectedFeatures = features.filter((feature) => feature.detected);
    const preservedFeatures = detectedFeatures.filter((feature) => feature.preserved);

    return {
      input: reportInput,
      output,
      exactRoundTrip: output === reportInput,
      nodeCounts: countNodes(doc),
      semantics: collectSemantics(doc),
      normalization: analyzeNormalization(reportInput, output),
      features,
      detectedFeatureCount: detectedFeatures.length,
      preservedFeatureCount: preservedFeatures.length,
      preservedFeatureNames: preservedFeatures.map((feature) => feature.feature),
      lostFeatureNames: detectedFeatures
        .filter((feature) => !feature.preserved)
        .map((feature) => feature.feature),
    };
  } finally {
    await editor.destroy(true);
    editorRoot.replaceChildren();
  }
}

async function loadMilkdownCore(): Promise<MilkdownCoreRuntime> {
  return await import("@milkdown/core") as unknown as MilkdownCoreRuntime;
}

export function summarizeMilkdownCanonicalReports(
  reports: readonly MilkdownCanonicalReport[],
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

function installBrowserGlobals(): void {
  if (browserDom) return;

  browserDom = new JSDOM("<!doctype html><html><body><div id=\"editor\"></div></body></html>");
  const bindings: Record<BrowserGlobalKey, unknown> = {
    window: browserDom.window,
    document: browserDom.window.document,
    navigator: browserDom.window.navigator,
    HTMLElement: browserDom.window.HTMLElement,
    Node: browserDom.window.Node,
    Event: browserDom.window.Event,
    CustomEvent: browserDom.window.CustomEvent,
    getSelection: browserDom.window.getSelection.bind(browserDom.window),
    addEventListener: browserDom.window.addEventListener.bind(browserDom.window),
    removeEventListener: browserDom.window.removeEventListener.bind(browserDom.window),
    dispatchEvent: browserDom.window.dispatchEvent.bind(browserDom.window),
  };

  for (const [key, value] of Object.entries(bindings) as Array<[BrowserGlobalKey, unknown]>) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value,
      writable: true,
    });
  }
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
      "Inline math should survive parse and serialize.",
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

function collectSemantics(doc: ProseMirrorNode): MilkdownSemanticSummary {
  const taskListItems = {
    checked: 0,
    unchecked: 0,
    total: 0,
  };
  const tables: MilkdownSemanticSummary["tables"] = [];

  doc.descendants((node) => {
    if (node.type.name === "list_item" && node.attrs.checked != null) {
      taskListItems.total += 1;
      if (node.attrs.checked) {
        taskListItems.checked += 1;
      } else {
        taskListItems.unchecked += 1;
      }
    }

    if (node.type.name === "table") {
      let headerRows = 0;
      let bodyRows = 0;
      let columns = 0;
      let totalCells = 0;

      node.forEach((row) => {
        if (row.type.name === "table_header_row") {
          headerRows += 1;
        }

        if (row.type.name === "table_row") {
          bodyRows += 1;
        }

        columns = Math.max(columns, row.childCount);
        totalCells += row.childCount;
      });

      tables.push({
        headerRows,
        bodyRows,
        columns,
        totalCells,
      });
    }
  });

  return { taskListItems, tables };
}

function analyzeNormalization(
  input: string,
  output: string,
): MilkdownNormalizationSummary {
  if (input === output) {
    return {
      changed: false,
      categories: [],
      changedLineCount: 0,
      uncategorizedLineChanges: 0,
    };
  }

  const categories = new Set<MilkdownNormalizationCategory>();

  if (hasFrontmatter(input) && !hasFrontmatter(output)) {
    categories.add("frontmatterLoss");
  }

  if (hasTaskListMarkerStyleChange(input, output)) {
    categories.add("taskListMarkerStyle");
  }

  if (hasTableFormattingChange(input, output)) {
    categories.add("tableFormatting");
  }

  if (input.endsWith("\n") !== output.endsWith("\n")) {
    categories.add("trailingFinalNewline");
  }

  const normalizedInput = normalizeKnownSourceFormatting(input, categories);
  const normalizedOutput = normalizeKnownSourceFormatting(output, categories);

  if (
    normalizedInput !== normalizedOutput &&
    removeBlankLines(normalizedInput) === removeBlankLines(normalizedOutput)
  ) {
    categories.add("blankLineSpacing");
  }

  const fullyNormalizedInput = normalizeKnownSourceFormatting(input, categories);
  const fullyNormalizedOutput = normalizeKnownSourceFormatting(output, categories);
  const changedLineCount = countChangedLines(input, output);
  const uncategorizedLineChanges = countChangedLines(
    fullyNormalizedInput,
    fullyNormalizedOutput,
  );
  const hasOtherChanges = uncategorizedLineChanges > 0;

  if (hasOtherChanges) {
    categories.add("other");
  }

  return {
    changed: true,
    categories: [...categories],
    changedLineCount,
    uncategorizedLineChanges,
  };
}

function normalizeKnownSourceFormatting(
  markdown: string,
  categories: ReadonlySet<MilkdownNormalizationCategory>,
): string {
  let normalized = markdown.replace(/\r\n/g, "\n");

  if (categories.has("taskListMarkerStyle")) {
    normalized = normalized.replace(/^(\s*)[-+*]\s+(\[[ xX]\]\s+)/gm, "$1* $2");
  }

  if (categories.has("tableFormatting")) {
    normalized = normalizeTableLines(normalized);
  }

  if (categories.has("blankLineSpacing")) {
    normalized = removeBlankLines(normalized);
  }

  if (categories.has("trailingFinalNewline")) {
    normalized = normalized.trimEnd();
  }

  return normalized;
}

function hasTaskListMarkerStyleChange(input: string, output: string): boolean {
  return /^\s*-\s+\[[ xX]\]\s+/m.test(input) && /^\s*\*\s+\[[ xX]\]\s+/m.test(output);
}

function hasTableFormattingChange(input: string, output: string): boolean {
  if (!hasPipeTable(input) || !hasPipeTable(output)) return false;

  const inputTables = collectPipeTables(input);
  const outputTables = collectPipeTables(output);

  if (inputTables.length !== outputTables.length) return false;

  return inputTables.some((inputTable, index) => {
    const outputTable = outputTables[index];
    if (!outputTable) return false;

    return (
      JSON.stringify(inputTable.cells) === JSON.stringify(outputTable.cells) &&
      inputTable.raw !== outputTable.raw
    );
  });
}

function normalizeTableLines(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => {
      if (!isPipeTableLine(line)) return line;

      const cells = line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim());

      if (cells.every((cell) => /^:?-{1,}:?$/.test(cell))) {
        return `| ${cells.map(() => "---").join(" | ")} |`;
      }

      return `| ${cells.join(" | ")} |`;
    })
    .join("\n");
}

function collectPipeTables(markdown: string): Array<{ raw: string; cells: string[][] }> {
  const tables: Array<{ raw: string; cells: string[][] }> = [];
  const lines = markdown.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    if (!isPipeTableLine(lines[index] ?? "")) continue;

    const block: string[] = [];
    while (index < lines.length && isPipeTableLine(lines[index] ?? "")) {
      block.push(lines[index] ?? "");
      index += 1;
    }

    index -= 1;

    if (block.some((line) => isPipeTableSeparatorLine(line))) {
      tables.push({
        raw: block.join("\n"),
        cells: block
          .filter((line) => !isPipeTableSeparatorLine(line))
          .map((line) => parsePipeTableCells(line)),
      });
    }
  }

  return tables;
}

function isPipeTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|", 1);
}

function isPipeTableSeparatorLine(line: string): boolean {
  return parsePipeTableCells(line).every((cell) => /^:?-{1,}:?$/.test(cell));
}

function parsePipeTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function removeBlankLines(markdown: string): string {
  return markdown
    .split("\n")
    .filter((line) => line.trim() !== "")
    .join("\n")
    .trimEnd();
}

function countChangedLines(input: string, output: string): number {
  return diffLines(input, output).filter((op) => op.type !== "same").length;
}

type DiffOp = {
  type: "same" | "removed" | "added";
  line: string;
};

function diffLines(original: string, changed: string): DiffOp[] {
  const a = original.split("\n");
  const b = changed.split("\n");
  const dp = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  );

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ type: "same", line: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "removed", line: a[i] });
      i += 1;
    } else {
      ops.push({ type: "added", line: b[j] });
      j += 1;
    }
  }

  while (i < a.length) {
    ops.push({ type: "removed", line: a[i] });
    i += 1;
  }

  while (j < b.length) {
    ops.push({ type: "added", line: b[j] });
    j += 1;
  }

  return ops;
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
  return /^\|.+\|\s*\r?\n\|\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/m.test(
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
