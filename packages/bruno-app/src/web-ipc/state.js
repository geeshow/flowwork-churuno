import { uuid } from 'utils/common';

const state = {
  serverRoot: null,
  preferences: null,
  collections: new Map(),
  workspaces: [],
  activeWorkspacePath: null,
  scratchRoot: null
};

const uidByKey = new Map();

/** Stable uid per pathname so re-parses upsert instead of duplicating items. */
export const getStableUid = (key) => {
  if (!uidByKey.has(key)) {
    uidByKey.set(key, uuid());
  }
  return uidByKey.get(key);
};

export const registerCollection = ({ pathname, format, brunoConfig, scratch = false }) => {
  const entry = { uid: getStableUid(pathname), pathname, format, brunoConfig, scratch };
  state.collections.set(pathname, entry);
  return entry;
};

export const findCollectionForPath = (pathname) => {
  let best = null;
  for (const entry of state.collections.values()) {
    if (pathname === entry.pathname || pathname.startsWith(`${entry.pathname}/`)) {
      if (!best || entry.pathname.length > best.pathname.length) {
        best = entry;
      }
    }
  }
  return best;
};

export default state;
