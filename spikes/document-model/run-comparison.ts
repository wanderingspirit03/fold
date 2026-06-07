import { writeFile } from "node:fs/promises";
import { analyzeEditorCanonicalRoundTrip } from "./editor-canonical.js";
import {
  analyzeMarkdownCanonicalRoundTrip,
  createMarkdownCanonicalDocument,
  serializeMarkdownCanonical,
} from "./markdown-canonical.js";
import { loadMarkdownSamples } from "./sample-loader.js";

const reportPath = "spikes/document-model/COMPARISON.md";
const samples = await loadMarkdownSamples();

const sections = samples.map((sample) => {
  const markdownDoc = createMarkdownCanonicalDocument(sample.markdown);
  const markdownOutput = serializeMarkdownCanonical(markdownDoc);
  markdownDoc.destroy();

  const markdownReport = analyzeMarkdownCanonicalRoundTrip(sample.markdown);
  const editorReport = analyzeEditorCanonicalRoundTrip(sample.markdown);

  return `## ${sample.name}

### Summary

| Model | Exact round-trip | Preserved features | Lost features |
| --- | --- | --- | --- |
| Markdown canonical | ${markdownReport.exactRoundTrip ? "yes" : "no"} | ${formatList(markdownReport.preservedFeatureNames)} | ${formatList(markdownReport.lostFeatureNames)} |
| Editor canonical | ${editorReport.output === sample.markdown ? "yes" : "no"} | ${formatList(editorReport.preservedFeatureNames)} | ${formatList(editorReport.lostFeatureNames)} |

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
`;
});

const report = `# Document Model Comparison Report

This report shows the same agent-authored Markdown samples through both candidate document models.

- Markdown canonical keeps raw Markdown as the live \`Y.Text\` document.
- Editor canonical parses Markdown into a ProseMirror document and serializes it back with \`prosemirror-markdown\`.

${sections.join("\n")}
`;

await writeFile(reportPath, report);
await writeFile("spikes/document-model/COMPARISON.html", renderHtmlReport());
console.log(`Wrote ${reportPath}`);
console.log("Wrote spikes/document-model/COMPARISON.html");

function formatList(values: readonly string[]): string {
  return values.length === 0 ? "none" : values.join(", ");
}

function renderHtmlReport(): string {
  const sampleCards = samples.map((sample) => {
    const markdownDoc = createMarkdownCanonicalDocument(sample.markdown);
    const markdownOutput = serializeMarkdownCanonical(markdownDoc);
    markdownDoc.destroy();
    const markdownReport = analyzeMarkdownCanonicalRoundTrip(sample.markdown);
    const editorReport = analyzeEditorCanonicalRoundTrip(sample.markdown);

    return `<section class="sample">
      <h2>${escapeHtml(sample.name)}</h2>
      <div class="summary">
        <div><strong>Markdown canonical:</strong> exact round-trip: ${markdownReport.exactRoundTrip ? "yes" : "no"}; lost: ${escapeHtml(formatList(markdownReport.lostFeatureNames))}</div>
        <div><strong>Editor canonical:</strong> exact round-trip: ${editorReport.output === sample.markdown ? "yes" : "no"}; lost: ${escapeHtml(formatList(editorReport.lostFeatureNames))}</div>
      </div>
      <div class="grid">
        ${renderPane("Original Markdown", sample.markdown)}
        ${renderPane("Markdown-Canonical Export", markdownOutput)}
        ${renderPane("Editor-Canonical Export", editorReport.output)}
      </div>
      <div class="diff">
        <h3>Editor-Canonical Changes vs Original</h3>
        <pre><code>${renderLineDiff(sample.markdown, editorReport.output)}</code></pre>
      </div>
    </section>`;
  }).join("\n");

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
      grid-template-columns: repeat(3, minmax(280px, 1fr));
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
    <p>Compare the same agent-authored Markdown through raw Markdown/Y.Text versus ProseMirror editor-canonical serialization.</p>
  </header>
  <main>${sampleCards}</main>
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
