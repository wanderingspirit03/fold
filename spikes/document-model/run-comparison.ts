import { writeFile } from "node:fs/promises";
import { analyzeEditorCanonicalRoundTrip } from "./editor-canonical.js";
import {
  analyzeMarkdownCanonicalRoundTrip,
  createMarkdownCanonicalDocument,
  serializeMarkdownCanonical,
} from "./markdown-canonical.js";
import {
  analyzeMilkdownCanonicalRoundTrip,
  analyzeMilkdownWithPropertiesRoundTrip,
} from "./milkdown-canonical.js";
import { loadMarkdownSamples } from "./sample-loader.js";

const reportPath = "spikes/document-model/COMPARISON.md";
const samples = await loadMarkdownSamples();
const milkdownReportsByName = new Map<string, Awaited<ReturnType<typeof analyzeMilkdownCanonicalRoundTrip>>>();
const milkdownPropertiesReportsByName = new Map<string, Awaited<ReturnType<typeof analyzeMilkdownWithPropertiesRoundTrip>>>();

const sections: string[] = [];

for (const sample of samples) {
  const markdownDoc = createMarkdownCanonicalDocument(sample.markdown);
  const markdownOutput = serializeMarkdownCanonical(markdownDoc);
  markdownDoc.destroy();

  const markdownReport = analyzeMarkdownCanonicalRoundTrip(sample.markdown);
  const editorReport = analyzeEditorCanonicalRoundTrip(sample.markdown);
  const milkdownReport = await analyzeMilkdownCanonicalRoundTrip(sample.markdown);
  const milkdownPropertiesReport = await analyzeMilkdownWithPropertiesRoundTrip(sample.markdown);
  milkdownReportsByName.set(sample.name, milkdownReport);
  milkdownPropertiesReportsByName.set(sample.name, milkdownPropertiesReport);

  sections.push(`## ${sample.name}

### Summary

| Model | Exact round-trip | Preserved features | Lost features |
| --- | --- | --- | --- |
| Markdown canonical | ${markdownReport.exactRoundTrip ? "yes" : "no"} | ${formatList(markdownReport.preservedFeatureNames)} | ${formatList(markdownReport.lostFeatureNames)} |
| Editor canonical | ${editorReport.output === sample.markdown ? "yes" : "no"} | ${formatList(editorReport.preservedFeatureNames)} | ${formatList(editorReport.lostFeatureNames)} |
| Milkdown candidate | ${milkdownReport.exactRoundTrip ? "yes" : "no"} | ${formatList(milkdownReport.preservedFeatureNames)} | ${formatList(milkdownReport.lostFeatureNames)} |
| Milkdown with Fold properties | ${milkdownPropertiesReport.exactRoundTrip ? "yes" : "no"} | ${formatList(milkdownPropertiesReport.preservedFeatureNames)} | ${formatList(milkdownPropertiesReport.lostFeatureNames)} |

Milkdown semantics: ${formatMilkdownSemantics(milkdownPropertiesReport)}

Milkdown candidate normalization: ${formatMilkdownNormalization(milkdownReport)}

Milkdown with Fold properties normalization: ${formatMilkdownNormalization(milkdownPropertiesReport)}

### Original Markdown

\`\`\`\`md
${sample.markdown}
\`\`\`\`

### Markdown-Canonical Export

\`\`\`\`md
${markdownOutput}
\`\`\`\`

### Editor-Canonical Export

\`\`\`\`md
${editorReport.output}
\`\`\`\`

### Milkdown Candidate Export

\`\`\`\`md
${milkdownReport.output}
\`\`\`\`

### Milkdown With Fold Properties Export

\`\`\`\`md
${milkdownPropertiesReport.output}
\`\`\`\`
`);
}

const report = `# Document Model Comparison Report

This report shows the same agent-authored Markdown samples through the durable Markdown model, plain ProseMirror serialization, Milkdown, and Milkdown with Fold properties.

- Markdown canonical keeps raw Markdown as the live \`Y.Text\` document.
- Editor canonical parses Markdown into a ProseMirror document and serializes it back with \`prosemirror-markdown\`.
- Milkdown candidate parses and serializes Markdown with Milkdown CommonMark plus GFM in a hidden jsdom harness.
- Milkdown with Fold properties keeps frontmatter/properties outside the editor body, matching the current web edit-mode strategy.

${sections.join("\n")}
`;

