export type CommandPaletteNavigableItem = {
  disabled?: boolean;
};

export type CommandPaletteRankableItem = {
  label: string;
  detail?: string;
  searchText?: string;
};

export function getFirstEnabledIndex(items: CommandPaletteNavigableItem[]) {
  return items.findIndex((item) => !item.disabled);
}

export function getLastEnabledIndex(items: CommandPaletteNavigableItem[]) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (!items[index]?.disabled) return index;
  }
  return -1;
}

export function getNextEnabledIndex(
  items: CommandPaletteNavigableItem[],
  currentIndex: number,
  direction: 1 | -1,
) {
  if (items.length === 0) return -1;

  const firstEnabledIndex = getFirstEnabledIndex(items);
  if (firstEnabledIndex === -1) return -1;

  const boundedIndex = currentIndex >= 0 && currentIndex < items.length ? currentIndex : firstEnabledIndex;
  for (let step = 1; step <= items.length; step += 1) {
    const nextIndex = (boundedIndex + direction * step + items.length) % items.length;
    if (!items[nextIndex]?.disabled) return nextIndex;
  }

  return firstEnabledIndex;
}

export function rankCommandPaletteItems<T extends CommandPaletteRankableItem>(items: T[], query: string) {
  return items
    .map((item) => ({ item, score: commandPaletteMatchScore(item, query) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.item.label.localeCompare(right.item.label))
    .map(({ item }) => item);
}

function commandPaletteMatchScore(item: CommandPaletteRankableItem, query: string) {
  const label = item.label.toLowerCase();
  const detail = (item.detail || "").toLowerCase();
  const searchText = (item.searchText || "").toLowerCase();
  const haystack = `${label} ${detail} ${searchText}`.trim();
  const pathSegments = searchText.split("/").filter(Boolean);

  if (label === query || searchText === query) return 100;
  if (label.startsWith(query)) return 90;
  if (searchText.startsWith(query)) return 86;
  if (pathSegments.some((segment) => segment.startsWith(query))) return 78;
  if (label.includes(query)) return 70;
  if (searchText.includes(query) || detail.includes(query)) return 64;

  const compactQuery = query.replace(/[\s/_-]+/g, "");
  const compactHaystack = haystack.replace(/[\s/_-]+/g, "");
  if (compactQuery.length >= 2 && compactHaystack.includes(compactQuery)) return 56;
  if (compactQuery.length >= 3 && isSubsequence(compactQuery, compactHaystack)) return 42;
  return 0;
}

export function isSubsequence(needle: string, haystack: string) {
  let cursor = 0;
  for (const char of haystack) {
    if (char !== needle[cursor]) continue;
    cursor += 1;
    if (cursor === needle.length) return true;
  }
  return false;
}
