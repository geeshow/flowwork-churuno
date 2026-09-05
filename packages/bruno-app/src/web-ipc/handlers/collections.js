import get from 'lodash/get';
import { uuid } from 'utils/common';
import { transformRequestToSaveToFilesystem } from 'utils/collections/index';
import { sanitizeName } from 'utils/common/regex';
import { handle, emit } from '../core';
import serverApi from '../server-api';
import webState, { registerCollection, findCollectionForPath, getStableUid } from '../state';
import { parseFileMeta } from '../file-meta';
import { parseRequestFiles } from '../parse-pool';
import { readCachedTree, writeCachedTree } from '../tree-cache';
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

// bruno.json/opencollection.yml `ignore` entries are collection-relative paths
// ("payments/legacy"), so match dirs by their relative path — a bare name only
// equals it at the top level.
const isIgnoredDir = (ignoredDirs, collectionPathname, child) => {
  const relativePath = child.pathname && child.pathname.startsWith(`${collectionPathname}/`)
    ? child.pathname.slice(collectionPathname.length + 1)
    : child.name;
  return ignoredDirs.has(relativePath);
};

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

// 지연 파싱 컬렉션의 raw 파일 내용 — pathname → { content, format }.
// 항목이 하이드레이션되면(emitRequestFile) 지워진다.
const lazyRequestContent = new Map();