await writeFile(reportPath, report);
await writeFile("spikes/document-model/COMPARISON.html", renderHtmlReport());
console.log(`Wrote ${reportPath}`);
console.log("Wrote spikes/document-model/COMPARISON.html");

function formatList(values: readonly string[]): string {
  return values.length === 0 ? "none" : values.join(", ");
}

function formatMilkdownSemantics(
  report: Awaited<ReturnType<typeof analyzeMilkdownWithPropertiesRoundTrip>>,
): string {
  const taskSummary = report.semantics.taskListItems.total > 0
    ? `${report.semantics.taskListItems.checked} checked / ${report.semantics.taskListItems.unchecked} unchecked task items`
    : "no task items";
  const tableSummary = report.semantics.tables.length > 0
    ? report.semantics.tables
      .map((table) => `${table.columns} cols x ${table.headerRows + table.bodyRows} rows (${table.totalCells} total cells)`)
      .join("; ")
    : "no tables";

  return `${taskSummary}; ${tableSummary}`;
}

function formatMilkdownNormalization(
  report: Awaited<ReturnType<typeof analyzeMilkdownWithPropertiesRoundTrip>>,
): string {
  if (!report.normalization.changed) return "none";

  const uncategorized = report.normalization.uncategorizedLineChanges > 0
    ? `; ${formatLineCount(report.normalization.uncategorizedLineChanges)} uncategorized`
    : "";

  return `${formatList(report.normalization.categories)}; ${formatLineCount(report.normalization.changedLineCount)} changed${uncategorized}`;
}

function formatLineCount(count: number): string {
  return `${count} ${count === 1 ? "line" : "lines"}`;
}

