import merge from 'lodash/merge';
import jsyaml from 'js-yaml';
import { handle, emit } from '../core';
import serverApi from '../server-api';
import webState, { registerCollection, getStableUid } from '../state';
import { parseCollection } from '../filestore';
import { getGlobalEnvironments } from './global-environments';
import { generateUidBasedOnHash } from 'utils/common';

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
    disabled: true,
    source: 'manual',
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
  beta: { 'openapi-sync': false },
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
  extras: { devTools: { open: false, activeTab: 'console', tabs: {} } },
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
    const preferences = merge({}, defaultPreferences, readJson(PREFERENCES_KEY) || {});
    // 예전 기본값('inherit')이 저장돼 있으면 Proxy 설정 폼의 Yup 스키마
    // (manual|pac만 허용)를 통과하지 못해 자동 저장이 조용히 무시된다.
    if (!['manual', 'pac'].includes(preferences.proxy?.source)) {
      preferences.proxy = { ...preferences.proxy, source: 'manual', disabled: true };
    }
    webState.preferences = preferences;
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

// 워크스페이스 문서는 데스크톱과 같은 workspace.yml(docs 키)로 worktree에 저장한다 —
// git으로 함께 동기화되고, GitHub에서도 그대로 읽힌다.
const readWorkspaceDocs = async (workspacePath) => {
  try {
    const pathname = `${workspacePath}/workspace.yml`;
    // 파일이 없는 게 정상 케이스(문서 미작성 워크스페이스)라 바로 read하면
    // 브라우저 콘솔에 404 fetch 에러가 찍힌다 — 존재 확인 후 읽는다.
    const { exists } = await serverApi.fsExists(pathname);
    if (!exists) return '';
    const { content } = await serverApi.fsRead(pathname);
    const config = jsyaml.load(content);
    return typeof config?.docs === 'string' ? config.docs : '';
  } catch (_error) {
    return '';
  }
};

const workspaceConfigFor = (name, type, collectionEntries, git = {}) => ({
  opencollection: '1.0.0',
  info: { name, type: 'workspace' },
  name,
  type,
  // 워크스페이스 = git 브랜치. parent는 분기 기준 브랜치(빈 브랜치로 만든 경우 null).
  branch: git.branch ?? null,
  parent: git.parent ?? null,
  branchUrl: git.branchUrl ?? null,
  docs: git.docs ?? '',
  collections: collectionEntries.map((entry) => ({ name: entry.brunoConfig.name, path: entry.pathname })),
  specs: [],
  apiSpecs: []
});

const registerBootHandlers = () => {
  handle('renderer:ready', async () => {
    emit('main:load-preferences', getPreferences());
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
        workspace.docs = await readWorkspaceDocs(workspace.pathname);
        const { collections } = await serverApi.listCollections(workspace.pathname);
        const entries = registerRemoteCollections(collections);
        allEntries.push(...entries);
        emit('main:workspace-opened', workspace.pathname, workspace.uid, workspaceConfigFor(workspace.name, workspace.type, entries, workspace));
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

    emit('main:load-global-environments', await getGlobalEnvironments(webState.activeWorkspacePath));

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
    emit('main:load-global-environments', await getGlobalEnvironments(workspacePath));
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
  // Workspace create/clone — the server creates a workspace/<name> branch + worktree
  const registerWorkspace = (workspace) => {
    const entry = { ...workspace, uid: getStableUid(workspace.pathname), type: 'workspace' };
    webState.workspaces.push(entry);
    return entry;
  };

  handle('renderer:create-workspace', async (workspaceName) => {
    const { workspace } = await serverApi.createWorkspace(workspaceName);
    const entry = registerWorkspace(workspace);
    return {
      workspaceUid: entry.uid,
      workspacePath: entry.pathname,
      workspaceConfig: workspaceConfigFor(entry.name, entry.type, [], entry)
    };
  });

  handle('renderer:close-workspace', async (workspacePath) => {
    const workspace = webState.workspaces.find((w) => w.pathname === workspacePath);
    if (!workspace) {
      throw new Error('Workspace not found');
    }
    // 웹 모드의 워크스페이스 = git 브랜치이므로 "닫기"가 아니라 브랜치 삭제다
    await serverApi.deleteWorkspace(workspace.name);
    webState.workspaces = webState.workspaces.filter((w) => w !== workspace);
  });

  handle('renderer:clone-workspace', async (sourceWorkspacePath, newName) => {
    const source = webState.workspaces.find((w) => w.pathname === sourceWorkspacePath);
    if (!source) {
      throw new Error('Source workspace not found');
    }
    const { workspace } = await serverApi.cloneWorkspace(source.name, newName);
    const entry = registerWorkspace(workspace);
    return {
      workspaceUid: entry.uid,
      workspacePath: entry.pathname,
      workspaceConfig: workspaceConfigFor(entry.name, entry.type, [], entry)
    };
  });

  handle('renderer:load-unopenable-workspace-collections', () => []);
  handle('renderer:load-workspace-apispecs', () => []);
  handle('renderer:get-last-opened-workspaces', () => []);
  handle('renderer:start-workspace-watcher', () => undefined);
  handle('renderer:set-collection-workspace', () => undefined);
  handle('renderer:save-workspace-docs', async (workspacePath, docs) => {
    const workspace = webState.workspaces.find((w) => w.pathname === workspacePath);
    let config;
    try {
      const { content } = await serverApi.fsRead(`${workspacePath}/workspace.yml`);
      config = jsyaml.load(content) || {};
    } catch (_error) {
      config = {
        opencollection: '1.0.0',
        info: { name: workspace?.name || workspacePath.split('/').filter(Boolean).pop(), type: 'workspace' }
      };
    }
    config.docs = docs || '';
    await serverApi.fsWrite(`${workspacePath}/workspace.yml`, jsyaml.dump(config));
    if (workspace) {
      workspace.docs = config.docs;
    }
    return config.docs;
  });

  // The workspace's collection list lives on the server (worktree subdirectories),
  // so a fresh config emit is enough — the renderer re-lists collections on
  // main:workspace-config-updated (loadWorkspaceCollections with force=true).
  handle('renderer:add-collection-to-workspace', async (workspacePath) => {
    const workspace = webState.workspaces.find((w) => w.pathname === workspacePath);
    if (!workspace) {
      return;
    }
    const { collections } = await serverApi.listCollections(workspacePath);
    const entries = registerRemoteCollections(collections);
    emit('main:workspace-config-updated', workspacePath, workspace.uid, workspaceConfigFor(workspace.name, workspace.type, entries, workspace));
  });
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
      scratch: true,
      // the renderer derives the scratch collection uid itself (mountScratchCollection),
      // so events we emit for scratch files must carry the same uid
      uid: generateUidBasedOnHash(scratchPath)
    });
    return scratchPath;
  });
  handle('renderer:add-collection-watcher', () => undefined);

  // Features without a web backend yet — resolve with inert values
  handle('usebruno:sqlite', () => undefined);
  handle('renderer:theme-change', () => undefined);
  handle('renderer:notifications-opened', () => undefined);
  handle('renderer:get-file-cache-size', () => 0);
  handle('renderer:clear-oauth2-cache', () => undefined);

  handle('renderer:window-is-fullscreen', () => false);
  handle('renderer:window-is-maximized', () => false);

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
