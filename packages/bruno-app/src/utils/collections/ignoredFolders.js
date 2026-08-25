// ignore entries that were never folders hidden from the sidebar: package/git
// housekeeping, and this fork's workflows dir (API Chain data, not requests).
const HOUSEKEEPING = new Set(['node_modules', '.git', 'workflows']);

export const getIgnoredFolderEntries = (collection) =>
  (collection?.brunoConfig?.ignore || []).filter((entry) => !HOUSEKEEPING.has(entry));