function renderHtmlReport(): string {
  const sampleCards: string[] = [];

  for (const sample of samples) {
    const markdownDoc = createMarkdownCanonicalDocument(sample.markdown);
    const markdownOutput = serializeMarkdownCanonical(markdownDoc);
    markdownDoc.destroy();
    const markdownReport = analyzeMarkdownCanonicalRoundTrip(sample.markdown);
    const editorReport = analyzeEditorCanonicalRoundTrip(sample.markdown);
    const milkdownReport = milkdownReportsByName.get(sample.name);
    const milkdownPropertiesReport = milkdownPropertiesReportsByName.get(sample.name);

    if (!milkdownReport || !milkdownPropertiesReport) {
      throw new Error(`Missing Milkdown report for ${sample.name}`);
    }

    sampleCards.push(`<section class="sample">
      <h2>${escapeHtml(sample.name)}</h2>
      <div class="summary">
        <div><strong>Markdown canonical:</strong> exact round-trip: ${markdownReport.exactRoundTrip ? "yes" : "no"}; lost: ${escapeHtml(formatList(markdownReport.lostFeatureNames))}</div>
        <div><strong>Editor canonical:</strong> exact round-trip: ${editorReport.output === sample.markdown ? "yes" : "no"}; lost: ${escapeHtml(formatList(editorReport.lostFeatureNames))}</div>
        <div><strong>Milkdown candidate:</strong> exact round-trip: ${milkdownReport.exactRoundTrip ? "yes" : "no"}; lost: ${escapeHtml(formatList(milkdownReport.lostFeatureNames))}</div>
        <div><strong>Milkdown with Fold properties:</strong> exact round-trip: ${milkdownPropertiesReport.exactRoundTrip ? "yes" : "no"}; lost: ${escapeHtml(formatList(milkdownPropertiesReport.lostFeatureNames))}</div>
        <div><strong>Milkdown semantics:</strong> ${escapeHtml(formatMilkdownSemantics(milkdownPropertiesReport))}</div>
        <div><strong>Milkdown candidate normalization:</strong> ${escapeHtml(formatMilkdownNormalization(milkdownReport))}</div>
        <div><strong>Milkdown with Fold properties normalization:</strong> ${escapeHtml(formatMilkdownNormalization(milkdownPropertiesReport))}</div>
      </div>
      <div class="grid">
        ${renderPane("Original Markdown", sample.markdown)}
        ${renderPane("Markdown-Canonical Export", markdownOutput)}
        ${renderPane("Editor-Canonical Export", editorReport.output)}
        ${renderPane("Milkdown Candidate Export", milkdownReport.output)}
        ${renderPane("Milkdown With Fold Properties Export", milkdownPropertiesReport.output)}
      </div>
      <div class="diff">
        <h3>Editor-Canonical Changes vs Original</h3>
        <pre><code>${renderLineDiff(sample.markdown, editorReport.output)}</code></pre>
      </div>
      <div class="diff">
        <h3>Milkdown Candidate Changes vs Original</h3>
        <pre><code>${renderLineDiff(sample.markdown, milkdownReport.output)}</code></pre>
      </div>
      <div class="diff">
        <h3>Milkdown With Fold Properties Changes vs Original</h3>
        <pre><code>${renderLineDiff(sample.markdown, milkdownPropertiesReport.output)}</code></pre>
      </div>
    </section>`);
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Document Model Comparison</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f6f7f9;
      color: #20242a;
    }
    body {
      margin: 0;
    }
    header {
      padding: 28px 32px 18px;
      background: #ffffff;
      border-bottom: 1px solid #d8dde6;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 28px;
      letter-spacing: 0;
    }
    p {
      margin: 0;
      color: #596273;
      max-width: 920px;
      line-height: 1.5;
    }
    main {
      padding: 24px 32px 40px;
    }
    .sample {
      margin-bottom: 28px;
    }
    h2 {
      font-size: 18px;
      margin: 0 0 10px;
    }
    .summary {
      display: grid;
      gap: 6px;
      margin-bottom: 12px;
      font-size: 14px;
      color: #3b4350;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(250px, 1fr));
      gap: 12px;
      align-items: stretch;
    }
    .pane {
      background: #ffffff;
      border: 1px solid #d8dde6;
      border-radius: 8px;
      min-width: 0;
      overflow: hidden;
    }
    .pane h3 {
      margin: 0;
      padding: 10px 12px;
      font-size: 13px;
      background: #eef1f5;
      border-bottom: 1px solid #d8dde6;
    }
    pre {
      margin: 0;
      padding: 12px;
      min-height: 260px;
      max-height: 520px;
      overflow: auto;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      line-height: 1.45;
      white-space: pre;
    }
    .diff {
      margin-top: 12px;
      background: #ffffff;
      border: 1px solid #d8dde6;
      border-radius: 8px;
      overflow: hidden;
    }
    .diff h3 {
      margin: 0;
      padding: 10px 12px;
      font-size: 13px;
      background: #fff4e5;
      border-bottom: 1px solid #efd3a6;
    }
    .diff pre {
      min-height: 0;
      max-height: 360px;
    }
    .same {
      color: #7b8493;
    }
    .removed {
      display: block;
      color: #9f1c2d;
      background: #ffe9ed;
    }
    .added {
      display: block;
      color: #125c32;
      background: #e8f7ee;
    }
    @media (max-width: 1100px) {
      .grid {
        grid-template-columns: 1fr;
      }
      main, header {
        padding-left: 18px;
        padding-right: 18px;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>Document Model Comparison</h1>
    <p>Compare the same agent-authored Markdown through raw Markdown/Y.Text, plain ProseMirror serialization, the hidden Milkdown CommonMark/GFM candidate, and Milkdown with Fold properties wrapped around the editor body.</p>
  </header>
  <main>${sampleCards.join("\n")}</main>
</body>
</html>`;
}

function renderPane(title: string, content: string): string {
  return `<article class="pane"><h3>${escapeHtml(title)}</h3><pre><code>${escapeHtml(content)}</code></pre></article>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

type DiffOp = {
  type: "same" | "removed" | "added";
  line: string;
};

function renderLineDiff(original: string, changed: string): string {
  return diffLines(original, changed)
    .map((op) => {
      const prefix = op.type === "same" ? "  " : op.type === "removed" ? "- " : "+ ";
      return `<span class="${op.type}">${escapeHtml(prefix + op.line)}</span>`;
    })
    .join("\n");
}

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
