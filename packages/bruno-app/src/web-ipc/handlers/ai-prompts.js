/**
 * 웹 모드 AI 브리지용 프롬프트 빌더.
 *
 * Electron의 AI 구현(bruno-electron/src/ipc/ai)은 ai SDK의 도구 호출 루프를
 * 쓰지만, 웹 브리지는 단발 호출(claude CLI)이라 도구 대신 필요한 컨텍스트를
 * 전부 프롬프트에 인라인한다. DECLINE 센티널·코드펜스 규약은 Electron 쪽과
 * 동일하게 유지해 UI가 같은 방식으로 동작한다.
 */

export const SCRIPT_TYPES = ['tests', 'app-request', 'app-collection', 'docs'];

export const DECLINE_PREFIX = 'BRUNO_AI_DECLINE:';

const CONTENT_LABELS = {
  'app': 'App Code',
  'tests': 'Test Code',
  'pre-request': 'Pre-Request Script',
  'post-response': 'Post-Response Script',
  'docs': 'Documentation'
};

// Electron 쪽 컨텍스트 포매터와 동일한 민감값 마스킹 기준
const SENSITIVE_NAME_PATTERN = /api[_-]?key|token|secret|password|^authorization$|^cookie$/i;

const maskValue = (name, value) => (SENSITIVE_NAME_PATTERN.test(name || '') ? '<redacted>' : value);

const truncate = (text, max = 400) => {
  const str = String(text ?? '');
  return str.length > max ? `${str.slice(0, max)}…` : str;
};

// 응답 본문은 값 대신 형태(키 + 타입)만 모델에 보여준다
const describeShape = (value, depth = 0) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return depth >= 3 ? 'array' : `[${describeShape(value[0], depth + 1)}, …(${value.length} items)]`;
  }
  if (typeof value === 'object') {
    if (depth >= 3) return 'object';
    const entries = Object.entries(value)
      .slice(0, 30)
      .map(([k, v]) => `${k}: ${describeShape(v, depth + 1)}`);
    return `{ ${entries.join(', ')} }`;
  }
  return typeof value;
};

const formatRequestContext = (ctx) => {
  if (!ctx) return '';
  const lines = [`${ctx.method || 'GET'} ${ctx.url || ''}`];
  const headers = (ctx.headers || []).filter((h) => h.enabled !== false && h.name);
  if (headers.length) {
    lines.push('Headers:');
    headers.forEach((h) => lines.push(`  ${h.name}: ${maskValue(h.name, h.value)}`));
  }
  const params = (ctx.params || []).filter((p) => p.enabled !== false && p.name);
  if (params.length) {
    lines.push('Params:');
    params.forEach((p) => lines.push(`  ${p.name}=${maskValue(p.name, p.value)}`));
  }
  if (ctx.body && ctx.body.mode && ctx.body.mode !== 'none') {
    const raw = ctx.body[ctx.body.mode === 'graphql' ? 'graphql' : ctx.body.mode];
    lines.push(`Body (${ctx.body.mode}): ${truncate(typeof raw === 'string' ? raw : JSON.stringify(raw), 800)}`);
  }
  if (ctx.responseStatus != null || ctx.responseData != null) {
    lines.push(`Last response status: ${ctx.responseStatus ?? '(unknown)'}`);
    if (ctx.responseData != null) {
      lines.push(`Last response shape (values stripped): ${truncate(describeShape(ctx.responseData), 1500)}`);
    }
  } else {
    lines.push('Last response: (request has not been executed yet)');
  }
  return lines.join('\n');
};

const formatVariables = (variables) => {
  if (!Array.isArray(variables) || variables.length === 0) return '';
  return variables
    .slice(0, 60)
    .map((v) => `  ${v.name} [${v.scope}]${v.secret ? ' (secret — use bru accessor, never hard-code)' : ` = ${truncate(v.value, 80)}`}`)
    .join('\n');
};

const BRU_API_NOTES = `Bruno scripting API essentials:
- Variables: bru.getEnvVar(name), bru.setEnvVar(name, value), bru.getVar(name), bru.setVar(name, value), bru.getGlobalEnvVar(name), bru.getCollectionVar(name), bru.getSecretVar(name), bru.interpolate(str)
- Request (pre-request): req.getUrl()/setUrl(), req.getMethod()/setMethod(), req.getHeader(name)/setHeader(name, value), req.getBody()/setBody()
- Response (post-response/tests): res.status, res.statusText, res.headers, res.body (parsed), res.responseTime
- Tests: test("name", function() { ... }) with chai expect(), e.g. expect(res.status).to.equal(200)
- Node built-ins are unavailable; write plain JavaScript.`;

