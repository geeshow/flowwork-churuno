/**
 * In-memory stand-in for electron-store in unit tests. The real package is
 * ESM-only (v9+), which Jest's CommonJS runtime can't load, and tests never
 * wanted files on disk anyway. Dot-path keys behave like electron-store's.
 * Deliberately dependency-free — some specs mock lodash.
 */
const clone = (value) => (value === undefined ? value : JSON.parse(JSON.stringify(value)));
const segments = (key) => String(key).split('.');

const getPath = (obj, key) => segments(key).reduce((acc, part) => (acc === undefined || acc === null ? undefined : acc[part]), obj);

const setPath = (obj, key, value) => {
  const parts = segments(key);
  let cursor = obj;
  parts.slice(0, -1).forEach((part) => {
    if (cursor[part] === undefined || cursor[part] === null || typeof cursor[part] !== 'object') cursor[part] = {};
    cursor = cursor[part];
  });
  cursor[parts[parts.length - 1]] = value;
};

const deletePath = (obj, key) => {
  const parts = segments(key);
  const parent = parts.length > 1 ? getPath(obj, parts.slice(0, -1).join('.')) : obj;
  if (parent && typeof parent === 'object') delete parent[parts[parts.length - 1]];
};

class Store {
  constructor(options = {}) {
    this.defaults = clone(options.defaults || {});
    this.data = clone(this.defaults);
    this.path = `/mock/${options.name || 'config'}.json`;
  }

  get(key, defaultValue) {
    const value = getPath(this.data, key);
    return value === undefined ? defaultValue : value;
  }

  set(key, value) {
    if (typeof key === 'object' && key !== null) {
      Object.entries(key).forEach(([k, v]) => setPath(this.data, k, v));
      return;
    }
    setPath(this.data, key, value);
  }

  has(key) {
    return getPath(this.data, key) !== undefined;
  }

  delete(key) {
    deletePath(this.data, key);
  }

  clear() {
    this.data = clone(this.defaults);
  }

  get store() {
    return clone(this.data);
  }

  set store(value) {
    this.data = clone(value || {});
  }

  onDidChange() {
    return () => {};
  }

  onDidAnyChange() {
    return () => {};
  }
}

module.exports = Store;
