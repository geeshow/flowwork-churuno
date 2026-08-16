/**
 * 웹 모드 AI 셔틀 — Electron의 AI IPC 채널을 로컬 AI 브리지 REST API
 * (web-server/ai.py, /api/ai/*)로 중계한다.
 *
 * 브리지는 이 PC의 claude CLI를 감싼 단발 호출 API라 Electron 구현과 달리
 * 도구 호출 루프가 없다. 채팅은 컨텍스트를 프롬프트에 인라인하고, 코드 적용은
 * Electron의 폴백 경로(응답의 코드펜스 추출 → complete.code)와 같은 형태로
 * 내려보내 UI가 동일하게 동작한다.
 *
 * 토큰은 Preferences > AI의 provider 키 입력으로 저장되며(localStorage),
 * 모든 브리지 호출에 Bearer로 실린다.
 */
import { handle, emit } from '../core';
import { serverBaseUrl } from '../server-api';
import { getPreferences } from './boot';
import {
  SCRIPT_TYPES,
  buildScriptSystemPrompt,
  buildScriptUserPrompt,
  buildChatSystemPrompt,
  buildChatPrompt,
  stripCodeFences,
  parseDecline,
  extractFencedCode
} from './ai-prompts';

const TOKEN_KEY = 'bruno-web:ai-token';
const PROVIDER_ID = 'claude-cli';
const MODEL_ID = 'claude-cli';
const MODEL_LABEL = 'Claude CLI (local)';

const activeStreams = new Map();

const getToken = () => localStorage.getItem(TOKEN_KEY) || '';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

const getAiPrefs = () => getPreferences().ai || {};

const buildStatus = () => {
  const aiPrefs = getAiPrefs();
  const hasToken = Boolean(getToken());
  const providerEnabled = Boolean(aiPrefs.providers?.[PROVIDER_ID]?.enabled);
  const modelEnabled = aiPrefs.models?.[MODEL_ID]?.enabled !== false;

  const models = [{ id: MODEL_ID, label: MODEL_LABEL, provider: PROVIDER_ID, isCustom: false }];
  return {
    enabled: Boolean(aiPrefs.enabled),
    providers: {
      [PROVIDER_ID]: {
        id: PROVIDER_ID,
        label: MODEL_LABEL,
        name: MODEL_LABEL,
        apiKeyPlaceholder: 'web-server/.env의 BRUNO_AI_TOKEN 값',
        isCustom: false,
        enabled: providerEnabled,
        configured: hasToken,
        hasApiKey: hasToken
      }
    },
    models,
    availableModels: providerEnabled && hasToken && modelEnabled ? models : []
  };
};

const broadcastStatus = (status) => emit('main:ai-status-changed', status);

const bridgeError = async (response) => {
  let detail = response.statusText;
  try {
    detail = (await response.json()).detail ?? detail;
  } catch (_ignored) {
    // non-JSON error body
  }
  return typeof detail === 'string' ? detail : JSON.stringify(detail);
};

const callGenerate = async ({ system, prompt, signal }) => {
  const response = await fetch(`${serverBaseUrl}/api/ai/generate`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ system, prompt }),
    signal
  });
  if (!response.ok) {
    throw new Error(await bridgeError(response));
  }
  const { text } = await response.json();
  return text || '';
};

// SSE(data: {...}\n\n) 스트림을 읽어 청크마다 onChunk를 호출하고 전체 텍스트를 반환
const callStream = async ({ system, prompt, signal, onChunk }) => {
  const response = await fetch(`${serverBaseUrl}/api/ai/stream`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ system, prompt }),
    signal
  });
  if (!response.ok) {
    throw new Error(await bridgeError(response));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data: '));
      if (!dataLine) continue;

      const payload = JSON.parse(dataLine.slice('data: '.length));
      if (payload.type === 'chunk') {
        fullText += payload.text;
        onChunk?.(payload.text, fullText);
      } else if (payload.type === 'error') {
        throw new Error(payload.error);
      } else if (payload.type === 'done') {
        return payload.fullText || fullText;
      }
    }
  }
  return fullText;
};

const isAbortError = (err) => err?.name === 'AbortError';

