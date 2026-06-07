import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyzeEditorCanonicalRoundTrip,
  parseEditorCanonical,
  summarizeEditorCanonicalReports,
} from "./editor-canonical.js";

const sampleDir = join(import.meta.dirname, "samples");

function readSample(name: string): string {
  return readFileSync(join(sampleDir, name), "utf8");
}

describe("editor-canonical document model", () => {
  it("parses each sample into a ProseMirror document", () => {
    for (const sample of [
      "agent-plan.md",
      "code-report.md",
      "rich-agent-output.md",
    ]) {
      const doc = parseEditorCanonical(readSample(sample));

      expect(doc.type.name).toBe("doc");
      expect(doc.childCount).toBeGreaterThan(0);
    }
  });

  it("measures frontmatter and task-list loss in the plan sample", () => {
    const report = analyzeEditorCanonicalRoundTrip(readSample("agent-plan.md"));

    expect(report.nodeCounts.heading).toBeGreaterThanOrEqual(3);
    expect(report.output).toContain("# Agent Plan");
    expect(report.lostFeatureNames).toContain("frontmatter");
    expect(report.lostFeatureNames).toContain("taskLists");
    expect(report.output).toContain("\\[ \\] Build CLI publish");
    expect(report.output).not.toMatch(/^---\n[\s\S]*?\n---(?=\n)/);
  });

  it("preserves fenced code blocks but loses pipe table structure", () => {
    const report = analyzeEditorCanonicalRoundTrip(readSample("code-report.md"));

    expect(report.preservedFeatureNames).toContain("fencedCode");
    expect(report.preservedFeatureNames).toContain("inlineCode");
    expect(report.lostFeatureNames).toContain("tables");
    expect(report.output).toContain("```ts\nexport function example");
    expect(report.output).toContain("```bash\nnpm test\nnpm run typecheck\n```");
    expect(report.output).not.toMatch(/^\| Area \| Status \| Notes \|$/m);
  });

  it("preserves Mermaid, math fences, inline math, links, and images", () => {
    const report = analyzeEditorCanonicalRoundTrip(
      readSample("rich-agent-output.md"),
    );

    expect(report.preservedFeatureNames).toContain("mermaidFence");
    expect(report.preservedFeatureNames).toContain("mathFence");
    expect(report.preservedFeatureNames).toContain("inlineMath");
    expect(report.preservedFeatureNames).toContain("links");
    expect(report.preservedFeatureNames).toContain("images");
    expect(report.output).toContain("```mermaid\nflowchart LR");
    expect(report.output).toContain("```math\n\\sum_{i=1}^{n}");
    expect(report.output).toContain(
      "[Project repo](https://github.com/wanderingspirit03/agent-md-rooms)",
    );
    expect(report.output).toContain("![Diagram](./diagram.png)");
  });

  it("summarizes fidelity across the sample set", () => {
    const reports = [
      "agent-plan.md",
      "code-report.md",
      "rich-agent-output.md",
    ].map((sample) => analyzeEditorCanonicalRoundTrip(readSample(sample)));
    const summary = summarizeEditorCanonicalReports(reports);

    expect(summary.frontmatter).toEqual({ detected: 1, preserved: 0 });
    expect(summary.taskLists).toEqual({ detected: 1, preserved: 0 });
    expect(summary.tables).toEqual({ detected: 1, preserved: 0 });
    expect(summary.fencedCode).toEqual({ detected: 2, preserved: 2 });
    expect(summary.mermaidFence).toEqual({ detected: 1, preserved: 1 });
    expect(summary.mathFence).toEqual({ detected: 1, preserved: 1 });
    expect(summary.links).toEqual({ detected: 1, preserved: 1 });
    expect(summary.images).toEqual({ detected: 1, preserved: 1 });
  });
});