const emitRequestFile = (collectionUid, pathname, content, changeType) => {
  lazyRequestContent.delete(pathname);
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

const parseEnvironmentFile = (pathname, content) => {
  try {
    const data = parseEnvironment(content, { format: formatForFile(pathname) });
    data.uid = getStableUid(pathname);
    data.name = basename(pathname).replace(/\.(bru|yml)$/, '');
    (data.variables || []).forEach((variable) => (variable.uid = uuid()));
    return data;
  } catch (error) {
    console.error(`[web-ipc] failed to parse environment ${pathname}`, error);
    return null;
  }
};

const emitEnvironmentFile = (collectionUid, pathname, content) => {
  const data = parseEnvironmentFile(pathname, content);
  if (!data) return;
  emit('main:collection-tree-updated', 'addEnvironmentFile', {
    meta: { collectionUid, pathname, name: basename(pathname) },
    data
  });
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
      if (isIgnoredDir(ignoredDirs, collectionEntry.pathname, child)) {
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

const stripRequestExt = (name) => name.replace(/\.(bru|yml)$/, '');

const LAZY_PARSE_THRESHOLD = 1000;

// Mount = one round trip. The server returns the tree with every .bru/.yml
// inlined (renderer:mount-collection used to issue one /api/fs/read per file,
// 92s for 8000 requests). The renderer then gets the whole tree in a single
// collectionLoadedFromTree dispatch — the same channel the desktop's file-cache
// mount uses — first with cheap metadata so names and methods show at once,
// then again once the workers have parsed the bodies.
//
// LAZY_PARSE_THRESHOLD를 넘는 컬렉션은 본문 파싱 자체를 건너뛴다: 전량 파싱은
// 1만 개 기준 CPU 8초 + 트리 병합 1초가 더 들지만, 사이드바·검색은 메타(이름·
// 메서드·URL)로 충분하다. raw 내용은 셔틀 캐시에 남겨 탭을 열 때 그 파일만
// 즉석 파싱하고(RequestNotLoaded가 자동 로드), 러너처럼 전체 본문이 필요한
// 경로는 renderer:ensure-collection-loaded로 그때 전량 하이드레이션한다.
const buildMountTree = (collectionEntry, node) => {
  const { uid: collectionUid, format } = collectionEntry;
  const ignoredDirs = new Set(collectionEntry.brunoConfig?.ignore || []);
  const environments = [];
  const pending = [];
  let root = null;

  const requestItem = (child, isTransient) => {
    const fileFormat = formatForFile(child.name);
    const hasContent = typeof child.content === 'string';
    const meta = hasContent
      ? parseFileMeta(child.content, { format: fileFormat, fallbackName: stripRequestExt(child.name) })
      : parseFileMeta('', { format: fileFormat, fallbackName: stripRequestExt(child.name) });
    const item = {
      uid: getStableUid(child.pathname),
      ...meta,
      filename: child.name,
      pathname: child.pathname,
      raw: null,
      draft: null,
      // without content the file is over the inline limit — stays partial until the tab loads it
      partial: !hasContent,
      loading: hasContent,
      size: sizeInMB(child.size),
      isTransient
    };
    if (hasContent) {
      pending.push({ pathname: child.pathname, content: child.content, format: fileFormat, item });
    }
    return item;
  };

  const walk = (dirNode, isRoot, isTransient) => {
    const items = [];
    for (const child of dirNode.children || []) {
      if (child.type === 'dir') {
        if (isIgnoredDir(ignoredDirs, collectionEntry.pathname, child)) continue;
        if (child.name.startsWith('.')) {
          // <collection>/.transient holds unsaved requests that must survive a reload
          if (isRoot && child.name === '.transient') {
            items.push(...walk(child, false, true));
          }
          continue;
        }
        if (isRoot && child.name === 'environments') {
          for (const envFile of child.children || []) {
            if (envFile.type === 'file' && isParseableFile(envFile.name) && typeof envFile.content === 'string') {
              const environment = parseEnvironmentFile(envFile.pathname, envFile.content);
              if (environment) environments.push(environment);
            }
          }
          continue;
        }
        const folderFile = (child.children || []).find(
          (grandChild) => grandChild.type === 'file' && (grandChild.name === 'folder.bru' || grandChild.name === 'folder.yml')
        );
        let folderData = null;
        if (folderFile && typeof folderFile.content === 'string') {
          try {
            folderData = parseFolder(folderFile.content, { format: formatForFile(folderFile.name) });
          } catch (error) {
            console.error(`[web-ipc] failed to parse ${folderFile.pathname}`, error);
          }
        }
        const folder = {
          uid: getStableUid(child.pathname),
          name: folderData?.meta?.name || child.name,
          filename: child.name,
          pathname: child.pathname,
          type: 'folder',
          collapsed: true,
          isTransient,
          items: walk(child, false, isTransient)
        };
        if (folderData?.meta?.seq) folder.seq = folderData.meta.seq;
        // 폴더 설정(root)은 트리에 실어 collectionLoadedFromTree 한 번에 합친다 —
        // 폴더마다 addFile을 따로 emit하면 dispatch당 트리 전체를 훑어(개당 ~30ms)
        // 폴더 수백 개 컬렉션에서 마운트가 수 초씩 걸린다
        if (folderData) folder.root = folderData;
        items.push(folder);
      } else if (child.type === 'file') {
        if (isRoot && child.name === (format === 'yml' ? 'opencollection.yml' : 'collection.bru')) {
          if (typeof child.content === 'string') {
            try {
              root = { pathname: child.pathname, name: child.name, data: parseCollection(child.content, { format }) };
            } catch (error) {
              console.error(`[web-ipc] failed to parse collection root ${child.pathname}`, error);
            }
          }
          continue;
        }
        if (isParseableFile(child.name) && !ROOT_FILES.has(child.name)) {
          items.push(requestItem(child, isTransient));
        }
      }
    }
    return items;
  };

  const items = walk(node, true, false);
  environments.sort((a, b) => a.name.localeCompare(b.name));
  return { collectionUid, items, environments, root, pending };
};

// The store freezes what it receives, and the same item objects are updated
// again as parse batches land — hand the reducer a snapshot, not the live tree.
const emitMountTree = ({ collectionUid, items, environments }) => {
  emit('main:collection-tree-loaded', { collectionUid, tree: structuredClone({ items, environments }) });
};

const applyParsedRequest = (entry, result) => {
  const { item, pathname, content } = entry;
  if (result.error) {
    Object.assign(item, { loading: false, error: { message: result.error } });
    return;
  }
  const data = result.data;
  data.raw = content;
  hydrateRequest(data, pathname);
  Object.assign(item, {
    name: data.name,
    type: data.type,
    seq: data.seq,
    tags: data.tags,
    request: data.request,
    settings: data.settings,
    examples: data.examples,
    raw: content,
    loading: false,
    isTransient: item.isTransient || data.isTransient
  });
};

const mountCollection = async ({ collectionUid, collectionPathname }, { forceFull = false } = {}) => {
  let entry = findCollectionForPath(collectionPathname);
  if (!entry) {
    entry = registerCollection({
      pathname: collectionPathname,
      format: 'bru',
      brunoConfig: { version: '1', name: basename(collectionPathname), type: 'collection', ignore: [] }
    });
  }

  emit('main:collection-loading-state-updated', { collectionUid: entry.uid, isLoading: true });
  try {
    // 새로고침 재방문: IndexedDB 사본의 etag를 보내 서버가 notModified로 답하면
    // 트리 전송·파싱을 통째로 건너뛰고 사본으로 마운트한다 (tree-cache.js 참조)
    const cached = await readCachedTree(collectionPathname);
    const response = await serverApi.fsCollection(collectionPathname, cached?.etag);
    const node = response?.notModified && cached ? cached.tree : response;
    if (!response?.notModified && response?.etag) {
      writeCachedTree(collectionPathname, response.etag, response);
    }
    const tree = buildMountTree(entry, node);
    const lazy = !forceFull && tree.pending.length > LAZY_PARSE_THRESHOLD;

    if (lazy) {
      // 본문은 캐시에만 두고 항목은 partial로 — 탭을 열면 그 파일만 즉석 파싱된다
      for (const job of tree.pending) {
        lazyRequestContent.set(job.pathname, { content: job.content, format: job.format });
        Object.assign(job.item, { loading: false, partial: true, partialCached: true });
      }
    }

    // 1) names, seq and methods from the cheap meta pass — every item shows a spinner
    emitMountTree(tree);
    if (tree.root) {
      emit('main:collection-tree-updated', 'addFile', {
        meta: { collectionUid: entry.uid, pathname: tree.root.pathname, name: tree.root.name, collectionRoot: true },
        data: tree.root.data
      });
    }

    // 2) full bodies from the worker pool, then the tree once more. Each tree
    //    emit costs ~1s at 8000 items (snapshot + merge + sidebar render), so
    //    there are no progress emits in between — the meta pass already shows
    //    every item, spinners included.
    if (!lazy) {
      const byPathname = new Map(tree.pending.map((job) => [job.pathname, job]));
      await parseRequestFiles(tree.pending, (results) => {
        for (const result of results) {
          const job = byPathname.get(result.pathname);
          if (job) applyParsedRequest(job, result);
        }
      });
      for (const job of tree.pending) lazyRequestContent.delete(job.pathname);
      emitMountTree(tree);
    }
  } catch (error) {
    console.error(`[web-ipc] failed to load collection tree for ${collectionPathname}`, error);
  } finally {
    emit('main:collection-loading-state-updated', { collectionUid: entry.uid, isLoading: false });
  }

  return `${collectionPathname}/.transient`;
};

// Port of bruno-electron's writeBrunoConfig: bruno.json is plain JSON; for a
// YAML collection the config shares opencollection.yml with the collection
// root, so the root is re-read from disk rather than trusted from the caller.
const writeBrunoConfig = async (entry, brunoConfig) => {
  if (entry.format === 'yml') {
    const configFilePath = `${entry.pathname}/opencollection.yml`;
    let collectionRoot = { meta: { name: brunoConfig?.name || basename(entry.pathname) } };
    try {
      const { content } = await serverApi.fsRead(configFilePath);
      collectionRoot = parseCollection(content, { format: 'yml' }).collectionRoot;
    } catch (error) {
      console.warn(`[web-ipc] could not re-read ${configFilePath}, writing config with a bare root`, error);
    }
    await serverApi.fsWrite(configFilePath, stringifyCollection(collectionRoot, brunoConfig, { format: 'yml' }));
  } else {
    await serverApi.fsWrite(`${entry.pathname}/bruno.json`, JSON.stringify(brunoConfig, null, 2));
  }
  entry.brunoConfig = brunoConfig;
};

const requireCollection = (collectionPathname) => {
  const entry = findCollectionForPath(collectionPathname);
  if (!entry) {
    throw new Error(`Collection not found for ${collectionPathname}`);
  }
  return entry;
};

const collectionUidFor = (pathname) => {
  const entry = findCollectionForPath(pathname);
  return entry ? entry.uid : getStableUid(pathname);
};

const registerCollectionHandlers = () => {
  handle('renderer:mount-collection', mountCollection);
  handle('renderer:mount-collection-v2', mountCollection);

  handle('renderer:update-bruno-config', async (brunoConfig, collectionPathname) => {
    await writeBrunoConfig(requireCollection(collectionPathname), brunoConfig);
  });

  handle('renderer:ignore-folder', async (collectionUid, collectionPathname, collectionRoot, brunoConfig, folderPathname) => {
    const entry = requireCollection(collectionPathname);
    const relativePath = folderPathname.startsWith(`${collectionPathname}/`)
      ? folderPathname.slice(collectionPathname.length + 1)
      : basename(folderPathname);
    const updated = { ...brunoConfig, ignore: [...new Set([...(brunoConfig?.ignore || []), relativePath])] };
    await writeBrunoConfig(entry, updated);
    return updated;
  });

  // Reverse of renderer:ignore-folder (no desktop counterpart): drop the entry
  // from the config and re-mount so the folder's items stream back into the tree.
  handle('renderer:unignore-folder', async (collectionUid, collectionPathname, ignoreEntry) => {
    const entry = requireCollection(collectionPathname);
    const updated = { ...entry.brunoConfig, ignore: (entry.brunoConfig?.ignore || []).filter((e) => e !== ignoreEntry) };
    await writeBrunoConfig(entry, updated);
    await mountCollection({ collectionUid: entry.uid, collectionPathname });
    return updated;
  });

  // Bulk counterpart: replace the whole ignore list in one config write and a
  // single re-mount, so restored folders stream back into the tree at once.
  handle('renderer:set-ignored-folders', async (collectionUid, collectionPathname, ignore) => {
    const entry = requireCollection(collectionPathname);
    const updated = { ...entry.brunoConfig, ignore };
    await writeBrunoConfig(entry, updated);
    await mountCollection({ collectionUid: entry.uid, collectionPathname });
    return updated;
  });

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

  // Port of bruno-electron's renderer:import-collection (utils/collection-import.js):
  // serializes the converted collection tree to files through the web server.
  handle('renderer:import-collection', async (collection, collectionLocation, options = {}) => {
    const format = options.format || 'yml';
    const location = (collectionLocation || webState.serverRoot).replace(/\/+$/, '');
    const collections = Array.isArray(collection) ? collection : [collection];
    const successfulImports = [];
    let failedImports = 0;

    const findUniqueFolderName = async (baseName) => {
      for (let counter = 0; ; counter++) {
        const candidate = counter === 0 ? baseName : `${baseName} - ${counter}`;
        const { exists } = await serverApi.fsExists(`${location}/${sanitizeName(candidate)}`);
        if (!exists) {
          return candidate;
        }
      }
    };

    const filenameWithFormat = (item) => {
      const filename = item?.filename || `${item.name}.${format}`;
      return filename.replace(/\.(bru|yml)$/, `.${format}`);
    };

    const writeItems = async (items = [], currentPath) => {
      for (const item of items) {
        if (['http-request', 'graphql-request', 'grpc-request', 'ws-request'].includes(item.type)) {
          const pathname = `${currentPath}/${sanitizeName(filenameWithFormat(item))}`;
          await serverApi.fsWrite(pathname, stringifyRequest(item, { format }));
        } else if (item.type === 'folder') {
          const folderPath = `${currentPath}/${sanitizeName(item.filename || item.name)}`;
          await serverApi.fsMkdir(folderPath);
          if (item.root?.meta?.name) {
            item.root.meta.seq = item.seq;
            await serverApi.fsWrite(`${folderPath}/folder.${format}`, stringifyFolder(item.root, { format }));
          }
          if (item.items?.length) {
            await writeItems(item.items, folderPath);
          }
        } else if (item.type === 'js') {
          const pathname = `${currentPath}/${sanitizeName(item.filename || `${item.name}.js`)}`;
          await serverApi.fsWrite(pathname, item.fileContent);
        }
      }
    };

    const writeEnvironments = async (environments = [], collectionPath) => {
      if (!environments.length) {
        return;
      }
      const envDirPath = `${collectionPath}/environments`;
      await serverApi.fsMkdir(envDirPath);
      for (const env of environments) {
        const envPath = `${envDirPath}/${sanitizeName(`${env.name}.${format}`)}`;
        await serverApi.fsWrite(envPath, stringifyEnvironment(env, { format }));
      }
    };

    for (const coll of collections) {
      try {
        emit('main:collection-import-started', coll.uid);

        coll.name = await findUniqueFolderName(coll.name);
        const collectionPath = `${location}/${sanitizeName(coll.name)}`;
        await serverApi.fsMkdir(collectionPath);

        const brunoConfig = coll.brunoConfig || { name: coll.name, type: 'collection', ignore: ['node_modules', '.git'] };
        if (format === 'yml') {
          brunoConfig.opencollection = '1.0.0';
          const content = stringifyCollection(coll.root, brunoConfig, { format });
          await serverApi.fsWrite(`${collectionPath}/opencollection.yml`, content);
        } else if (format === 'bru') {
          const bruJsonConfig = { ...brunoConfig, version: '1' };
          if (brunoConfig.version) {
            bruJsonConfig.collectionVersion = brunoConfig.version;
          }
          await serverApi.fsWrite(`${collectionPath}/bruno.json`, JSON.stringify(bruJsonConfig, null, 2));
          const content = stringifyCollection(coll.root, brunoConfig, { format });
          await serverApi.fsWrite(`${collectionPath}/collection.bru`, content);
        } else {
          throw new Error(`Invalid format: ${format}`);
        }

        await writeItems(coll.items, collectionPath);
        await writeEnvironments(coll.environments, collectionPath);

        const entry = registerCollection({ pathname: collectionPath, format, brunoConfig });
        emit('main:collection-opened', collectionPath, entry.uid, brunoConfig);
        emit('main:collection-import-ended', coll.uid);
        successfulImports.push({ path: collectionPath, name: coll.name });
      } catch (error) {
        console.error(`[web-ipc] failed to import collection ${coll.name}`, error);
        emit('main:collection-import-failed', coll.uid, { message: `Error ${error.message}` });
        failedImports++;
      }
    }

    emit('main:all-collections-import-ended', {
      message: `Import completed. ${successfulImports.length} collections imported successfully, ${failedImports} failed.`,
      status: {
        total: collections.length,
        succeeded: successfulImports.length,
        failed: failedImports
      }
    });

    return {
      success: {
        count: successfulImports.length,
        items: successfulImports
      }
    };
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

  // 지연 파싱 컬렉션의 항목은 내용이 이미 캐시에 있어 서버 왕복 없이 하이드레이션된다
  const loadRequestFile = async ({ collectionUid, pathname }) => {
    const cached = lazyRequestContent.get(pathname);
    const content = cached ? cached.content : (await serverApi.fsRead(pathname)).content;
    emitRequestFile(collectionUid, pathname, content, 'addFile');
  };
  handle('renderer:load-request', loadRequestFile);
  handle('renderer:load-large-request', loadRequestFile);

  // 러너처럼 컬렉션 전체 본문이 필요한 경로가 실행 직전에 부른다 —
  // 지연 파싱으로 미뤄 둔 전량 하이드레이션을 그때 수행한다 (아니면 no-op).
  handle('renderer:ensure-collection-loaded', async (collectionPathname) => {
    const entry = findCollectionForPath(collectionPathname);
    if (!entry) return;
    const prefix = `${entry.pathname}/`;
    const hasLazyItems = [...lazyRequestContent.keys()].some((pathname) => pathname.startsWith(prefix));
    if (hasLazyItems) {
      await mountCollection({ collectionUid: entry.uid, collectionPathname: entry.pathname }, { forceFull: true });
    }
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
    lazyRequestContent.delete(pathname);
    if (type === 'folder') {
      for (const key of lazyRequestContent.keys()) {
        if (key.startsWith(`${pathname}/`)) lazyRequestContent.delete(key);
      }
    }
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
