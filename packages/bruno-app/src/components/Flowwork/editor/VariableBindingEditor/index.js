import React from 'react';

const DEFAULT_BY_KIND = {
  USER_INPUT: { kind: 'USER_INPUT', inputKey: '' },
  ENV: { kind: 'ENV', envKey: '' },
  FIXED: { kind: 'FIXED', value: '' },
  PREV_RESPONSE: { kind: 'PREV_RESPONSE', stepId: '', jsonPath: '$.' },
  LOOP_ITEM: { kind: 'LOOP_ITEM', itemPath: '$' }
};

/**
 * 변수 → ValueSource 매핑 — 각 변수를 소스 하나로 지정한다:
 * 기본입력값(USER_INPUT) / 환경변수값(ENV) / 고정값(FIXED) / 전 단계 output(PREV_RESPONSE),
 * 그리고 반복 스텝에서는 그 회차의 항목(LOOP_ITEM).
 * 전 단계 output이 배열·객체형이면 jsonPath로 고급 매핑한다.
 *
 * variables 항목은 문자열(템플릿 변수, `{{이름}}`으로 표시) 또는
 * { key, label } 슬롯(요청 필드 — 헤더/쿼리/바디)이다.
 */
export function VariableBindingEditor({ variables, bindings, inputKeys, envKeys, prevStepIds, repeating, onChange }) {
  if (variables.length === 0) {
    return <p className="muted">매핑할 변수가 없습니다.</p>;
  }

  const slots = variables.map((v) => (typeof v === 'string' ? { key: v, label: `{{${v}}}` } : v));

  return (
    <div className="binding-list">
      {slots.map(({ key: v, label }) => {
        const src = bindings[v];
        return (
          <div key={v} className="binding-row">
            <code className="binding-var">{label}</code>
            <select value={src?.kind ?? ''} onChange={(e) => onChange(v, DEFAULT_BY_KIND[e.target.value])}>
              <option value="" disabled>
                소스 선택…
              </option>
              <option value="USER_INPUT">기본 입력값</option>
              <option value="ENV">환경변수값</option>
              <option value="FIXED">고정값</option>
              <option value="PREV_RESPONSE">전 단계 output</option>
              {repeating ? <option value="LOOP_ITEM">반복 항목</option> : null}
            </select>

            {src?.kind === 'USER_INPUT' ? (
              <select value={src.inputKey} onChange={(e) => onChange(v, { kind: 'USER_INPUT', inputKey: e.target.value })}>
                <option value="" disabled>
                  기본 입력값 선택…
                </option>
                {inputKeys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            ) : null}

            {src?.kind === 'ENV' ? (
              <select value={src.envKey} onChange={(e) => onChange(v, { kind: 'ENV', envKey: e.target.value })}>
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

            {src?.kind === 'FIXED' ? (
              <input
                type="text"
                placeholder="고정값"
                value={src.value == null ? '' : String(src.value)}
                onChange={(e) => onChange(v, { kind: 'FIXED', value: e.target.value })}
              />
            ) : null}

            {src?.kind === 'PREV_RESPONSE' ? (
              <>
                <select
                  value={src.stepId}
                  onChange={(e) => onChange(v, { kind: 'PREV_RESPONSE', stepId: e.target.value, jsonPath: src.jsonPath })}
                >
                  <option value="" disabled>
                    전 단계 선택…
                  </option>
                  {prevStepIds.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className="jsonpath-input"
                  placeholder="$.data.id  (배열/객체는 고급 매핑: $.items[0].id, $.list[*].id)"
                  value={src.jsonPath}
                  onChange={(e) => onChange(v, { kind: 'PREV_RESPONSE', stepId: src.stepId, jsonPath: e.target.value })}
                />
              </>
            ) : null}

            {src?.kind === 'LOOP_ITEM' ? (
              <input
                type="text"
                className="jsonpath-input"
                placeholder="$.accountNo  (항목 자체를 쓰려면 $)"
                value={src.itemPath ?? '$'}
                onChange={(e) => onChange(v, { kind: 'LOOP_ITEM', itemPath: e.target.value })}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default VariableBindingEditor;
