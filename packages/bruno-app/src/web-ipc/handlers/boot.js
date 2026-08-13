import merge from 'lodash/merge';
import { handle, emit } from '../core';
import serverApi from '../server-api';
import webState, { registerCollection, getStableUid } from '../state';
import { parseCollection } from '../filestore';

const PREFERENCES_KEY = 'bruno-web:preferences';
const SNAPSHOT_KEY = 'bruno-web:snapshot';

// Mirrors bruno-electron/src/store/preferences.js defaultPreferences, with the
// onboarding flags set so neither the welcome modal nor the changelog tab open.
const defaultPreferences = {
  request: {
    sslVerification: true,
    customCaCertificate: { enabled: false, filePath: null },
    keepDefaultCaCertificates: { enabled: true },
    storeCookies: true,
    sendCookies: true,
    timeout: 0,
    oauth2: { useSystemBrowser: false },
    clientCertificates: { certs: [] }
  },
  font: { codeFont: 'default', codeFontSize: 13 },
  proxy: {
    source: 'inherit',
    pac: { source: '' },
    config: {
      protocol: 'http',
      hostname: '',
      port: null,
      auth: { username: '', password: '' },
      bypassProxy: ''
    }
  },
  layout: { responsePaneOrientation: 'horizontal' },
  mockServer: { mode: 'isolated', instances: [] },
  beta: { 'openapi-sync': false, 'mock-server': false },
  onboarding: { hasLaunchedBefore: true, hasSeenWelcomeModal: true, lastSeenVersion: '99.99.99' },
  general: { defaultLocation: '', defaultWorkspacePath: '' },
  autoSave: { enabled: false, interval: 1000 },
  display: { zoomPercentage: 100 },
  cache: { sslSession: { enabled: false }, file: { enabled: false } },
  ai: {
    enabled: false,
    providers: { openai: { enabled: false }, anthropic: { enabled: false } },
    models: {},
    defaultModel: '',
    openaiCompatibleEndpoints: [],
    autocomplete: { enabled: false, model: '', triggerMode: 'debounced' },
    security: {
      redactHeaders: true,
      redactBody: true,
      redactVariables: true,
      redactResponse: true,
      customRedactedHeaders: [],
      customRedactedVariables: []
    }
  }
};

const emptySnapshot = () => ({
  version: '0.0.1',
  activeWorkspacePath: null,
  extras: { devTools: { open: false, activeTab: 'terminal', tabs: {} } },
  workspaces: [],
  collections: []
});

const readJson = (key) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
};

const writeJson = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`[web-ipc] failed to persist ${key}`, error);
  }
};

const getPreferences = () => {
  if (!webState.preferences) {
    webState.preferences = merge({}, defaultPreferences, readJson(PREFERENCES_KEY) || {});
  }
  return webState.preferences;
};

const loadSnapshot = () => readJson(SNAPSHOT_KEY) || emptySnapshot();

const buildBrunoConfig = (remote, fallbackName) => {
  if (remote.format === 'bru') {
    try {
      const config = JSON.parse(remote.content);
      return { version: '1', type: 'collection', ignore: ['node_modules', '.git'], ...config };
    } catch (_error) {
      return { version: '1', name: fallbackName, type: 'collection', ignore: ['node_modules', '.git'] };
    }
  }
  let name = fallbackName;
  try {
    const parsed = parseCollection(remote.content, { format: 'yml' });
    name = parsed?.brunoConfig?.name || parsed?.meta?.name || parsed?.name || fallbackName;
  } catch (_error) {
    // fall back to the directory name
  }
  return { opencollection: '1.0.0', name, type: 'collection', ignore: ['node_modules', '.git'] };
};

const registerRemoteCollections = (collections) => {
  return collections.map((remote) => {
    const dirName = remote.pathname.split('/').filter(Boolean).pop();
    const brunoConfig = buildBrunoConfig(remote, dirName);
    return registerCollection({ pathname: remote.pathname, format: remote.format, brunoConfig });
  });
};

const workspaceConfigFor = (name, type, collectionEntries) => ({
  opencollection: '1.0.0',
  info: { name, type: 'workspace' },
  name,
  type,
  docs: '',
  collections: collectionEntries.map((entry) => ({ name: entry.brunoConfig.name, path: entry.pathname })),
  specs: [],
  apiSpecs: []
});

