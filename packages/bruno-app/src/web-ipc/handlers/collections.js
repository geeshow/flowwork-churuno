import get from 'lodash/get';
import { uuid } from 'utils/common';
import { transformRequestToSaveToFilesystem } from 'utils/collections/index';
import { handle, emit } from '../core';
import serverApi from '../server-api';
import webState, { registerCollection, findCollectionForPath, getStableUid } from '../state';
import {
  parseRequest,
  stringifyRequest,
  parseCollection,
  stringifyCollection,
  parseFolder,
  stringifyFolder,
  parseEnvironment,
  stringifyEnvironment,
  formatForFile
} from '../filestore';

const basename = (pathname) => pathname.split('/').filter(Boolean).pop() || '';

const ROOT_FILES = new Set(['collection.bru', 'opencollection.yml', 'folder.bru', 'folder.yml', 'bruno.json']);

const isParseableFile = (name) => name.endsWith('.bru') || name.endsWith('.yml');

// Port of bruno-electron's hydrateRequestWithUuid: the reducers key everything
// on uids, and the item uid must stay stable per pathname across re-parses.
const hydrateRequest = (request, pathname) => {
  request.uid = getStableUid(pathname);
  request.isTransient = pathname.includes('/.transient/');

  const collections = [
    get(request, 'request.params', []),
    get(request, 'request.headers', []),
    get(request, 'request.vars.req', []),
    get(request, 'request.vars.res', []),
    get(request, 'request.assertions', []),
    get(request, 'request.body.formUrlEncoded', []),
    get(request, 'request.body.multipartForm', []),
    get(request, 'request.body.file', []),
    get(request, 'request.body.ws', [])
  ];
  collections.forEach((entries) => entries.forEach((entry) => (entry.uid = uuid())));

  get(request, 'examples', []).forEach((example, index) => {
    example.uid = getStableUid(`${pathname}::example::${index}`);
    example.itemUid = request.uid;
    [
      get(example, 'request.params', []),
      get(example, 'request.headers', []),
      get(example, 'response.headers', []),
      get(example, 'request.body.multipartForm', []),
      get(example, 'request.body.formUrlEncoded', []),
      get(example, 'request.body.file', [])
    ].forEach((entries) => entries.forEach((entry) => (entry.uid = uuid())));
  });

  return request;
};

const sizeInMB = (bytes) => (bytes || 0) / (1024 * 1024);

const emitRequestFile = (collectionUid, pathname, content, changeType) => {
  const meta = { collectionUid, pathname, name: basename(pathname) };
  let payload;
  try {
    const data = parseRequest(content, { format: formatForFile(pathname) });
    data.raw = content;
    hydrateRequest(data, pathname);
    // scratch collections hold transient requests at their root, without a
    // /.transient/ path segment
    if (findCollectionForPath(pathname)?.scratch) {
      data.isTransient = true;
    }
    payload = { meta, data, partial: false, loading: false, size: sizeInMB(content.length) };
  } catch (error) {
    payload = {
      meta,
      data: { name: meta.name, type: 'http-request', uid: getStableUid(pathname) },
      error: { message: error.message },
      partial: false,
      loading: false,
      size: sizeInMB(content.length)
    };
  }
  emit('main:collection-tree-updated', changeType, payload);
};

const emitEnvironmentFile = (collectionUid, pathname, content) => {
  try {
    const data = parseEnvironment(content, { format: formatForFile(pathname) });
    data.uid = getStableUid(pathname);
    data.name = basename(pathname).replace(/\.(bru|yml)$/, '');
    (data.variables || []).forEach((variable) => (variable.uid = uuid()));
    emit('main:collection-tree-updated', 'addEnvironmentFile', {
      meta: { collectionUid, pathname, name: basename(pathname) },
      data
    });
  } catch (error) {
    console.error(`[web-ipc] failed to parse environment ${pathname}`, error);
  }
};

