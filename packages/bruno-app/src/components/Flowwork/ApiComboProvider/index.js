import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';

import api from '../api';
import { ComboCache, extractOne, extractRows } from '../engine/comboCache';
import { resolveTemplate } from '../engine/template';

const Ctx = createContext(null);

/** 프록시 호출 결과가 실패(HTTP 4xx/5xx 또는 네트워크 오류)면 메시지를 담아 던진다. */
const ensureOk = (res) => {
  const { status, body } = res.response;
  if (status != null && status >= 200 && status < 400) return;
  const detail
    = body && typeof body === 'object'
      ? String(body.error ?? body.detail ?? body.message ?? JSON.stringify(body).slice(0, 200))
      : String(body ?? '');
  throw new Error(status == null ? `네트워크 오류: ${detail}` : `HTTP ${status}: ${detail}`);
};

const baseCtx = (env) => ({ userInputs: {}, env, stepResponses: new Map() });

const refBinding = (entry, variableBindings) => ({
  catalogEntry: {
    department: entry.department,
    collectionFile: entry.collectionFile,
    itemPath: entry.itemPath,
    name: entry.name
  },
  variableBindings
});

// 의존값은 {{dependsOnKey}} 변수에 채운다 (조회 API의 변수명 = dependsOnKey 규약).
// "둘 중 하나"만 쓰는 API를 위해 나머지 비-환경 변수는 빈 문자열로 채워
// 미해결 에러를 막는다 (env 변수는 fallback으로 해결됨).
const dependentBindings = (entry, dependsOnKey, dependValue, env) => {
  const bindings = {};
  for (const v of entry.variables) {
    if (v === dependsOnKey) bindings[v] = { kind: 'FIXED', value: dependValue };
    else if (!(v in env)) bindings[v] = { kind: 'FIXED', value: '' };
  }
  return bindings;
};

/**
 * API_COMBO 캐시 Provider — 워크플로우 실행 화면 최상단(WorkflowRunner)에 배치해,
 * 워크플로우 세션이 바뀌면 캐시도 자연히 초기화되도록 한다.
 */
export function ApiComboProvider({ entries, env, children }) {
  const cacheRef = useRef(new ComboCache());
  const entryById = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  const getOptions = useCallback(
    async (sourceApiId, labelField, valueField) => {
      const entry = entryById.get(sourceApiId);
      if (!entry) throw new Error(`콤보 소스 API를 찾을 수 없습니다: ${sourceApiId}`);
      const key = `${sourceApiId}|${labelField}|${valueField}`;
      return cacheRef.current.get(key, async () => {
        const request = resolveTemplate(entry.requestTemplate, refBinding(entry, {}), baseCtx(env));
        const res = await api.invoke(request);
        ensureOk(res);
        return extractRows(res.response.body).map((row) => ({
          label: String(row[labelField]),
          value: String(row[valueField])
        }));
      });
    },
    [entryById, env]
  );

  const lookup = useCallback(
    async (lookupApiId, dependsOnKey, dependValue) => {
      const entry = entryById.get(lookupApiId);
      if (!entry) throw new Error(`조회 API를 찾을 수 없습니다: ${lookupApiId}`);
      const bindings = dependentBindings(entry, dependsOnKey, dependValue, env);
      const request = resolveTemplate(entry.requestTemplate, refBinding(entry, bindings), baseCtx(env));
      const res = await api.invoke(request);
      ensureOk(res);
      return extractOne(res.response.body);
    },
    [entryById, env]
  );

  const lookupList = useCallback(
    async (lookupApiId, dependsOnKey, dependValue, labelField, valueField) => {
      const entry = entryById.get(lookupApiId);
      if (!entry) throw new Error(`조회 API를 찾을 수 없습니다: ${lookupApiId}`);
      const key = `list|${lookupApiId}|${dependsOnKey}|${dependValue}|${labelField}|${valueField}`;
      return cacheRef.current.get(key, async () => {
        const bindings = dependentBindings(entry, dependsOnKey, dependValue, env);
        const request = resolveTemplate(entry.requestTemplate, refBinding(entry, bindings), baseCtx(env));
        const res = await api.invoke(request);
        ensureOk(res);
        return extractRows(res.response.body).map((row) => ({
          label: String(row[labelField] ?? ''),
          value: String(row[valueField] ?? '')
        }));
      });
    },
    [entryById, env]
  );

  const outputLabels = useCallback((apiId) => entryById.get(apiId)?.outputLabels ?? {}, [entryById]);

  const value = useMemo(
    () => ({ getOptions, lookup, lookupList, outputLabels }),
    [getOptions, lookup, lookupList, outputLabels]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApiCombo() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApiCombo must be used within ApiComboProvider');
  return ctx;
}
