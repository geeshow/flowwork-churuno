import { resolveValue } from './resolver';

const TEMPLATE_VAR = /\{\{(\w+)\}\}/g;

/** 문자열 내 {{var}}를 lookup 결과로 치환. 미해결 변수는 에러. */
const substitute = (input, lookup) => {
  return input.replace(TEMPLATE_VAR, (_, name) => {
    const value = lookup(name);
    if (value === undefined) {
      throw new Error(`변수 {{${name}}}를 리졸브할 수 없습니다.`);
    }
    return value === null ? '' : String(value);
  });
};

const rawUrl = (url) => (typeof url === 'string' ? url : url.raw ?? '');

// 요청 필드 바인딩 키 — 템플릿 변수({{\w+}})와 겹치지 않도록 콜론으로 구분한다.
const FIELD_SLOT = /^(header|query|body):(.+)$/;

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// {{var}}가 든 값은 템플릿 변수 행으로 이미 바인딩되므로 필드 슬롯에서 제외한다.
const isTemplated = (value) => typeof value === 'string' && value.includes('{{');

const bodyLeaves = (obj, prefix = '') => {
  const leaves = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) leaves.push(...bodyLeaves(value, path));
    else if (!isTemplated(value)) leaves.push({ path, value });
  }
  return leaves;
};

const decodeQueryValue = (value) => {
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return value;
  }
};

/**
 * 요청 템플릿의 헤더/쿼리 파라미터/바디 필드를 바인딩 슬롯으로 나열한다.
 * 키는 `header:<이름>` / `query:<이름>` / `body:<점 표기 경로>` 형태로
 * variableBindings에 템플릿 변수와 나란히 저장되고, resolveTemplate이 적용한다.
 * value는 템플릿에 적힌 값 — 편집기가 고정값 기본 바인딩으로 미리 채우는 데 쓴다
 * (배열 값은 한 줄 입력으로 편집할 수 없어 value 없이 나열만 한다).
 */
export function requestFieldSlots(template) {
  const slots = [];

  for (const h of template.header ?? []) {
    if (h.disabled || isTemplated(h.value)) continue;
    slots.push({ key: `header:${h.key}`, label: `헤더 ${h.key}`, value: h.value });
  }

  const [, queryString] = rawUrl(template.url).split('?');
  for (const pair of queryString ? queryString.split('&') : []) {
    const [name, value = ''] = pair.split('=');
    if (name && !isTemplated(value)) {
      slots.push({ key: `query:${name}`, label: `쿼리 ${name}`, value: decodeQueryValue(value) });
    }
  }

  if (template.body?.mode === 'raw' && template.body.raw) {
    try {
      const parsed = JSON.parse(template.body.raw);
      if (isPlainObject(parsed)) {
        for (const { path, value } of bodyLeaves(parsed)) {
          const slot = { key: `body:${path}`, label: `바디 ${path}` };
          if (!Array.isArray(value)) slot.value = value;
          slots.push(slot);
        }
      }
    } catch (_error) {
      // 바디가 JSON이 아니면(또는 {{var}} 때문에 파싱이 안 되면) 필드 단위 바인딩 대상이 아니다
    }
  }

  return slots;
}

const setQueryParam = (url, name, value) => {
  const [base, query = ''] = url.split('?');
  const pairs = query ? query.split('&') : [];
  const next = `${name}=${encodeURIComponent(value)}`;
  const index = pairs.findIndex((pair) => pair.split('=')[0] === name);
  if (index >= 0) pairs[index] = next;
  else pairs.push(next);
  return `${base}?${pairs.join('&')}`;
};

const setBodyField = (body, path, value) => {
  const keys = path.split('.');
  let target = body;
  for (const key of keys.slice(0, -1)) {
    if (!isPlainObject(target[key])) target[key] = {};
    target = target[key];
  }
  target[keys[keys.length - 1]] = value;
};

/**
 * Postman형 요청 템플릿 + 변수 바인딩 + 실행 컨텍스트(env 포함)를 합쳐
 * 프록시로 보낼 준비가 된 요청({method, url, headers, body})을 만든다.
 *
 * 변수 우선순위: variableBindings(워크플로우 매핑) > environment(공통값 fallback).
 * 시크릿(vault:// 참조)은 environment 값에 그대로 남아 프록시가 최종 치환한다.
 *
 * `header:` / `query:` / `body:` 키의 필드 바인딩은 치환이 끝난 요청 위에
 * 덮어쓴다 — 바인딩하지 않은 필드는 템플릿의 리터럴 값이 그대로 남는다.
 */
export function resolveTemplate(request, binding, ctx) {
  const lookup = (name) => {
    if (name in binding.variableBindings) {
      return resolveValue(binding.variableBindings[name], ctx);
    }
    if (name in ctx.env) return ctx.env[name];
    return undefined;
  };

  const method = request.method.toUpperCase();
  let url = substitute(rawUrl(request.url), lookup);

  const headers = {};
  for (const h of request.header ?? []) {
    if (h.disabled) continue;
    headers[h.key] = substitute(h.value, lookup);
  }

  let body;
  if (request.body?.mode === 'raw' && request.body.raw) {
    const rawBody = substitute(request.body.raw, lookup);
    try {
      body = JSON.parse(rawBody);
    } catch (_error) {
      body = rawBody; // JSON이 아니면 문자열 그대로
    }
  }

  for (const [key, source] of Object.entries(binding.variableBindings)) {
    const slot = FIELD_SLOT.exec(key);
    if (!slot) continue;
    const [, part, name] = slot;
    const value = resolveValue(source, ctx);
    if (part === 'header') headers[name] = value === null ? '' : String(value);
    else if (part === 'query') url = setQueryParam(url, name, value === null ? '' : String(value));
    else if (part === 'body' && isPlainObject(body)) setBodyField(body, name, value);
  }

  return { method, url, headers, body };
}
