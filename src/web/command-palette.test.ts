import { describe, expect, it } from "vitest";

import {
  getFirstEnabledIndex,
  getLastEnabledIndex,
  getNextEnabledIndex,
  rankCommandPaletteItems,
} from "../../apps/web/lib/command-palette.js";

describe("command palette keyboard navigation", () => {
  const items = [{}, { disabled: true }, {}, {}];

  it("finds enabled boundaries", () => {
    expect(getFirstEnabledIndex(items)).toBe(0);
    expect(getLastEnabledIndex(items)).toBe(3);
    expect(getFirstEnabledIndex([{ disabled: true }])).toBe(-1);
    expect(getLastEnabledIndex([{ disabled: true }])).toBe(-1);
  });

  it("skips disabled items while moving through results", () => {
    expect(getNextEnabledIndex(items, 0, 1)).toBe(2);
    expect(getNextEnabledIndex(items, 2, -1)).toBe(0);
  });

  it("wraps at list edges", () => {
    expect(getNextEnabledIndex(items, 3, 1)).toBe(0);
    expect(getNextEnabledIndex(items, 0, -1)).toBe(3);
  });

  it("handles empty and fully disabled result sets", () => {
    expect(getNextEnabledIndex([], 0, 1)).toBe(-1);
    expect(getNextEnabledIndex([{ disabled: true }], 0, 1)).toBe(-1);
  });

  it("lets exact command matches outrank fuzzy file matches", () => {
    const ranked = rankCommandPaletteItems(
      [
        { label: "agent-handoff-review.md", searchText: "reports/agent-handoff-review.md" },
        { label: "Copy invite link", searchText: "copy project link share invite human encrypted room url" },
      ],
      "invite",
    );

    expect(ranked[0]?.label).toBe("Copy invite link");
  });
});