const registerBootHandlers = () => {
  handle('renderer:ready', async () => {
    emit('main:load-preferences', getPreferences());
    emit('main:load-global-environments', { globalEnvironments: [], activeGlobalEnvironmentUid: null });
    emit('main:git-version', null);

    const { workspaces = [], scratchRoot } = await serverApi.listWorkspaces().catch(() => ({}));
    webState.scratchRoot = scratchRoot || null;

    const allEntries = [];
    if (workspaces.length) {
      // git mode — one workspace per workspace/* branch worktree
      webState.workspaces = workspaces.map((workspace, index) => ({
        ...workspace,
        uid: index === 0 ? 'default' : getStableUid(workspace.pathname),
        type: index === 0 ? 'default' : 'workspace'
      }));
      webState.serverRoot = webState.workspaces[0].pathname;
      webState.activeWorkspacePath = webState.workspaces[0].pathname;

      for (const workspace of webState.workspaces) {
        const { collections } = await serverApi.listCollections(workspace.pathname);
        const entries = registerRemoteCollections(collections);
        allEntries.push(...entries);
        emit('main:workspace-opened', workspace.pathname, workspace.uid, workspaceConfigFor(workspace.name, workspace.type, entries));
      }
    } else {
      // legacy mode — a single workspace over the flat collections directory
      const { root, collections } = await serverApi.listCollections();
      webState.serverRoot = root;
      webState.activeWorkspacePath = root;
      const entries = registerRemoteCollections(collections);
      allEntries.push(...entries);
      emit('main:workspace-opened', root, 'default', workspaceConfigFor('My Workspace', 'default', entries));
    }

    emit('main:workspaces-ready');

    allEntries.forEach((entry) => {
      emit('main:collection-opened', entry.pathname, entry.uid, entry.brunoConfig, { silent: true });
    });

    emit('main:app-loaded', { isRunningInRosetta: false });
  });

  handle('renderer:save-preferences', (preferences) => {
    webState.preferences = merge({}, defaultPreferences, preferences);
    writeJson(PREFERENCES_KEY, webState.preferences);
    emit('main:load-preferences', webState.preferences);
  });

  // UI-state snapshot, persisted in localStorage instead of electron-store
  handle('renderer:snapshot:get', () => loadSnapshot());
  handle('renderer:snapshot:save', (data) => {
    writeJson(SNAPSHOT_KEY, { version: '0.0.1', ...data });
    return true;
  });
  handle('renderer:snapshot:get-sidebar', () => loadSnapshot().extras?.sidebar ?? null);
  handle('renderer:snapshot:get-tabs', (collectionPathname) => {
    const entry = loadSnapshot().collections?.find((c) => c.pathname === collectionPathname);
    return entry ? { activeTab: entry.activeTab ?? null, tabs: entry.tabs ?? [] } : null;
  });
  handle('renderer:snapshot:get-collection', (collectionPathname) => {
    return loadSnapshot().collections?.find((c) => c.pathname === collectionPathname) ?? null;
  });
  handle('renderer:update-ui-state-snapshot', () => undefined);

  // Workspace plumbing — one workspace per git worktree (or the legacy root)
  handle('renderer:load-workspace-collections', async (workspacePath) => {
    const workspace = webState.workspaces.find((w) => w.pathname === workspacePath);
    if (!workspace) {
      return [...webState.collections.values()]
        .filter((entry) => !entry.scratch)
        .map((entry) => ({ name: entry.brunoConfig.name, path: entry.pathname }));
    }

    webState.activeWorkspacePath = workspacePath;
    const { collections } = await serverApi.listCollections(workspacePath);
    return collections.map((remote) => {
      let entry = webState.collections.get(remote.pathname);
      if (!entry) {
        const dirName = remote.pathname.split('/').filter(Boolean).pop();
        entry = registerCollection({
          pathname: remote.pathname,
          format: remote.format,
          brunoConfig: buildBrunoConfig(remote, dirName)
        });
        emit('main:collection-opened', entry.pathname, entry.uid, entry.brunoConfig, { silent: true });
      }
      return { name: entry.brunoConfig.name, path: entry.pathname };
    });
  });
  handle('renderer:load-unopenable-workspace-collections', () => []);
  handle('renderer:load-workspace-apispecs', () => []);
  handle('renderer:get-last-opened-workspaces', () => []);
  handle('renderer:start-workspace-watcher', () => undefined);
  handle('renderer:set-collection-workspace', () => undefined);
  handle('renderer:add-collection-to-workspace', () => undefined);
  handle('renderer:remove-collection-from-workspace', () => undefined);
  handle('renderer:get-collection-security-config', () => ({}));
  handle('renderer:save-collection-security-config', () => undefined);
  handle('renderer:mount-workspace-scratch', async ({ workspacePath } = {}) => {
    const workspace = webState.workspaces.find((w) => w.pathname === workspacePath);
    const scratchPath = webState.scratchRoot
      ? `${webState.scratchRoot}/${workspace?.name || 'default'}`
      : `${webState.serverRoot}/.scratch`;
    await serverApi.fsMkdir(scratchPath);
    registerCollection({
      pathname: scratchPath,
      format: 'yml',
      brunoConfig: { opencollection: '1.0.0', name: 'Scratch', type: 'collection', ignore: [] },
      scratch: true
    });
    return scratchPath;
  });
  handle('renderer:add-collection-watcher', () => undefined);

  // Features without a web backend yet — resolve with inert values
  handle('renderer:get-global-environments', () => ({ globalEnvironments: [], activeGlobalEnvironmentUid: null }));
  handle('renderer:mock-server-get-running', () => []);
  handle('renderer:mock-server-list-instances', () => ({ success: true, instances: [] }));
  handle('usebruno:sqlite', () => undefined);
  handle('renderer:theme-change', () => undefined);
  handle('renderer:notifications-opened', () => undefined);
  handle('renderer:get-file-cache-size', () => 0);
  handle('renderer:clear-oauth2-cache', () => undefined);
  handle('renderer:get-system-proxy-variables', () => ({}));

  handle('renderer:window-is-fullscreen', () => false);
  handle('renderer:window-is-maximized', () => false);

  // Devtools terminal — no pty in the browser; return inert values so the
  // console panel renders an empty state instead of crashing
  handle('terminal:list-sessions', () => []);
  handle('terminal:create', () => null);
  handle('terminal:input', () => undefined);
  handle('terminal:resize', () => undefined);
  handle('terminal:kill', () => undefined);
  handle('terminal:open-at-cwd', () => null);
  handle('renderer:start-system-monitoring', () => undefined);
  handle('renderer:stop-system-monitoring', () => undefined);

  handle('renderer:browse-directory', () => webState.activeWorkspacePath || webState.serverRoot);
  handle('renderer:exists-sync', async (pathname) => {
    const { exists } = await serverApi.fsExists(pathname);
    return exists;
  });
  handle('renderer:is-directory', async (pathname) => {
    const { isDirectory } = await serverApi.fsExists(pathname);
    return isDirectory;
  });
};

export { getPreferences, getStableUid };
export default registerBootHandlers;