const streamDirectory = async (collectionEntry, node, isRoot) => {
  const { uid: collectionUid, format } = collectionEntry;
  const children = node.children || [];
  const ignoredDirs = new Set(collectionEntry.brunoConfig?.ignore || []);

  if (isRoot) {
    const rootFileName = format === 'yml' ? 'opencollection.yml' : 'collection.bru';
    const rootFile = children.find((child) => child.type === 'file' && child.name === rootFileName);
    if (rootFile) {
      try {
        const { content } = await serverApi.fsRead(rootFile.pathname);
        const data = parseCollection(content, { format });
        emit('main:collection-tree-updated', 'addFile', {
          meta: { collectionUid, pathname: rootFile.pathname, name: rootFile.name, collectionRoot: true },
          data
        });
      } catch (error) {
        console.error(`[web-ipc] failed to parse collection root ${rootFile.pathname}`, error);
      }
    }
  }

  for (const child of children) {
    if (child.type === 'dir') {
      if (ignoredDirs.has(child.name)) {
        continue;
      }
      if (child.name.startsWith('.')) {
        // transient requests live in <collection>/.transient — restore them so
        // an unsaved request survives a page reload (its tab is reopened by the
        // web-mode restore block in the mount thunks)
        if (isRoot && child.name === '.transient') {
          for (const transientFile of child.children || []) {
            if (transientFile.type === 'file' && isParseableFile(transientFile.name)) {
              const { content } = await serverApi.fsRead(transientFile.pathname);
              emitRequestFile(collectionUid, transientFile.pathname, content, 'addFile');
            }
          }
        }
        continue;
      }
      if (isRoot && child.name === 'environments') {
        for (const envFile of child.children || []) {
          if (envFile.type === 'file' && isParseableFile(envFile.name)) {
            const { content } = await serverApi.fsRead(envFile.pathname);
            emitEnvironmentFile(collectionUid, envFile.pathname, content);
          }
        }
        continue;
      }

      const folderFile = (child.children || []).find(
        (grandChild) => grandChild.type === 'file' && (grandChild.name === 'folder.bru' || grandChild.name === 'folder.yml')
      );
      let folderData = null;
      if (folderFile) {
        try {
          const { content } = await serverApi.fsRead(folderFile.pathname);
          folderData = parseFolder(content, { format: formatForFile(folderFile.name) });
        } catch (error) {
          console.error(`[web-ipc] failed to parse ${folderFile.pathname}`, error);
        }
      }

      emit('main:collection-tree-updated', 'addDir', {
        meta: {
          collectionUid,
          pathname: child.pathname,
          name: folderData?.meta?.name || child.name,
          seq: folderData?.meta?.seq,
          uid: getStableUid(child.pathname)
        }
      });
      if (folderFile && folderData) {
        emit('main:collection-tree-updated', 'addFile', {
          meta: { collectionUid, pathname: folderFile.pathname, name: folderFile.name, folderRoot: true },
          data: folderData
        });
      }
      await streamDirectory(collectionEntry, child, false);
    } else if (child.type === 'file' && isParseableFile(child.name) && !ROOT_FILES.has(child.name)) {
      const { content } = await serverApi.fsRead(child.pathname);
      emitRequestFile(collectionUid, child.pathname, content, 'addFile');
    }
  }
};

const mountCollection = async ({ collectionUid, collectionPathname }) => {
  let entry = findCollectionForPath(collectionPathname);
  if (!entry) {
    entry = registerCollection({
      pathname: collectionPathname,
      format: 'bru',
      brunoConfig: { version: '1', name: basename(collectionPathname), type: 'collection', ignore: [] }
    });
  }

  const tree = await serverApi.fsTree(collectionPathname);
  // The tree (environments included) must be in the store before the mount
  // resolves — the renderer restores the snapshot's selected environment and
  // tabs right after mounting, and needs the items to match against.
  await streamDirectory(entry, tree, true).catch((error) => {
    console.error(`[web-ipc] failed to load collection tree for ${collectionPathname}`, error);
  });

  return `${collectionPathname}/.transient`;
};

const collectionUidFor = (pathname) => {
  const entry = findCollectionForPath(pathname);
  return entry ? entry.uid : getStableUid(pathname);
};