const SCRIPT_SYSTEM_PROMPTS = {
  'tests': `You write test scripts for the Bruno API client. Output ONLY the complete JavaScript test code — no explanations, no markdown fences.
${BRU_API_NOTES}
Use test() blocks with chai expect assertions against res.*. Reference response fields by path; never hard-code redacted placeholder values.`,
  'app-request': `You write Bruno App code attached to an HTTP request. Output ONLY the complete JavaScript code — no explanations, no markdown fences.
${BRU_API_NOTES}`,
  'app-collection': `You write Bruno App code attached to a collection or folder. Output ONLY the complete JavaScript code — no explanations, no markdown fences.
${BRU_API_NOTES}
Use bru.ctx.runRequest(pathname) to execute requests by pathname.`,
  // 문서 대상은 요청 하나만이 아니다 — flowwork의 작업(API 호출을 엮은 워크플로우)과
  // 그것을 묶은 폴더도 같은 탭에서 문서를 쓴다. 범위를 좁게 적으면 모델이
  // "API 문서 작성 범위 밖"이라며 DECLINE으로 돌려보낸다.
  'docs': `You write documentation in Markdown for the Bruno API client. The subject is an HTTP request, a flowwork workflow (a saved chain of API calls run as one task), or a folder grouping such workflows. Output ONLY the complete Markdown document — no explanations, no code fences around the whole document.`
};

const declineInstruction = `If the request is unrelated to this task or impossible with the given context, reply with a single line starting with "${DECLINE_PREFIX}" followed by a short reason, and nothing else.`;

export const buildScriptSystemPrompt = (scriptType) =>
  `${SCRIPT_SYSTEM_PROMPTS[scriptType]}\n${declineInstruction}`;

export const buildScriptUserPrompt = ({ userPrompt, currentScript, requestContext, docsContext, variables, scriptType }) => {
  const sections = [];
  const ctx = formatRequestContext(requestContext);
  if (ctx) sections.push(`HTTP Request Context:\n${ctx}`);
  if (docsContext) sections.push(`Documentation Context:\n${truncate(JSON.stringify(docsContext, null, 1), 2000)}`);
  const vars = formatVariables(variables);
  if (vars) sections.push(`Available variables:\n${vars}`);
  if (currentScript && currentScript.trim()) {
    sections.push(`Current ${CONTENT_LABELS[scriptType] || scriptType} (produce the COMPLETE updated version, not a diff):\n${currentScript}`);
  }
  sections.push(`Task: ${userPrompt}`);
  return sections.join('\n\n');
};

export const buildChatSystemPrompt = (contentType) => {
  const label = CONTENT_LABELS[contentType] || contentType;
  return `You are the AI assistant inside the Bruno API client, helping with an HTTP request. The user is currently viewing the ${label} tab.
${BRU_API_NOTES}
When the user asks you to write or modify code/documentation for a section, reply with a short explanation and then EXACTLY ONE fenced code block containing the COMPLETE updated content for that section (never a diff). For questions, answer normally without a code block. Never invent variable names — use only the ones listed in the context; secret values must be read via bru accessors, never hard-coded.`;
};

// 단발 CLI 호출이라 대화 이력을 하나의 프롬프트로 평탄화한다
export const buildChatPrompt = ({ messages, allContent, contentType, requestContext, variables, requests }) => {
  const sections = [];
  const ctx = formatRequestContext(requestContext);
  if (ctx) sections.push(`HTTP Request Context:\n${ctx}`);

  const vars = formatVariables(variables);
  if (vars) sections.push(`Available variables:\n${vars}`);

  if (Array.isArray(requests) && requests.length > 0) {
    const list = requests
      .slice(0, 40)
      .map((r) => `  ${r.method} ${r.name} — ${r.url} (pathname: ${r.pathname})`)
      .join('\n');
    sections.push(`Requests in this collection:\n${list}`);
  }

  const content = allContent || {};
  const filled = Object.entries(content).filter(([, value]) => value && value.trim());
  if (filled.length > 0) {
    const blocks = filled
      .map(([type, value]) => `${CONTENT_LABELS[type] || type}${type === contentType ? ' (active tab)' : ''}:\n\`\`\`\n${value}\n\`\`\``)
      .join('\n\n');
    sections.push(`Current request content:\n${blocks}`);
  } else {
    sections.push(`The ${CONTENT_LABELS[contentType] || contentType} (active tab) is currently empty.`);
  }

  const transcript = (messages || [])
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
  sections.push(`Conversation so far:\n${transcript}\n\nAssistant:`);

  return sections.join('\n\n');
};

