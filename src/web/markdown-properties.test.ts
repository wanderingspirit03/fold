import { describe, expect, it } from "vitest";

import { extractMarkdownProperties } from "../../apps/web/lib/markdown-properties.js";

describe("extractMarkdownProperties", () => {
  it("preserves duplicate frontmatter keys for display", () => {
    const parsed = extractMarkdownProperties(`---
title: First
title: Second
backgroundColor: #111
backgroundColor: #222
---

# Document
`);

    expect(parsed.properties).toEqual([
      { key: "title", value: "First" },
      { key: "title", value: "Second" },
      { key: "backgroundColor", value: "#111" },
      { key: "backgroundColor", value: "#222" },
    ]);
    expect(parsed.content).toBe("# Document\n");
  });
});
