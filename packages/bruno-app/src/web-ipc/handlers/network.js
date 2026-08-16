import { buildHar, isRequestTagsIncluded } from '@usebruno/common';
import { handle, emit } from '../core';
import serverApi from '../server-api';
import { getPreferences } from './boot';
import { uuid, sortByNameThenSequence } from 'utils/common';
import { getAllVariables, getTreePathFromCollectionToItem, mergeHeaders } from 'utils/collections/index';
import { resolveInheritedAuth } from 'utils/auth';
import { interpolateUrl, interpolateUrlPathParams } from 'utils/url/index';

const abortControllers = new Map();

const headerListToObject = (headerPairs) => {
  const headers = {};
  headerPairs.forEach(([name, value]) => {
    const existing = headers[name];
    if (existing === undefined) {
      headers[name] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      headers[name] = [existing, value];
    }
  });
  return headers;
};

const decodeBody = (dataBase64, headers) => {
  const binary = atob(dataBase64 || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const text = new TextDecoder().decode(bytes);

  const contentTypeKey = Object.keys(headers).find((key) => key.toLowerCase() === 'content-type');
  const contentType = contentTypeKey ? String(headers[contentTypeKey]) : '';
  if (contentType.includes('json')) {
    try {
      return JSON.parse(text);
    } catch (_error) {
      return text;
    }
  }
  return text;
};

// Interpolates variables, resolves inherited auth/headers and builds the wire
// request — everything that happens before bytes hit the network.
const prepareHttpRequest = async (item, collection) => {
  const variables = getAllVariables(collection, item);
  const request = item.draft ? item.draft.request : item.request;
  const settings = item.draft ? item.draft.settings : item.settings;

  let effectiveAuth = request.auth;
  if (request.auth?.mode === 'inherit') {
    effectiveAuth = resolveInheritedAuth(item, collection).auth;
  }

  const requestTreePath = getTreePathFromCollectionToItem(collection, item);
  const mergedHeaders = mergeHeaders(collection, request, requestTreePath);

  const sourceUrl = interpolateUrlPathParams(
    interpolateUrl({ url: request.url, variables }) || '',
    request.params,
    variables,
    { raw: true }
  );

  const { rawUrl, encodedUrl, har } = await buildHar({
    request: {
      method: request.method,
      url: sourceUrl,
      params: request.params,
      pathParams: [],
      headers: mergedHeaders,
      body: request.body,
      auth: effectiveAuth,
      settings
    },
    variables,
    shouldInterpolate: true,
    oauth2Credentials: collection?.oauth2Credentials,
    collectionUid: collection?.uid
  });

  const wireUrl = settings?.encodeUrl === true ? encodedUrl : rawUrl;
  const requestHeaders = headerListToObject((har.headers || []).map((h) => [h.name, h.value]));
  const requestSent = {
    url: wireUrl,
    method: request.method,
    headers: requestHeaders,
    data: har.postData?.text ?? null,
    timestamp: Date.now()
  };

  return { request, wireUrl, har, requestSent };
};

// Preferences의 수동 프록시 설정 → 서버 실행 페이로드. 요청은 서버(httpx)가
// 대신 보내므로 프록시도 서버에서 적용된다. PAC은 httpx가 해석할 수 없어 미지원.
const buildProxyPayload = (preferences) => {
  const proxy = preferences?.proxy;
  if (!proxy || proxy.disabled || proxy.source !== 'manual') {
    return null;
  }
  const config = proxy.config || {};
  if (!config.hostname) {
    return null;
  }
  const authEnabled = !config.auth?.disabled;
  return {
    protocol: config.protocol || 'http',
    hostname: config.hostname,
    port: config.port || null,
    username: authEnabled ? config.auth?.username || null : null,
    password: authEnabled ? config.auth?.password || null : null,
    bypass: config.bypassProxy || null
  };
};

const executeHttpRequest = async ({ request, wireUrl, har }, item, collection, signal) => {
  const preferences = getPreferences();
  const timeoutMs = preferences?.request?.timeout || 0;
  return serverApi.executeHttpRequest(
    {
      method: request.method,
      url: wireUrl,
      headers: har.headers || [],
      postData: har.postData ?? null,
      timeoutMs: timeoutMs > 0 ? timeoutMs : null,
      followRedirects: true,
      verifyTls: preferences?.request?.sslVerification !== false,
      proxy: buildProxyPayload(preferences),
      collectionPath: collection.pathname,
      requestName: item.name
    },
    { signal }
  );
};

const sendHttpRequest = async (item, collection, environment, runtimeVariables) => {
  const requestUid = item.requestUid;
  const eventBase = { itemUid: item.uid, collectionUid: collection.uid, requestUid };
  const cancelTokenUid = uuid();

  emit('main:run-request-event', { type: 'request-queued', ...eventBase, cancelTokenUid });

  const prepared = await prepareHttpRequest(item, collection);
  const { requestSent } = prepared;

  emit('main:run-request-event', { type: 'request-sent', ...eventBase, cancelTokenUid, requestSent });

  const abortController = new AbortController();
  abortControllers.set(cancelTokenUid, abortController);

  let result;
  try {
    result = await executeHttpRequest(prepared, item, collection, abortController.signal);
  } catch (error) {
    if (abortController.signal.aborted) {
      return { statusText: 'REQUEST_CANCELLED', isCancel: true, error: 'REQUEST_CANCELLED', timeline: [] };
    }
    return { statusText: 'Error', error: error.message, timeline: [], requestSent };
  } finally {
    abortControllers.delete(cancelTokenUid);
  }

  if (result.error) {
    return { statusText: 'Error', error: result.error, timeline: result.timeline || [], requestSent };
  }

  const responseHeaders = headerListToObject(result.headers || []);

  return {
    status: result.status,
    statusText: result.statusText,
    headers: responseHeaders,
    data: decodeBody(result.dataBase64, responseHeaders),
    dataBuffer: result.dataBase64,
    size: result.size,
    duration: result.durationMs,
    url: result.finalUrl,
    timeline: result.timeline || [],
    stream: null,
    sseChunks: null,
    cancelTokenUid,
    requestSent
  };
};

const getAllRequestsRecursively = (folder) => {
  let requests = [];
  const folderItems = sortByNameThenSequence((folder.items || []).filter((item) => item.type === 'folder' && !item.isTransient));
  const requestItems = (folder.items || [])
    .filter((item) => item.type !== 'folder' && item.request && !item.isTransient)
    .sort((a, b) => a.seq - b.seq);

  requests = requests.concat(requestItems);
  folderItems.forEach((item) => {
    requests = requests.concat(getAllRequestsRecursively(item));
  });
  return requests;
};

// Port of bruno-electron's renderer:run-collection-folder, minus the script/test
// sandbox (web mode runs no request scripts) — it drives the same
// main:run-folder-event stream the runner UI listens to.
const runCollectionFolder = async (folder, collection, environment, runtimeVariables, recursive, delay, tags, selectedRequestUids) => {
  const collectionUid = collection.uid;
  const folderUid = folder ? folder.uid : null;
  const cancelTokenUid = uuid();
  const abortController = new AbortController();
  abortControllers.set(cancelTokenUid, abortController);

  const scope = folder || collection;

  emit('main:run-folder-event', {
    type: 'testrun-started',
    isRecursive: recursive,
    collectionUid,
    folderUid,
    cancelTokenUid
  });

  try {
    let folderRequests = [];
    if (recursive) {
      folderRequests = getAllRequestsRecursively(scope);
    } else {
      folderRequests = sortByNameThenSequence((scope.items || []).filter((item) => item.request && !item.isTransient));
    }

    if (tags && tags.include && tags.exclude) {
      folderRequests = folderRequests.filter(({ tags: requestTags = [], draft }) => {
        requestTags = draft?.tags || requestTags || [];
        return isRequestTagsIncluded(requestTags, tags.include || [], tags.exclude || []);
      });
    }

    if (selectedRequestUids && selectedRequestUids.length > 0) {
      const uidIndexMap = new Map(selectedRequestUids.map((uid, index) => [uid, index]));
      folderRequests = folderRequests
        .filter((request) => uidIndexMap.has(request.uid))
        .sort((a, b) => uidIndexMap.get(a.uid) - uidIndexMap.get(b.uid));
    }

    for (const item of folderRequests) {
      if (abortController.signal.aborted) {
        throw new Error('Runner execution cancelled');
      }

      const eventData = { collectionUid, folderUid, itemUid: item.uid };
      emit('main:run-folder-event', { type: 'request-queued', requestUid: uuid(), ...eventData });

      if (item.type === 'grpc-request' || item.type === 'ws-request') {
        const protocolLabel = item.type === 'grpc-request' ? 'gRPC' : 'WebSocket';
        emit('main:run-folder-event', {
          type: 'runner-request-skipped',
          error: `${protocolLabel} requests are skipped in folder/collection runs`,
          responseReceived: {
            status: 'skipped',
            statusText: `${protocolLabel} request skipped`,
            data: null,
            responseTime: 0,
            headers: null
          },
          ...eventData
        });
        continue;
      }

      try {
        if (delay && !Number.isNaN(delay) && delay > 0) {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, delay);
            abortController.signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('Runner execution cancelled'));
            });
          });
        }

        const prepared = await prepareHttpRequest(item, collection);

        emit('main:run-folder-event', { type: 'request-sent', requestSent: prepared.requestSent, ...eventData });

        const timeStart = Date.now();
        const result = await executeHttpRequest(prepared, item, collection, abortController.signal);
        const duration = Date.now() - timeStart;

        if (result.error) {
          emit('main:run-folder-event', { type: 'error', error: result.error, responseReceived: null, ...eventData });
          continue;
        }

        const responseHeaders = headerListToObject(result.headers || []);
        emit('main:run-folder-event', {
          type: 'response-received',
          responseReceived: {
            status: result.status,
            statusText: result.statusText,
            headers: responseHeaders,
            duration: result.durationMs ?? duration,
            dataBuffer: result.dataBase64,
            size: result.size,
            data: decodeBody(result.dataBase64, responseHeaders),
            responseTime: result.durationMs ?? duration,
            timeline: result.timeline || [],
            url: result.finalUrl
          },
          ...eventData
        });
      } catch (error) {
        if (abortController.signal.aborted) {
          throw new Error('Runner execution cancelled');
        }
        emit('main:run-folder-event', {
          type: 'error',
          error: error.message || 'An error occurred while running the request',
          responseReceived: null,
          ...eventData
        });
      }
    }

    emit('main:run-folder-event', {
      type: 'testrun-ended',
      collectionUid,
      folderUid,
      runCompletionTime: new Date().toISOString()
    });
  } catch (error) {
    emit('main:run-folder-event', {
      type: 'testrun-ended',
      collectionUid,
      folderUid,
      statusText: error.message,
      runCompletionTime: new Date().toISOString()
    });
  } finally {
    abortControllers.delete(cancelTokenUid);
  }
};

const registerNetworkHandlers = () => {
  handle('send-http-request', sendHttpRequest);
  handle('renderer:run-collection-folder', runCollectionFolder);
  handle('cancel-http-request', (cancelTokenUid) => {
    abortControllers.get(cancelTokenUid)?.abort();
  });
};

export default registerNetworkHandlers;
