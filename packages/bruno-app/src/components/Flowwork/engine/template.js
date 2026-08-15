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

/**
 * Postman형 요청 템플릿 + 변수 바인딩 + 실행 컨텍스트(env 포함)를 합쳐
 * 프록시로 보낼 준비가 된 요청({method, url, headers, body})을 만든다.
 *
 * 변수 우선순위: variableBindings(워크플로우 매핑) > environment(공통값 fallback).
 * 시크릿(vault:// 참조)은 environment 값에 그대로 남아 프록시가 최종 치환한다.
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
  const url = substitute(rawUrl(request.url), lookup);

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

  return { method, url, headers, body };
}
