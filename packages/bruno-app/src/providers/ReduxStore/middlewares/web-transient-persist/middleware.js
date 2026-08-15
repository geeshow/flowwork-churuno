/**
 * Web-mode only: keeps a transient request's backing file in sync with its
 * draft, so an unsaved request survives a page reload. The browser has no
 * process lifetime beyond the tab — without this, everything typed into a
 * transient request is lost on refresh.
 *
 * Debounced writes go through `renderer:web:persist-transient-draft`, which
 * writes the file without emitting a change event (an event would clobber the
 * draft being edited).
 */

import { flattenItems, isItemARequest, transformRequestToSaveToFilesystem } from 'utils/collections';

const DEBOUNCE_MS = 800;

const { ipcRenderer } = window;

let persistTimer = null;
const lastPersistedByPathname = new Map();

const persistTransientDrafts = (getState) => {
  const state = getState();
  const { collections, tempDirectories } = state.collections;
  const openTabUids = new Set((state.tabs?.tabs || []).map((tab) => tab.uid));

  (collections || []).forEach((collection) => {
    const tempDirectory = tempDirectories?.[collection.uid];
    if (!tempDirectory) return;

    flattenItems(collection.items)
      .filter((item) => isItemARequest(item) && item.draft && item.pathname?.startsWith(tempDirectory)
        // a closed transient's file was just deleted — persisting would resurrect it
        && openTabUids.has(item.uid))
      .forEach((item) => {
        let transformed;
        try {
          transformed = transformRequestToSaveToFilesystem({ ...item, ...item.draft });
        } catch (_error) {
          return;
        }
        const serialized = JSON.stringify(transformed);
        const cacheKey = `${item.uid}:${item.pathname}`;
        if (lastPersistedByPathname.get(cacheKey) === serialized) {
          return;
        }
        lastPersistedByPathname.set(cacheKey, serialized);
        ipcRenderer
          .invoke('renderer:web:persist-transient-draft', {
            pathname: item.pathname,
            request: transformed,
            format: collection.format
          })
          .catch((error) => console.error('Failed to persist transient draft:', error));
      });
  });
};

export const webTransientPersistMiddleware = ({ getState }) => (next) => (action) => {
  const result = next(action);

  if (typeof action?.type === 'string' && action.type.startsWith('collections/')) {
    if (persistTimer) {
      clearTimeout(persistTimer);
    }
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persistTransientDrafts(getState);
    }, DEBOUNCE_MS);
  }

  return result;
};

export default webTransientPersistMiddleware;
