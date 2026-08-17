import React from 'react';

import { conditionSource } from '../../engine/branch';

const OPERATORS = [
  { value: 'EQ', label: '= (같음)', needsValue: true },
  { value: 'NE', label: '≠ (다름)', needsValue: true },
  { value: 'GT', label: '> (초과)', needsValue: true },
  { value: 'GTE', label: '≥ (이상)', needsValue: true },
  { value: 'LT', label: '< (미만)', needsValue: true },
  { value: 'LTE', label: '≤ (이하)', needsValue: true },
  { value: 'EXISTS', label: '값 있음', needsValue: false },
  { value: 'NOT_EXISTS', label: '값 없음', needsValue: false },
  { value: 'CONTAINS', label: '포함', needsValue: true }
];

const SOURCE_DEFAULTS = {
  PREV_RESPONSE: { kind: 'PREV_RESPONSE', stepId: '', jsonPath: '$.' },
  USER_INPUT: { kind: 'USER_INPUT', inputKey: '' },
  ENV: { kind: 'ENV', envKey: '' },
  LOOP_ITEM: { kind: 'LOOP_ITEM', itemPath: '$' }
};

/**
 * 분기 조건 — 없으면 항상 실행, 있으면 조건이 맞을 때만 실행한다.
 * 반대 조건(≠, 값 없음)을 붙인 스텝을 나란히 두면 if/else가 된다.
 */
export function BranchConditionEditor({ condition, prevStepIds, inputKeys, envKeys, repeating, onChange }) {
  if (!condition) {
    return (
      <div>
        <p className="muted">분기 조건 없음 — 항상 실행됩니다.</p>
        <button
          className="link"
          onClick={() => onChange({ source: SOURCE_DEFAULTS.USER_INPUT, operator: 'EQ', compareValue: '' })}
        >
          + 분기 조건 추가
        </button>
      </div>
    );
  }

  const source = conditionSource(condition);
  const op = OPERATORS.find((o) => o.value === condition.operator);
  // 조건은 새 형태(source)로 저장한다 — 옛 파일의 sourceStepId/jsonPath는 읽을 때만 쓴다
  const set = (patch) => onChange({ source, operator: condition.operator, compareValue: condition.compareValue, ...patch });
  const setSource = (patch) => set({ source: { ...source, ...patch } });

  return (
    <div className="branch-editor">
      <div className="branch-row">
        <select value={source.kind} onChange={(e) => set({ source: SOURCE_DEFAULTS[e.target.value] })}>
          <option value="PREV_RESPONSE">전 단계 output</option>
          <option value="USER_INPUT">입력값</option>
          <option value="ENV">환경변수값</option>
          {repeating ? <option value="LOOP_ITEM">반복 항목</option> : null}
        </select>

        {source.kind === 'PREV_RESPONSE' ? (
          <>
            <select value={source.stepId} onChange={(e) => setSource({ stepId: e.target.value })}>
              <option value="" disabled>
                소스 스텝…
              </option>
              {prevStepIds.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              className="jsonpath-input"
              placeholder="$.data.status"
              value={source.jsonPath ?? ''}
              onChange={(e) => setSource({ jsonPath: e.target.value })}
            />
          </>
        ) : null}

        {source.kind === 'USER_INPUT' ? (
          <select value={source.inputKey} onChange={(e) => setSource({ inputKey: e.target.value })}>
            <option value="" disabled>
              입력값 선택…
            </option>
            {inputKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        ) : null}

        {source.kind === 'ENV' ? (
          <select value={source.envKey} onChange={(e) => setSource({ envKey: e.target.value })}>
            <option value="" disabled>
              환경변수 선택…
            </option>
            {envKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        ) : null}

        {source.kind === 'LOOP_ITEM' ? (
          <input
            className="jsonpath-input"
            placeholder="$.status  (항목 자체를 쓰려면 $)"
            value={source.itemPath ?? '$'}
            onChange={(e) => setSource({ itemPath: e.target.value })}
          />
        ) : null}

        <select value={condition.operator} onChange={(e) => set({ operator: e.target.value })}>
          {OPERATORS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {op?.needsValue ? (
          <input
            placeholder="비교값"
            value={condition.compareValue == null ? '' : String(condition.compareValue)}
            onChange={(e) => set({ compareValue: e.target.value })}
          />
        ) : null}
      </div>
      <button className="link small" onClick={() => onChange(undefined)}>
        분기 조건 제거
      </button>
    </div>
  );
}

export default BranchConditionEditor;