const registerCollectionHandlers = () => {
  handle('renderer:mount-collection', mountCollection);
  handle('renderer:mount-collection-v2', mountCollection);

  handle('renderer:create-collection', async (collectionName, collectionFolderName, collectionLocation, options = {}) => {
    const format = options.format || 'yml';
    const dirPath = `${collectionLocation || webState.serverRoot}/${collectionFolderName}`;
    await serverApi.fsMkdir(dirPath);

    let brunoConfig;
    if (format === 'yml') {
      brunoConfig = { opencollection: '1.0.0', name: collectionName, type: 'collection', ignore: ['node_modules', '.git'] };
      const content = stringifyCollection({ meta: { name: collectionName } }, brunoConfig, { format });
      await serverApi.fsWrite(`${dirPath}/opencollection.yml`, content);
    } else {
      brunoConfig = { version: '1', name: collectionName, type: 'collection', ignore: ['node_modules', '.git'] };
      await serverApi.fsWrite(`${dirPath}/bruno.json`, JSON.stringify(brunoConfig, null, 2));
    }

    const entry = registerCollection({ pathname: dirPath, format, brunoConfig });
    emit('main:collection-opened', dirPath, entry.uid, brunoConfig);
  });

  handle('renderer:new-request', async (pathname, request) => {
    const entry = findCollectionForPath(pathname);
    const format = entry ? entry.format : formatForFile(pathname);
    const content = stringifyRequest(request, { format });
    await serverApi.fsWrite(pathname, content);
    emitRequestFile(collectionUidFor(pathname), pathname, content, 'addFile');
  });

  // Streams a collection that is not mounted through renderer:mount-collection —
  // the workspace scratch collection uses this to restore its transient requests.
  handle('renderer:web:stream-collection', async ({ collectionPathname }) => {
    const entry = findCollectionForPath(collectionPathname);
    if (!entry) {
      return;
    }
    const tree = await serverApi.fsTree(collectionPathname);
    await streamDirectory(entry, tree, true);
  });

  // Persists a transient request's draft to its backing file without emitting a
  // change event — an event would clobber the draft the user is still editing.
  handle('renderer:web:persist-transient-draft', async ({ pathname, request, format }) => {
    const content = stringifyRequest(request, { format: format || formatForFile(pathname) });
    await serverApi.fsWrite(pathname, content);
  });

  handle('renderer:delete-transient-requests', async (filePaths, tempDirectory) => {
    const results = { deleted: [], skipped: [], errors: [] };
    for (const filePath of filePaths || []) {
      if (!tempDirectory || (!filePath.startsWith(`${tempDirectory}/`) && filePath !== tempDirectory)) {
        results.skipped.push({ path: filePath, reason: 'Not in collection temp directory' });
        continue;
      }
      try {
        await serverApi.fsDelete(filePath);
        results.deleted.push(filePath);
      } catch (error) {
        results.errors.push({ path: filePath, error: error.message });
      }
    }
    return results;
  });

  handle('renderer:save-transient-request', async ({ sourcePathname, targetDirname, targetFilename, request, format }) => {
    const targetPathname = `${targetDirname}/${targetFilename}`;
    const content = stringifyRequest(request, { format });
    await serverApi.fsWrite(targetPathname, content);
    emitRequestFile(collectionUidFor(targetPathname), targetPathname, content, 'addFile');
    await serverApi.fsDelete(sourcePathname);
  });

  handle('renderer:save-request', async (pathname, request, format) => {
    const content = stringifyRequest(request, { format: format || formatForFile(pathname) });
    await serverApi.fsWrite(pathname, content);
    emitRequestFile(collectionUidFor(pathname), pathname, content, 'change');
  });

  handle('renderer:save-file', async (pathname, content) => {
    await serverApi.fsWrite(pathname, content);
    if (isParseableFile(basename(pathname)) && !ROOT_FILES.has(basename(pathname))) {
      emitRequestFile(collectionUidFor(pathname), pathname, content, 'change');
    }
  });

  handle('renderer:load-request', async ({ collectionUid, pathname }) => {
    const { content } = await serverApi.fsRead(pathname);
    emitRequestFile(collectionUid, pathname, content, 'addFile');
  });
  handle('renderer:load-large-request', async ({ collectionUid, pathname }) => {
    const { content } = await serverApi.fsRead(pathname);
    emitRequestFile(collectionUid, pathname, content, 'addFile');
  });

  handle('renderer:new-folder', async ({ pathname, folderData, format }) => {
    await serverApi.fsMkdir(pathname);
    const folderFilePath = `${pathname}/folder.${format}`;
    const content = stringifyFolder(folderData, { format });
    await serverApi.fsWrite(folderFilePath, content);

    const collectionUid = collectionUidFor(pathname);
    emit('main:collection-tree-updated', 'addDir', {
      meta: {
        collectionUid,
        pathname,
        name: folderData?.meta?.name || basename(pathname),
        seq: folderData?.meta?.seq,
        uid: getStableUid(pathname)
      }
    });
    emit('main:collection-tree-updated', 'addFile', {
      meta: { collectionUid, pathname: folderFilePath, name: `folder.${format}`, folderRoot: true },
      data: folderData
    });
  });

  handle('renderer:delete-item', async (pathname, type) => {
    await serverApi.fsDelete(pathname);
    const meta = { collectionUid: collectionUidFor(pathname), pathname, name: basename(pathname) };
    emit('main:collection-tree-updated', type === 'folder' ? 'unlinkDir' : 'unlink', { meta });
  });

  handle('renderer:resequence-items', async (itemsToResequence, collectionPathname) => {
    const entry = findCollectionForPath(collectionPathname);
    const format = entry ? entry.format : 'bru';
    const collectionUid = collectionUidFor(collectionPathname);

    for (const item of itemsToResequence) {
      if (item?.type === 'folder') {
        const folderRootPath = `${item.pathname}/folder.${format}`;
        let folderData;
        try {
          const { content } = await serverApi.fsRead(folderRootPath);
          folderData = parseFolder(content, { format });
        } catch (error) {
          folderData = null;
        }
        if (!folderData || !folderData.meta) {
          folderData = { ...folderData, meta: { name: basename(item.pathname), seq: item.seq } };
        }
        if (folderData.meta.seq === item.seq) {
          continue;
        }
        folderData.meta = { ...folderData.meta, seq: item.seq };
        const content = stringifyFolder(folderData, { format });
        await serverApi.fsWrite(folderRootPath, content);
        emit('main:collection-tree-updated', 'change', {
          meta: { collectionUid, pathname: folderRootPath, name: `folder.${format}`, folderRoot: true },
          data: folderData
        });
      } else if (item?.request) {
        const itemToSave = transformRequestToSaveToFilesystem(item);
        const content = stringifyRequest(itemToSave, { format });
        await serverApi.fsWrite(item.pathname, content);
        emitRequestFile(collectionUid, item.pathname, content, 'change');
      }
    }
    return true;
  });

  handle('renderer:rename-collection', async (newName, collectionPathname) => {
    const entry = findCollectionForPath(collectionPathname);
    const format = entry ? entry.format : 'bru';

    if (format === 'yml') {
      const configFilePath = `${collectionPathname}/opencollection.yml`;
      const { content } = await serverApi.fsRead(configFilePath);
      const { brunoConfig, collectionRoot } = parseCollection(content, { format: 'yml' });
      brunoConfig.name = newName;
      await serverApi.fsWrite(configFilePath, stringifyCollection(collectionRoot, brunoConfig, { format: 'yml' }));
    } else {
      const configFilePath = `${collectionPathname}/bruno.json`;
      const { content } = await serverApi.fsRead(configFilePath);
      const brunoConfig = JSON.parse(content);
      brunoConfig.name = newName;
      await serverApi.fsWrite(configFilePath, JSON.stringify(brunoConfig, null, 2));
    }

    // entry.brunoConfig may be a frozen object out of the redux store — replace, don't mutate
    if (entry?.brunoConfig) {
      entry.brunoConfig = { ...entry.brunoConfig, name: newName };
    }
    emit('main:collection-renamed', { collectionPathname, newName });
  });

  handle('renderer:clone-folder', async (itemFolder, collectionPath, collectionPathname) => {
    const entry = findCollectionForPath(collectionPathname);
    const format = entry ? entry.format : 'bru';

    const writeItems = async (items = [], currentPath) => {
      for (const item of items) {
        if (['http-request', 'graphql-request', 'grpc-request'].includes(item.type)) {
          const content = stringifyRequest(item, { format });
          const baseName = item.filename.replace(/\.(bru|yml)$/, '');
          await serverApi.fsWrite(`${currentPath}/${baseName}.${format}`, content);
        } else if (item.type === 'folder') {
          const folderPath = `${currentPath}/${item.filename}`;
          await serverApi.fsMkdir(folderPath);
          if (item.root) {
            await serverApi.fsWrite(`${folderPath}/folder.${format}`, stringifyFolder(item.root, { format }));
          }
          await writeItems(item.items, folderPath);
        }
      }
    };

    await serverApi.fsMkdir(collectionPath);
    if (itemFolder.root) {
      await serverApi.fsWrite(`${collectionPath}/folder.${format}`, stringifyFolder(itemFolder.root, { format }));
    }
    await writeItems(itemFolder.items, collectionPath);

    // No file watcher in web mode — replay the new subtree into the store the
    // same way mounting does.
    const collectionUid = collectionUidFor(collectionPath);
    emit('main:collection-tree-updated', 'addDir', {
      meta: {
        collectionUid,
        pathname: collectionPath,
        name: itemFolder.root?.meta?.name || basename(collectionPath),
        seq: itemFolder.root?.meta?.seq,
        uid: getStableUid(collectionPath)
      }
    });
    if (itemFolder.root) {
      emit('main:collection-tree-updated', 'addFile', {
        meta: { collectionUid, pathname: `${collectionPath}/folder.${format}`, name: `folder.${format}`, folderRoot: true },
        data: itemFolder.root
      });
    }
    const node = await serverApi.fsTree(collectionPath);
    await streamDirectory(entry, node, false);
  });

  handle('renderer:rename-item-name', async ({ itemPath, newName, collectionPathname }) => {
    const entry = findCollectionForPath(collectionPathname);
    const format = entry ? entry.format : 'bru';
    const collectionUid = collectionUidFor(itemPath);

    if (!isParseableFile(basename(itemPath))) {
      const folderFilePath = `${itemPath}/folder.${format}`;
      let folderData;
      try {
        const { content } = await serverApi.fsRead(folderFilePath);
        folderData = parseFolder(content, { format });
      } catch (error) {
        folderData = {};
      }
      folderData.meta = { ...folderData.meta, name: newName };
      const content = stringifyFolder(folderData, { format });
      await serverApi.fsWrite(folderFilePath, content);
      emit('main:collection-tree-updated', 'change', {
        meta: { collectionUid, pathname: folderFilePath, name: `folder.${format}`, folderRoot: true },
        data: folderData
      });
      return;
    }

    const fileFormat = formatForFile(itemPath);
    const { content } = await serverApi.fsRead(itemPath);
    const data = parseRequest(content, { format: fileFormat });
    data.name = newName;
    const newContent = stringifyRequest(data, { format: fileFormat });
    await serverApi.fsWrite(itemPath, newContent);
    emitRequestFile(collectionUid, itemPath, newContent, 'change');
  });

  handle('renderer:rename-item-filename', async ({ oldPath, newPath }) => {
    await serverApi.fsRename(oldPath, newPath);
    const collectionUid = collectionUidFor(newPath);
    emit('main:collection-tree-updated', 'unlink', {
      meta: { collectionUid, pathname: oldPath, name: basename(oldPath) }
    });
    const { content } = await serverApi.fsRead(newPath);
    emitRequestFile(collectionUid, newPath, content, 'addFile');
  });

  const environmentFilePath = (collectionPathname, name, format) => `${collectionPathname}/environments/${name}.${format}`;

  handle('renderer:create-environment', async (collectionPathname, name, variables, color) => {
    const entry = findCollectionForPath(collectionPathname);
    const format = entry ? entry.format : 'bru';
    const environment = { name, variables: variables || [], color };
    const content = stringifyEnvironment(environment, { format });
    const pathname = environmentFilePath(collectionPathname, name, format);
    await serverApi.fsWrite(pathname, content);
    emitEnvironmentFile(collectionUidFor(collectionPathname), pathname, content);
  });

  handle('renderer:save-environment', async (collectionPathname, environment) => {
    const entry = findCollectionForPath(collectionPathname);
    const format = entry ? entry.format : 'bru';
    const content = stringifyEnvironment(environment, { format });
    const pathname = environmentFilePath(collectionPathname, environment.name, format);
    await serverApi.fsWrite(pathname, content);
    emitEnvironmentFile(collectionUidFor(collectionPathname), pathname, content);
  });

  handle('renderer:rename-environment', async (collectionPathname, environmentName, newName) => {
    const entry = findCollectionForPath(collectionPathname);
    const format = entry ? entry.format : 'bru';
    const oldPath = environmentFilePath(collectionPathname, environmentName, format);
    const newPath = environmentFilePath(collectionPathname, newName, format);
    const { content } = await serverApi.fsRead(oldPath);
    const environment = parseEnvironment(content, { format });
    environment.name = newName;
    await serverApi.fsDelete(oldPath);
    const newContent = stringifyEnvironment(environment, { format });
    await serverApi.fsWrite(newPath, newContent);

    const collectionUid = collectionUidFor(collectionPathname);
    emit('main:collection-tree-updated', 'unlinkEnvironmentFile', {
      meta: { collectionUid, pathname: oldPath, name: basename(oldPath) }
    });
    emitEnvironmentFile(collectionUid, newPath, newContent);
  });

  handle('renderer:delete-environment', async (collectionPathname, environmentName) => {
    const entry = findCollectionForPath(collectionPathname);
    const format = entry ? entry.format : 'bru';
    const pathname = environmentFilePath(collectionPathname, environmentName, format);
    await serverApi.fsDelete(pathname);
    emit('main:collection-tree-updated', 'unlinkEnvironmentFile', {
      meta: { collectionUid: collectionUidFor(collectionPathname), pathname, name: basename(pathname) }
    });
  });

  handle('renderer:remove-collection', async (collectionPathname) => {
    webState.collections.delete(collectionPathname);
  });
};

export default registerCollectionHandlers;
