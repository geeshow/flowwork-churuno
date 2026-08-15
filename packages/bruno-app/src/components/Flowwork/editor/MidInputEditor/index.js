import React from 'react';

// 중간 입력에서 지원하는 종류: 직접 입력 / 결과에서 선택(콤보)
const blank = (kind, key, label) => {
  if (kind === 'MANUAL') return { kind, key, label, valueType: 'string' };
  return { kind: 'STEP_RESULT_COMBO', key, label, arrayPath: '', labelField: '', valueField: '' };
};

/**
 * 중간 입력 편집 — 스텝이 성공한 뒤 다음 스텝 전에 받을 추가 입력을 정의한다.
 *  - 직접 입력(MANUAL): 자유 입력 (문자열/숫자/비밀번호)
 *  - 결과에서 선택(STEP_RESULT_COMBO): 이 스텝 응답(배열)에서 콤보로 선택
 */
export function MidInputEditor({ midInputs, outFields, onChange }) {
  const update = (i, patch) => onChange(midInputs.map((inp, idx) => (idx === i ? { ...inp, ...patch } : inp)));

  const changeKind = (i, kind) => onChange(midInputs.map((inp, idx) => (idx === i ? blank(kind, inp.key, inp.label) : inp)));

  return (
    <div className="def-list">
      {midInputs.map((inp, i) => (
        <div key={i} className="def-row">
          <div className="def-main">
            <input
              className="def-key"
              placeholder="key (예: accountNo)"
              value={inp.key}
              onChange={(e) => update(i, { key: e.target.value })}
            />
            <input
              className="def-label"
              placeholder="라벨 (예: 출금 계좌)"
              value={inp.label}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <select value={inp.kind} onChange={(e) => changeKind(i, e.target.value)}>
              <option value="MANUAL">직접 입력</option>
              <option value="STEP_RESULT_COMBO">결과에서 선택</option>
            </select>
            <button className="icon-btn" title="삭제" onClick={() => onChange(midInputs.filter((_, idx) => idx !== i))}>
              ✕
            </button>
          </div>

          {inp.kind === 'MANUAL' ? (
            <div className="def-sub">
              <label>
                타입
                <select value={inp.valueType} onChange={(e) => update(i, { valueType: e.target.value })}>
                  <option value="string">문자열</option>
                  <option value="number">숫자</option>
                  <option value="password">비밀번호</option>
                </select>
              </label>
            </div>
          ) : inp.kind === 'STEP_RESULT_COMBO' ? (
            <div className="def-sub def-col">
              <div className="def-field">
                <span className="def-field-label">배열 경로 (arrayPath · 비우면 응답 전체)</span>
                <input
                  placeholder="예: (비움) 또는 items"
                  value={inp.arrayPath ?? ''}
                  onChange={(e) => update(i, { arrayPath: e.target.value })}
                />
              </div>
              <div className="grid2">
                <div className="def-field">
                  <span className="def-field-label">표현값 (labelField)</span>
                  {outFields.length ? (
                    <select value={inp.labelField} onChange={(e) => update(i, { labelField: e.target.value })}>
                      <option value="" disabled>
                        선택…
                      </option>
                      {outFields.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input placeholder="labelField" value={inp.labelField} onChange={(e) => update(i, { labelField: e.target.value })} />
                  )}
                </div>
                <div className="def-field">
                  <span className="def-field-label">실제값 (valueField)</span>
                  {outFields.length ? (
                    <select value={inp.valueField} onChange={(e) => update(i, { valueField: e.target.value })}>
                      <option value="" disabled>
                        선택…
                      </option>
                      {outFields.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input placeholder="valueField" value={inp.valueField} onChange={(e) => update(i, { valueField: e.target.value })} />
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ))}

      <button className="link" onClick={() => onChange([...midInputs, blank('MANUAL', '', '')])}>
        + 중간 입력 추가
      </button>
    </div>
  );
}

export default MidInputEditor;
