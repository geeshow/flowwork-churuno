/**
 * HTTP client for the Python web server (web-server/main.py).
 *
 * Where the server lives, in order of precedence:
 *   1. `window.__BRUNO_WEB_SERVER_URL__` (set by the host page)
 *   2. `?server=<url>` on the page URL — stored, then the param is dropped
 *   3. the address the user saved in this browser (localStorage)
 *   4. BRUNO_WEB_SERVER_URL baked in at build time (static deployments)
 *   5. the rsbuild dev server's convention: same host, port 8008
 *   6. same origin — the Python server serving the app itself
 * A static deployment (GitHub Pages) has no server of its own and the proxy /
 * AI server may run anywhere, so 2–3 let the reader point the app at theirs.
 */

const SERVER_URL_KEY = 'bruno-web:server-url';

const trimSlash = (url) => String(url).trim().replace(/\/+$/, '');

const readStoredServerUrl = () => {
  try {
    return window.localStorage.getItem(SERVER_URL_KEY) || '';
  } catch (_error) {
    return '';
  }
};

/** Persist the server address for this browser and reload so every module picks it up. */
export const setServerBaseUrl = (url) => {
  const value = trimSlash(url);
  if (value) {
    window.localStorage.setItem(SERVER_URL_KEY, value);
  } else {
    window.localStorage.removeItem(SERVER_URL_KEY);
  }
  window.location.reload();
};

const takeServerUrlFromQuery = () => {
  const params = new URLSearchParams(window.location.search);
  const url = params.get('server');
  if (!url) return '';
  params.delete('server');
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  try {
    window.localStorage.setItem(SERVER_URL_KEY, trimSlash(url));
  } catch (_error) {
    // private mode without storage — still use it for this page load
  }
  return trimSlash(url);
};

const resolveBaseUrl = () => {
  if (window.__BRUNO_WEB_SERVER_URL__) {
    return trimSlash(window.__BRUNO_WEB_SERVER_URL__);
  }
  const fromQuery = takeServerUrlFromQuery();
  if (fromQuery) return fromQuery;
  const stored = readStoredServerUrl();
  if (stored) return stored;
  if (process.env.BRUNO_WEB_SERVER_URL) {
    return trimSlash(process.env.BRUNO_WEB_SERVER_URL);
  }
  const port = window.location.port;
  if (port && port !== '8008') {
    return `${window.location.protocol}//${window.location.hostname}:8008`;
  }
  return '';
};

export const serverBaseUrl = resolveBaseUrl();
const baseUrl = serverBaseUrl;

const request = async (path, options = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch (_ignored) {
      // non-JSON error body — keep statusText
    }
    throw new Error(`bruno web server: ${detail}`);
  }
  return res.json();
};

const get = (path, params) => {
  const query = params ? `?${new URLSearchParams(params)}` : '';
  return request(`${path}${query}`);
};

const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });

const serverApi = {
  health: () => get('/api/health'),
  fsRoot: () => get('/api/fs/root'),
  listWorkspaces: () => get('/api/workspaces'),
  createWorkspace: (name) => post('/api/workspaces', { name }),
  cloneWorkspace: (source, name) => post('/api/workspaces/clone', { source, name }),
  deleteWorkspace: (name) => request(`/api/workspaces/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  workspacePendingChanges: (name) => get(`/api/workspaces/${encodeURIComponent(name)}/pending-changes`),
  workspaceReleaseChanges: (name, paths) => post(`/api/workspaces/${encodeURIComponent(name)}/release-changes`, { paths }),
  workspaceRevertChanges: (name, paths) => post(`/api/workspaces/${encodeURIComponent(name)}/revert-changes`, { paths }),
  workspaceChangeDiff: (name, path) => get(`/api/workspaces/${encodeURIComponent(name)}/change-diff`, { path }),
  workspaceIgnoreChanges: (name, paths, ignored) =>
    post(`/api/workspaces/${encodeURIComponent(name)}/ignore-changes`, { paths, ignored }),
  listCollections: (root) => get('/api/collections', root ? { root } : undefined),
  fsTree: (path) => get('/api/fs/tree', { path }),
  // tree plus the contents of every .bru/.yml under it — one round trip per mount
  fsCollection: (path) => get('/api/fs/collection', { path }),
  fsRead: (path) => get('/api/fs/read', { path }),
  fsExists: (path) => get('/api/fs/exists', { path }),
  fsWrite: (path, content) => post('/api/fs/write', { path, content }),
  fsMkdir: (path) => post('/api/fs/mkdir', { path }),
  fsRename: (oldPath, newPath) => post('/api/fs/rename', { oldPath, newPath }),
  fsDelete: (path) => post('/api/fs/delete', { path }),
  executeHttpRequest: (payload, { signal } = {}) =>
    request('/api/http/execute', { method: 'POST', body: JSON.stringify(payload), signal })
};

export default serverApi;