// ---------------------------------------------------------------------------
// 자동완성(고스트 텍스트)
// ---------------------------------------------------------------------------
// 커서 앞뒤를 그대로 주고 "이어질 것"만 받는다. 설명이 섞이면 편집기에 그대로
// 박히므로 출력 형식을 강하게 못박고, 받은 뒤에도 한 번 더 걸러낸다.
const AUTOCOMPLETE_SYSTEM_PROMPTS = {
  docs: `You complete Markdown documentation inside an editor. The user is documenting an automated workflow that chains API calls.
Continue the text at <CURSOR> in the same language, voice, and Markdown structure as the surrounding document.`,
  default: `You complete JavaScript inside the Bruno API client's script editor.
Continue the code at <CURSOR> in the same style as the surrounding code.
${BRU_API_NOTES}`
};

const AUTOCOMPLETE_RULES = `Rules:
- Output ONLY the text that replaces <CURSOR>. No explanations, no markdown fences, no repetition of the text before the cursor.
- Complete at most a few lines — finish the current thought, not the whole document.
- Return an empty response if nothing useful can be added.`;

export const buildAutocompleteSystemPrompt = (scriptType) =>
  `${AUTOCOMPLETE_SYSTEM_PROMPTS[scriptType] || AUTOCOMPLETE_SYSTEM_PROMPTS.default}\n${AUTOCOMPLETE_RULES}`;

export const buildAutocompletePrompt = ({ prefix, suffix, requestContext, docsContext, variableNames }) => {
  const sections = [];
  const ctx = formatRequestContext(requestContext);
  if (ctx) sections.push(`HTTP Request Context:\n${ctx}`);
  if (docsContext) sections.push(`What is being documented:\n${truncate(JSON.stringify(docsContext, null, 1), 2000)}`);
  if (Array.isArray(variableNames) && variableNames.length > 0) {
    sections.push(`Known variable names: ${variableNames.slice(0, 60).join(', ')}`);
  }
  // 커서에서 먼 앞부분은 잘라낸다 — 완성에 쓰이는 것은 가까운 문맥이다
  sections.push(`Document so far (the cursor is at <CURSOR>):\n${prefix.slice(-2000)}<CURSOR>${suffix.slice(0, 500)}`);
  return sections.join('\n\n');
};

// 모델이 규칙을 어기고 붙이는 것들(코드펜스·머리말·커서 표식)을 걷어낸다
export const sanitizeCompletion = (text, { prefix = '', maxLines = 6 } = {}) => {
  if (!text) return '';
  let out = stripCodeFences(text).replace(/<CURSOR>/g, '');
  // 앞 문맥을 통째로 되풀이해 오면 이어지는 부분만 남긴다
  const tail = prefix.slice(-200);
  if (tail && out.startsWith(tail)) out = out.slice(tail.length);
  const lines = out.split('\n').slice(0, maxLines);
  return lines.join('\n').replace(/\s+$/, '');
};

export const stripCodeFences = (text) => {
  if (!text) return '';
  let out = text.trim();
  out = out.replace(/^```[\w-]*\n?/, '');
  out = out.replace(/\n?```\s*$/, '');
  out = out.replace(/^(?:Here(?:'s| is| are)[^\n]*\n)+/i, '');
  return out.replace(/^\n+/, '');
};

export const parseDecline = (text) => {
  if (!text) return null;
  const cleaned = stripCodeFences(text).trim();
  if (!cleaned.startsWith(DECLINE_PREFIX)) return null;
  const reason = cleaned.slice(DECLINE_PREFIX.length).split('\n')[0].trim();
  return reason || 'This request is outside what can be generated here.';
};

export const extractFencedCode = (text) => {
  if (!text) return null;
  const fenced = text.match(/```(?:[\w-]+)?\s*\n([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : null;
};
