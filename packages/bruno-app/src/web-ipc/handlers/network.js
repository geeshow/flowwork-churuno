import { buildHar } from '@usebruno/common';
import { handle, emit } from '../core';
import serverApi from '../server-api';
import { getPreferences } from './boot';
import { uuid } from 'utils/common';
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

const sendHttpRequest = async (item, collection, environment, runtimeVariables) => {
  const requestUid = item.requestUid;
  const eventBase = { itemUid: item.uid, collectionUid: collection.uid, requestUid };
  const cancelTokenUid = uuid();

  emit('main:run-request-event', { type: 'request-queued', ...eventBase, cancelTokenUid });

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

  emit('main:run-request-event', { type: 'request-sent', ...eventBase, cancelTokenUid, requestSent });

  const preferences = getPreferences();
  const timeoutMs = preferences?.request?.timeout || 0;
  const abortController = new AbortController();
  abortControllers.set(cancelTokenUid, abortController);

  let result;
  try {
    result = await serverApi.executeHttpRequest(
      {
        method: request.method,
        url: wireUrl,
        headers: har.headers || [],
        postData: har.postData ?? null,
        timeoutMs: timeoutMs > 0 ? timeoutMs : null,
        followRedirects: true,
        verifyTls: preferences?.request?.sslVerification !== false
      },
      { signal: abortController.signal }
    );
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

const registerNetworkHandlers = () => {
  handle('send-http-request', sendHttpRequest);
  handle('cancel-http-request', (cancelTokenUid) => {
    abortControllers.get(cancelTokenUid)?.abort();
  });
};

export default registerNetworkHandlers;