const registerAiHandlers = () => {
  handle('renderer:get-ai-status', () => buildStatus());

  handle('renderer:set-ai-api-key', ({ providerId, apiKey }) => {
    if (providerId !== PROVIDER_ID) throw new Error(`Unknown AI provider: ${providerId}`);
    const trimmed = typeof apiKey === 'string' ? apiKey.trim() : '';
    if (!trimmed) throw new Error('API key cannot be empty');
    localStorage.setItem(TOKEN_KEY, trimmed);
    const status = buildStatus();
    broadcastStatus(status);
    return status;
  });

  handle('renderer:clear-ai-api-key', ({ providerId }) => {
    if (providerId !== PROVIDER_ID) throw new Error(`Unknown AI provider: ${providerId}`);
    localStorage.removeItem(TOKEN_KEY);
    const status = buildStatus();
    broadcastStatus(status);
    return status;
  });

  handle('renderer:get-ai-api-key', ({ providerId }) => (providerId === PROVIDER_ID ? getToken() : ''));

  handle('renderer:ai-test-provider', async ({ providerId }) => {
    if (providerId !== PROVIDER_ID) return { ok: false, error: `Unknown provider: ${providerId}` };
    if (!getToken()) return { ok: false, error: 'No API key configured' };
    try {
      const response = await fetch(`${serverBaseUrl}/api/ai/status`, { headers: authHeaders() });
      if (response.status === 401) return { ok: false, error: 'Invalid API key' };
      if (!response.ok) return { ok: false, error: `Could not verify key (HTTP ${response.status})` };
      const status = await response.json();
      return status.ok ? { ok: true } : { ok: false, error: status.error || 'AI bridge unavailable' };
    } catch (err) {
      return { ok: false, error: err.message || 'Could not reach the local AI bridge server.' };
    }
  });

  handle('renderer:ai-generate-text', async (params) => {
    const { system, prompt } = params || {};
    if (!prompt) return { error: 'prompt is required' };
    try {
      const text = await callGenerate({ system, prompt });
      return { text };
    } catch (err) {
      return { error: err.message || 'Failed to generate text' };
    }
  });

  handle('renderer:ai-generate-script', async (params) => {
    const { scriptType, prompt, currentScript, requestContext, docsContext, variables, streamId } = params || {};

    if (!SCRIPT_TYPES.includes(scriptType)) return { error: `Unknown scriptType: ${scriptType}` };
    if (!prompt || !prompt.trim()) return { error: 'Prompt is required' };
    if (!getAiPrefs().enabled) return { error: 'AI features are disabled. Enable them in Preferences > AI.' };
    if (!getToken()) return { error: 'No AI model available. Configure a provider in Preferences > AI.' };

    const controller = new AbortController();
    if (streamId) activeStreams.set(streamId, controller);

    try {
      const fullText = await callGenerate({
        system: buildScriptSystemPrompt(scriptType),
        prompt: buildScriptUserPrompt({ userPrompt: prompt, currentScript, requestContext, docsContext, variables, scriptType }),
        signal: controller.signal
      });

      const declineReason = parseDecline(fullText);
      if (declineReason) return { error: declineReason, declined: true };

      const content = stripCodeFences(fullText);
      if (!content || !content.trim()) {
        return { error: 'No content was generated. Try rephrasing your prompt.' };
      }
      return { content, modelId: MODEL_ID };
    } catch (err) {
      if (isAbortError(err)) return { stopped: true };
      return { error: err.message || 'Failed to generate script' };
    } finally {
      if (streamId) activeStreams.delete(streamId);
    }
  });

  handle('renderer:ai-stream-text', async (params) => {
    const { streamId, system, prompt, messages } = params || {};
    if (!streamId) return;

    if (activeStreams.has(streamId)) {
      emit('main:ai-stream-error', { streamId, error: 'streamId is already active' });
      return;
    }
    if (!messages && !prompt) {
      emit('main:ai-stream-error', { streamId, error: 'messages/prompt are required' });
      return;
    }

    const flatPrompt = messages
      ? messages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')
      : prompt;

    const controller = new AbortController();
    activeStreams.set(streamId, controller);
    let fullText = '';

    try {
      fullText = await callStream({
        system,
        prompt: flatPrompt,
        signal: controller.signal,
        onChunk: (chunk, text) => emit('main:ai-stream-chunk', { streamId, chunk, fullText: text })
      });
      emit('main:ai-stream-complete', { streamId, fullText });
    } catch (err) {
      if (isAbortError(err)) {
        emit('main:ai-stream-stopped', { streamId, fullText });
      } else {
        emit('main:ai-stream-error', { streamId, error: err.message || 'Failed to stream' });
      }
    } finally {
      activeStreams.delete(streamId);
    }
  });

  handle('renderer:ai-stop-stream', ({ streamId } = {}) => {
    const controller = activeStreams.get(streamId);
    if (controller) {
      controller.abort();
      activeStreams.delete(streamId);
    }
  });

  handle('renderer:ai-chat-stream', async (payload) => {
    const { messages, allContent, contentType, requestContext, variables, requests, requestId } = payload || {};
    if (!requestId || typeof requestId !== 'string') return;

    if (!Array.isArray(messages)) {
      emit('main:ai-chat-error', { requestId, error: 'Invalid request: messages must be an array' });
      return;
    }
    if (!getAiPrefs().enabled) {
      emit('main:ai-chat-error', { requestId, error: 'AI features are disabled. Enable them in Preferences > AI.' });
      return;
    }
    if (!getToken()) {
      emit('main:ai-chat-error', { requestId, error: 'No AI model available. Configure a provider in Preferences > AI.' });
      return;
    }

    const effectiveType = contentType || 'app';
    const controller = new AbortController();
    activeStreams.set(requestId, controller);
    let fullText = '';

    try {
      fullText = await callStream({
        system: buildChatSystemPrompt(effectiveType),
        prompt: buildChatPrompt({ messages, allContent, contentType: effectiveType, requestContext, variables, requests }),
        signal: controller.signal,
        onChunk: (chunk, text) => emit('main:ai-chat-chunk', { requestId, chunk, fullText: text })
      });

      if (fullText.trim()) {
        emit('main:ai-chat-complete', {
          requestId,
          message: fullText,
          code: extractFencedCode(fullText),
          contentType: effectiveType
        });
      } else {
        emit('main:ai-chat-complete', {
          requestId,
          message: 'I wasn\'t able to generate a response. Could you try rephrasing your request?',
          code: null,
          contentType: effectiveType
        });
      }
    } catch (err) {
      if (isAbortError(err)) {
        emit('main:ai-chat-stopped', { requestId, message: fullText });
      } else {
        emit('main:ai-chat-error', { requestId, error: err.message || 'Failed to get AI response' });
      }
    } finally {
      activeStreams.delete(requestId);
    }
  });

  handle('renderer:ai-chat-stop', ({ requestId } = {}) => {
    const controller = activeStreams.get(requestId);
    if (controller) {
      controller.abort();
      activeStreams.delete(requestId);
    }
  });

  // 키 입력마다 CLI를 띄우기엔 지연이 너무 커서 웹 브리지에서는 비활성
  handle('renderer:ai-autocomplete', () => ({ disabled: true }));
  handle('renderer:ai-autocomplete-cancel', () => undefined);
};

export default registerAiHandlers;
