import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyzeMarkdownCanonicalRoundTrip,
  createMarkdownCanonicalDocument,
  serializeMarkdownCanonical,
  syncMarkdownCanonicalDocuments,
} from "./markdown-canonical.js";

const sampleDir = join(import.meta.dirname, "samples");
const samples = ["agent-plan.md", "code-report.md", "rich-agent-output.md"];

function readSample(name: string): string {
  return readFileSync(join(sampleDir, name), "utf8");
}

describe("markdown-canonical document model", () => {
  it("stores Markdown as the canonical document text", () => {
    const markdown = readSample("agent-plan.md");
    const doc = createMarkdownCanonicalDocument(markdown);

    try {
      expect(doc.text).toBe(markdown);
      expect(serializeMarkdownCanonical(doc)).toBe(markdown);
    } finally {
      doc.destroy();
    }
  });

  it("round-trips every sample byte-for-byte", () => {
    for (const sample of samples) {
      const markdown = readSample(sample);
      const report = analyzeMarkdownCanonicalRoundTrip(markdown);

      expect(report.exactRoundTrip, sample).toBe(true);
      expect(report.output).toBe(markdown);
      expect(report.lostFeatureNames, sample).toEqual([]);
    }
  });

  it("keeps frontmatter and task-list markers intact", () => {
    const report = analyzeMarkdownCanonicalRoundTrip(readSample("agent-plan.md"));

    expect(report.detectedFeatureNames).toContain("frontmatter");
    expect(report.detectedFeatureNames).toContain("taskLists");
    expect(report.preservedFeatureNames).toContain("frontmatter");
    expect(report.preservedFeatureNames).toContain("taskLists");
  });

  it("keeps tables and code fences intact", () => {
    const report = analyzeMarkdownCanonicalRoundTrip(readSample("code-report.md"));

    expect(report.detectedFeatureNames).toContain("tables");
    expect(report.detectedFeatureNames).toContain("fencedCode");
    expect(report.detectedFeatureNames).toContain("inlineCode");
    expect(report.preservedFeatureNames).toEqual(report.detectedFeatureNames);
  });

  it("keeps Mermaid, math, links, and images intact", () => {
    const report = analyzeMarkdownCanonicalRoundTrip(
      readSample("rich-agent-output.md"),
    );

    expect(report.detectedFeatureNames).toContain("mermaidFence");
    expect(report.detectedFeatureNames).toContain("mathFence");
    expect(report.detectedFeatureNames).toContain("inlineMath");
    expect(report.detectedFeatureNames).toContain("links");
    expect(report.detectedFeatureNames).toContain("images");
    expect(report.preservedFeatureNames).toEqual(report.detectedFeatureNames);
  });

  it("converges after independent collaborative text edits", () => {
    const initialMarkdown = readSample("code-report.md");
    const alice = createMarkdownCanonicalDocument(initialMarkdown);
    const bob = createMarkdownCanonicalDocument("");

    try {
      syncMarkdownCanonicalDocuments(alice, bob);

      alice.insert(alice.text.length, "\n\nAlice note: Markdown remains canonical.");
      bob.insert(0, "Bob note: comments need separate anchoring.\n\n");
      syncMarkdownCanonicalDocuments(alice, bob);

      expect(alice.text).toBe(bob.text);
      expect(alice.text).toContain(initialMarkdown);
      expect(alice.text).toContain("Alice note: Markdown remains canonical.");
      expect(alice.text).toContain("Bob note: comments need separate anchoring.");
    } finally {
      alice.destroy();
      bob.destroy();
    }
  });
});
