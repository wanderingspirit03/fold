import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyzeMilkdownCanonicalRoundTrip,
  analyzeMilkdownWithPropertiesRoundTrip,
  summarizeMilkdownCanonicalReports,
} from "./milkdown-canonical.js";
import { MARKDOWN_SAMPLE_NAMES } from "./sample-loader.js";

const sampleDir = join(import.meta.dirname, "samples");

function readSample(name: string): string {
  return readFileSync(join(sampleDir, name), "utf8");
}

describe("milkdown editor candidate", () => {
  it("parses and serializes every Markdown fixture through the hidden Milkdown harness", async () => {
    for (const sample of MARKDOWN_SAMPLE_NAMES) {
      const report = await analyzeMilkdownCanonicalRoundTrip(readSample(sample));

      expect(report.output.length).toBeGreaterThan(0);
      expect(report.nodeCounts.paragraph ?? 0).toBeGreaterThan(0);
    }
  });

  it("loses frontmatter while keeping GFM task-list Markdown syntax", async () => {
    const report = await analyzeMilkdownCanonicalRoundTrip(readSample("agent-plan.md"));

    expect(report.exactRoundTrip).toBe(false);
    expect(report.lostFeatureNames).toContain("frontmatter");
    expect(report.normalization.categories).toContain("frontmatterLoss");
    expect(report.normalization.categories).toContain("taskListMarkerStyle");
    expect(report.preservedFeatureNames).toContain("taskLists");
    expect(report.semantics.taskListItems).toEqual({
      checked: 1,
      unchecked: 2,
      total: 3,
    });
    expect(report.output).not.toMatch(/^---\ntitle: Agent Plan\nowner: coding-agent\n---/);
    expect(report.output).toContain("* [x] Verify E2EE spike");
    expect(report.output).not.toContain("- [x] Verify E2EE spike");
  });

  it("preserves frontmatter when Fold properties are wrapped around the editor body", async () => {
    const report = await analyzeMilkdownWithPropertiesRoundTrip(readSample("agent-plan.md"));

    expect(report.exactRoundTrip).toBe(false);
    expect(report.preservedFeatureNames).toContain("frontmatter");
    expect(report.preservedFeatureNames).toContain("taskLists");
    expect(report.normalization.categories).not.toContain("frontmatterLoss");
    expect(report.normalization.categories).toContain("taskListMarkerStyle");
    expect(report.normalization.categories).toContain("blankLineSpacing");
    expect(report.normalization.categories).not.toContain("other");
    expect(report.semantics.taskListItems).toEqual({
      checked: 1,
      unchecked: 2,
      total: 3,
    });
    expect(report.lostFeatureNames).not.toContain("frontmatter");
    expect(report.output).toMatch(/^---\ntitle: Agent Plan\nowner: coding-agent\n---/);
    expect(report.output).toContain("* [x] Verify E2EE spike");
  });

  it("preserves pipe table structure while normalizing table separators", async () => {
    const report = await analyzeMilkdownCanonicalRoundTrip(readSample("code-report.md"));

    expect(report.exactRoundTrip).toBe(false);
    expect(report.preservedFeatureNames).toContain("tables");
    expect(report.preservedFeatureNames).toContain("fencedCode");
    expect(report.preservedFeatureNames).toContain("inlineCode");
    expect(report.normalization.categories).toContain("tableFormatting");
    expect(report.semantics.tables).toEqual([
      {
        headerRows: 1,
        bodyRows: 3,
        columns: 3,
        totalCells: 12,
      },
    ]);
    expect(report.output).toMatch(/\| Area\s+\| Status\s+\| Notes\s+\|/);
    expect(report.output).toMatch(/\| -{2,}\s+\| -{2,}\s+\| -{2,}\s+\|/);
  });

  it("preserves Mermaid, math fences, inline math, links, and images", async () => {
    const report = await analyzeMilkdownCanonicalRoundTrip(
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
      "[Project repo](https://github.com/wanderingspirit03/fold)",
    );
    expect(report.output).toContain("![Diagram](./diagram.png)");
  });

  it("keeps most required features in the long handoff but still fails exact fidelity", async () => {
    const report = await analyzeMilkdownCanonicalRoundTrip(
      readSample("long-agent-handoff.md"),
    );

    expect(report.exactRoundTrip).toBe(false);
    expect(report.lostFeatureNames).toContain("frontmatter");
    expect(report.normalization.categories).toContain("frontmatterLoss");
    expect(report.normalization.categories).toContain("taskListMarkerStyle");
    expect(report.normalization.categories).toContain("tableFormatting");
    expect(report.preservedFeatureNames).toContain("taskLists");
    expect(report.preservedFeatureNames).toContain("tables");
    expect(report.preservedFeatureNames).toContain("fencedCode");
    expect(report.preservedFeatureNames).toContain("mermaidFence");
    expect(report.preservedFeatureNames).toContain("mathFence");
    expect(report.semantics.taskListItems).toEqual({
      checked: 2,
      unchecked: 2,
      total: 4,
    });
    expect(report.semantics.tables).toEqual([
      {
        headerRows: 1,
        bodyRows: 4,
        columns: 4,
        totalCells: 20,
      },
    ]);
  });

  it("keeps long handoff frontmatter when properties are wrapped around Milkdown output", async () => {
    const report = await analyzeMilkdownWithPropertiesRoundTrip(
      readSample("long-agent-handoff.md"),
    );

    expect(report.exactRoundTrip).toBe(false);
    expect(report.preservedFeatureNames).toContain("frontmatter");
    expect(report.preservedFeatureNames).toContain("taskLists");
    expect(report.preservedFeatureNames).toContain("tables");
    expect(report.preservedFeatureNames).toContain("fencedCode");
    expect(report.normalization.categories).not.toContain("frontmatterLoss");
    expect(report.normalization.categories).toContain("taskListMarkerStyle");
    expect(report.normalization.categories).toContain("tableFormatting");
    expect(report.normalization.categories).not.toContain("other");
    expect(report.semantics.taskListItems).toEqual({
      checked: 2,
      unchecked: 2,
      total: 4,
    });
    expect(report.semantics.tables).toEqual([
      {
        headerRows: 1,
        bodyRows: 4,
        columns: 4,
        totalCells: 20,
      },
    ]);
    expect(report.lostFeatureNames).toEqual([]);
    expect(report.output).toMatch(/^---\ntitle: Agent Handoff Review\nowner: review-agent\nroom: fold-ui\nstatus: active\n---/);
  });

  it("summarizes Milkdown feature preservation across the sample set", async () => {
    const reports = [];

    for (const sample of MARKDOWN_SAMPLE_NAMES) {
      reports.push(await analyzeMilkdownCanonicalRoundTrip(readSample(sample)));
    }

    const summary = summarizeMilkdownCanonicalReports(reports);

    expect(summary.frontmatter).toEqual({ detected: 2, preserved: 0 });
    expect(summary.taskLists).toEqual({ detected: 2, preserved: 2 });
    expect(summary.tables).toEqual({ detected: 2, preserved: 2 });
    expect(summary.fencedCode).toEqual({ detected: 3, preserved: 3 });
    expect(summary.mermaidFence).toEqual({ detected: 2, preserved: 2 });
    expect(summary.mathFence).toEqual({ detected: 2, preserved: 2 });
    expect(summary.links).toEqual({ detected: 2, preserved: 2 });
    expect(summary.images).toEqual({ detected: 2, preserved: 2 });
  });

  it("summarizes properties-wrapped Milkdown preservation across the sample set", async () => {
    const reports = [];

    for (const sample of MARKDOWN_SAMPLE_NAMES) {
      reports.push(await analyzeMilkdownWithPropertiesRoundTrip(readSample(sample)));
    }

    const summary = summarizeMilkdownCanonicalReports(reports);

    expect(summary.frontmatter).toEqual({ detected: 2, preserved: 2 });
    expect(summary.taskLists).toEqual({ detected: 2, preserved: 2 });
    expect(summary.tables).toEqual({ detected: 2, preserved: 2 });
    expect(summary.fencedCode).toEqual({ detected: 3, preserved: 3 });
    expect(reports.every((report) => !report.exactRoundTrip)).toBe(true);
    expect(
      reports.every((report) => !report.normalization.categories.includes("other")),
    ).toBe(true);
  });
});
