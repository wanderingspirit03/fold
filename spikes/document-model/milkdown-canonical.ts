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
