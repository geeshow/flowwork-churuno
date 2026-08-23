/**
 * HTTP client for the Python web server (web-server/main.py).
 *
 * When the app is served by the Python server itself the API is same-origin;
 * when running on the rsbuild dev server the API lives on port 8008 by default.
 * A static deployment (GitHub Pages) has no server of its own, so the build
 * bakes one in through BRUNO_WEB_SERVER_URL — typically the reader's own
 * http://localhost:8008. `window.__BRUNO_WEB_SERVER_URL__` overrides all three.
 */

const resolveBaseUrl = () => {
  if (window.__BRUNO_WEB_SERVER_URL__) {
    return window.__BRUNO_WEB_SERVER_URL__.replace(/\/$/, '');
  }
  if (process.env.BRUNO_WEB_SERVER_URL) {
    return process.env.BRUNO_WEB_SERVER_URL.replace(/\/$/, '');
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
