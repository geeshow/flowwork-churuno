import React, { useState } from 'react';
import toast from 'react-hot-toast';

import api from '../../api';

const isEncryptedValue = (value) => typeof value === 'string' && value.startsWith('enc:v1:');

/**
 * 고정값 입력 + 암호화 토글. 잠그면 서버 키로 암호화된 enc:v1: 문자열이 저장돼
 * git에는 암호문만 남고, 실행 시 프록시가 호출 직전에 복호화한다.
 */
function FixedValueInput({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  const encrypted = isEncryptedValue(value);

  const toggle = async () => {
    setBusy(true);
    try {
      onChange(encrypted ? await api.decryptValue(value) : await api.encryptValue(String(value)));
    } catch (e) {
      toast.error(`${encrypted ? '복호화' : '암호화'} 실패: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {encrypted ? (
        <input type="text" value="암호화된 값" readOnly title="서버 키로 암호화되어 저장됩니다 — 자물쇠를 눌러 해제" />
      ) : (
        <input
          type="text"
          placeholder="고정값"
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <button
        className="icon-btn"
        type="button"
        disabled={busy || (!encrypted && (value == null || value === ''))}
        title={encrypted ? '암호화 해제 (평문으로 편집)' : '값 암호화 (git에는 암호문만 저장)'}
        onClick={toggle}
      >
        {encrypted ? '🔒' : '🔓'}
      </button>
    </>
  );
}

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
              <FixedValueInput value={src.value} onChange={(value) => onChange(v, { kind: 'FIXED', value })} />
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
