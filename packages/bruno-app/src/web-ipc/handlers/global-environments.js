/**
 * Workspace (global) environments, persisted as `<workspacePath>/environments/*.yml`
 * through the server fs API — the same on-disk layout bruno-electron's
 * GlobalEnvironmentsManager uses, so worktree workspaces carry their
 * environments in git alongside the collections.
 *
 * The active-environment selection is remembered per workspace in localStorage
 * by environment *name*, because uids from getStableUid only live for one session.
 */
import { handle } from '../core';
import serverApi from '../server-api';
import { getStableUid } from '../state';
import { parseEnvironment, stringifyEnvironment } from '../filestore';
import { uuid } from 'utils/common';

const ENV_FILE_EXTENSION = '.yml';
const ACTIVE_ENVIRONMENTS_KEY = 'bruno-web:active-global-environments';

const readActiveByWorkspace = () => {
  try {
    return JSON.parse(window.localStorage.getItem(ACTIVE_ENVIRONMENTS_KEY)) || {};
  } catch (_error) {
    return {};
  }
};

const writeActiveByWorkspace = (activeByWorkspace) => {
  window.localStorage.setItem(ACTIVE_ENVIRONMENTS_KEY, JSON.stringify(activeByWorkspace));
};

const setActiveEnvironmentName = (workspacePath, name) => {
  const activeByWorkspace = readActiveByWorkspace();
  if (name) {
    activeByWorkspace[workspacePath] = name;
  } else {
    delete activeByWorkspace[workspacePath];
  }
  writeActiveByWorkspace(activeByWorkspace);
};

const environmentsDirFor = (workspacePath) => `${workspacePath}/environments`;

const environmentFilePathFor = (workspacePath, name) =>
  `${environmentsDirFor(workspacePath)}/${name}${ENV_FILE_EXTENSION}`;

const environmentNameOf = (fileName) => fileName.slice(0, -ENV_FILE_EXTENSION.length);

const listEnvironmentFiles = async (workspacePath) => {
  const dir = environmentsDirFor(workspacePath);
  const { exists, isDirectory } = await serverApi.fsExists(dir);
  if (!exists || !isDirectory) {
    return [];
  }
  const tree = await serverApi.fsTree(dir);
  return (tree.children || []).filter((child) => child.type === 'file' && child.name.endsWith(ENV_FILE_EXTENSION));
};

const parseEnvironmentFile = async (file) => {
  const { content } = await serverApi.fsRead(file.pathname);
  const environment = await parseEnvironment(content, { format: 'yml' });
  environment.name = environmentNameOf(file.name);
  environment.uid = getStableUid(file.pathname);
  (environment.variables || []).forEach((variable) => {
    if (!variable.uid) {
      variable.uid = uuid();
    }
  });
  return environment;
};

const getGlobalEnvironments = async (workspacePath) => {
  if (!workspacePath) {
    return { globalEnvironments: [], activeGlobalEnvironmentUid: null };
  }

  const globalEnvironments = [];
  for (const file of await listEnvironmentFiles(workspacePath)) {
    try {
      globalEnvironments.push(await parseEnvironmentFile(file));
    } catch (error) {
      console.error(`[web-ipc] failed to parse environment ${file.pathname}`, error);
    }
  }

  const activeName = readActiveByWorkspace()[workspacePath];
  const activeEnvironment = activeName ? globalEnvironments.find((env) => env.name === activeName) : null;
  return { globalEnvironments, activeGlobalEnvironmentUid: activeEnvironment?.uid ?? null };
};

const findEnvironmentFileByUid = async (workspacePath, environmentUid) => {
  const files = await listEnvironmentFiles(workspacePath);
  return files.find((file) => getStableUid(file.pathname) === environmentUid) ?? null;
};

const writeEnvironmentFile = async (filePath, environment) => {
  const content = await stringifyEnvironment(environment, { format: 'yml' });
  await serverApi.fsWrite(filePath, content);
};

const registerGlobalEnvironmentHandlers = () => {
  handle('renderer:get-global-environments', ({ workspacePath } = {}) => getGlobalEnvironments(workspacePath));

  handle('renderer:create-global-environment', async ({ name, variables = [], color, workspacePath }) => {
    if (!workspacePath) {
      throw new Error('Workspace path is required');
    }
    const filePath = environmentFilePathFor(workspacePath, name);
    const { exists } = await serverApi.fsExists(filePath);
    if (exists) {
      throw new Error(`Environment "${name}" already exists`);
    }
    await writeEnvironmentFile(filePath, { name, variables, color });
    return { uid: getStableUid(filePath), name, variables, color };
  });

  handle('renderer:save-global-environment', async ({ environmentUid, variables, color, workspacePath }) => {
    const file = await findEnvironmentFileByUid(workspacePath, environmentUid);
    if (!file) {
      throw new Error(`Environment file not found for uid: ${environmentUid}`);
    }
    const environment = { name: environmentNameOf(file.name), variables };
    if (color) {
      environment.color = color;
    }
    await writeEnvironmentFile(file.pathname, environment);
    return true;
  });

  handle('renderer:rename-global-environment', async ({ name: newName, environmentUid, workspacePath }) => {
    const file = await findEnvironmentFileByUid(workspacePath, environmentUid);
    if (!file) {
      throw new Error(`Environment file not found for uid: ${environmentUid}`);
    }
    const newFilePath = environmentFilePathFor(workspacePath, newName);
    if (newFilePath !== file.pathname) {
      const { exists } = await serverApi.fsExists(newFilePath);
      if (exists) {
        throw new Error(`Environment "${newName}" already exists`);
      }
    }

    const environment = await parseEnvironmentFile(file);
    const oldName = environment.name;
    environment.name = newName;
    await writeEnvironmentFile(newFilePath, environment);
    if (newFilePath !== file.pathname) {
      await serverApi.fsDelete(file.pathname);
    }

    if (readActiveByWorkspace()[workspacePath] === oldName) {
      setActiveEnvironmentName(workspacePath, newName);
    }
    return { uid: getStableUid(newFilePath), name: newName };
  });

  handle('renderer:delete-global-environment', async ({ environmentUid, workspacePath }) => {
    const file = await findEnvironmentFileByUid(workspacePath, environmentUid);
    if (!file) {
      throw new Error(`Environment file not found for uid: ${environmentUid}`);
    }
    await serverApi.fsDelete(file.pathname);
    if (readActiveByWorkspace()[workspacePath] === environmentNameOf(file.name)) {
      setActiveEnvironmentName(workspacePath, null);
    }
    return true;
  });

  handle('renderer:select-global-environment', async ({ environmentUid, workspacePath }) => {
    if (!environmentUid) {
      setActiveEnvironmentName(workspacePath, null);
      return true;
    }
    const file = await findEnvironmentFileByUid(workspacePath, environmentUid);
    if (!file) {
      throw new Error(`Environment file not found for uid: ${environmentUid}`);
    }
    setActiveEnvironmentName(workspacePath, environmentNameOf(file.name));
    return true;
  });

  handle('renderer:update-global-environment-color', async ({ environmentUid, color, workspacePath }) => {
    const file = await findEnvironmentFileByUid(workspacePath, environmentUid);
    if (!file) {
      throw new Error(`Environment file not found for uid: ${environmentUid}`);
    }
    const environment = await parseEnvironmentFile(file);
    environment.color = color;
    await writeEnvironmentFile(file.pathname, environment);
    return true;
  });
};

export { getGlobalEnvironments };
export default registerGlobalEnvironmentHandlers;
