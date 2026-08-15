import React from 'react';

import CatalogPicker from '../CatalogPicker';

// STEP_RESULT_COMBO는 중간 입력 전용이라 기본 입력값 편집기에서는 제외한다.
function blankInput(kind, key, label) {
  switch (kind) {
    case 'MANUAL':
      return { kind, key, label, valueType: 'string' };
    case 'FIXED_COMBO':
      return { kind, key, label, options: [{ label: '', value: '' }] };
    case 'API_COMBO':
      return { kind, key, label, sourceApiId: '', labelField: '', valueField: '' };
    case 'DEPENDENT_LOOKUP':
      return { kind, key, label, dependsOnKey: '', lookupApiId: '', displayFields: [], valueField: '' };
    case 'DEPENDENT_COMBO':
      return { kind, key, label, dependsOnKey: '', lookupApiId: '', labelField: '', valueField: '' };
    default:
      return { kind: 'MANUAL', key, label, valueType: 'string' };
  }
}

/** 입력값 정의 편집 — key/label + kind별 세부 필드. */
export function InputDefEditor({ inputs, entries, inputKeys, envKeys, onChange }) {
  const update = (i, patch) => onChange(inputs.map((inp, idx) => (idx === i ? { ...inp, ...patch } : inp)));

  const changeKind = (i, kind) => onChange(inputs.map((inp, idx) => (idx === i ? blankInput(kind, inp.key, inp.label) : inp)));

  return (
    <div className="def-list">
      {inputs.map((inp, i) => (
        <div key={i} className="def-row">
          <div className="def-main">
            <input
              className="def-key"
              placeholder="key (예: customerId)"
              value={inp.key}
              onChange={(e) => update(i, { key: e.target.value })}
            />
            <input
              className="def-label"
              placeholder="라벨 (예: 고객 ID)"
              value={inp.label}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <select value={inp.kind} onChange={(e) => changeKind(i, e.target.value)}>
              <option value="MANUAL">직접 입력</option>
              <option value="FIXED_COMBO">고정값 콤보</option>
              <option value="API_COMBO">API 콤보</option>
              <option value="DEPENDENT_LOOKUP">의존 조회</option>
              <option value="DEPENDENT_COMBO">의존 콤보</option>
            </select>
            <button className="icon-btn" title="삭제" onClick={() => onChange(inputs.filter((_, idx) => idx !== i))}>
              ✕
            </button>
          </div>

          <KindFields
            input={inp}
            entries={entries}
            depKeyOptions={inputKeys.filter((k) => k && k !== inp.key)}
            envKeys={envKeys}
            onPatch={(patch) => update(i, patch)}
          />
        </div>
      ))}

      <button className="link" onClick={() => onChange([...inputs, blankInput('MANUAL', '', '')])}>
        + 입력값 추가
      </button>
    </div>
  );
}

function DependsOnKeySelect({ value, depKeyOptions, envKeys, onChange, groupLabel = '기본 입력값' }) {
  if (depKeyOptions.length + envKeys.length === 0) {
    return <input placeholder="dependsOnKey" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>
        선택…
      </option>
      {depKeyOptions.length ? (
        <optgroup label={groupLabel}>
          {depKeyOptions.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </optgroup>
      ) : null}
      {envKeys.length ? (
        <optgroup label="환경변수">
          {envKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </optgroup>
      ) : null}
    </select>
  );
}

function FieldSelect({ value, fields, placeholder, allowEmptyLabel, onChange }) {
  if (!fields.length) {
    return <input placeholder={placeholder} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {allowEmptyLabel != null ? (
        <option value="">{allowEmptyLabel}</option>
      ) : (
        <option value="" disabled>
          선택…
        </option>
      )}
      {fields.map((f) => (
        <option key={f} value={f}>
          {f}
        </option>
      ))}
    </select>
  );
}

function KindFields({ input, entries, depKeyOptions, envKeys, onPatch }) {
  switch (input.kind) {
    case 'MANUAL':
      return (
        <div className="def-sub">
          <label>
            타입
            <select value={input.valueType} onChange={(e) => onPatch({ valueType: e.target.value })}>
              <option value="string">문자열</option>
              <option value="number">숫자</option>
              <option value="password">비밀번호</option>
            </select>
          </label>
        </div>
      );

    case 'FIXED_COMBO':
      return (
        <div className="def-sub">
          {input.options.map((o, j) => (
            <div key={j} className="combo-opt">
              <input
                placeholder="라벨"
                value={o.label}
                onChange={(e) =>
                  onPatch({ options: input.options.map((x, k) => (k === j ? { ...x, label: e.target.value } : x)) })}
              />
              <input
                placeholder="값"
                value={o.value}
                onChange={(e) =>
                  onPatch({ options: input.options.map((x, k) => (k === j ? { ...x, value: e.target.value } : x)) })}
              />
              <button className="icon-btn" onClick={() => onPatch({ options: input.options.filter((_, k) => k !== j) })}>
                ✕
              </button>
            </div>
          ))}
          <button className="link small" onClick={() => onPatch({ options: [...input.options, { label: '', value: '' }] })}>
            + 옵션
          </button>
        </div>
      );

    case 'API_COMBO':
      return (
        <div className="def-sub def-col">
          <div className="def-field">
            <span className="def-field-label">소스 API</span>
            <CatalogPicker entries={entries} selectedId={input.sourceApiId || null} onSelect={(e) => onPatch({ sourceApiId: e.id })} />
          </div>
          <div className="grid2">
            <input placeholder="labelField (예: name)" value={input.labelField} onChange={(e) => onPatch({ labelField: e.target.value })} />
            <input placeholder="valueField (예: id)" value={input.valueField} onChange={(e) => onPatch({ valueField: e.target.value })} />
          </div>
        </div>
      );

    case 'DEPENDENT_LOOKUP': {
      const lookupEntry = entries.find((e) => e.id === input.lookupApiId) ?? null;
      const outs = lookupEntry?.outputFields ?? [];
      return (
        <div className="def-sub def-col">
          <div className="def-field">
            <span className="def-field-label">조회 API</span>
            <CatalogPicker entries={entries} selectedId={input.lookupApiId || null} onSelect={(e) => onPatch({ lookupApiId: e.id })} />
          </div>

          <div className="grid2">
            <div className="def-field">
              <span className="def-field-label">의존 입력 key</span>
              <DependsOnKeySelect
                value={input.dependsOnKey}
                depKeyOptions={depKeyOptions}
                envKeys={envKeys}
                onChange={(dependsOnKey) => onPatch({ dependsOnKey })}
              />
            </div>

            <div className="def-field">
              <span className="def-field-label">확정 값 필드 (valueField)</span>
              <FieldSelect
                value={input.valueField}
                fields={outs}
                placeholder="valueField (조회 API 선택 시 목록)"
                allowEmptyLabel="(의존값 그대로)"
                onChange={(valueField) => onPatch({ valueField })}
              />
            </div>
          </div>

          <div className="def-field">
            <span className="def-field-label">표시 필드 (displayFields · 다중 선택)</span>
            {outs.length ? (
              <div className="checkbox-row">
                {outs.map((f) => {
                  const on = input.displayFields.includes(f);
                  return (
                    <label key={f} className={`checkbox-chip ${on ? 'on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          onPatch({
                            displayFields: e.target.checked
                              ? [...input.displayFields, f]
                              : input.displayFields.filter((x) => x !== f)
                          })}
                      />
                      {f}
                    </label>
                  );
                })}
              </div>
            ) : (
              <input
                placeholder="displayFields (콤마, 조회 API 선택 시 다중 선택)"
                value={input.displayFields.join(',')}
                onChange={(e) => onPatch({ displayFields: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              />
            )}
          </div>
        </div>
      );
    }

    case 'DEPENDENT_COMBO': {
      const lookupEntry = entries.find((e) => e.id === input.lookupApiId) ?? null;
      const outs = lookupEntry?.outputFields ?? [];
      return (
        <div className="def-sub def-col">
          <div className="def-field">
            <span className="def-field-label">목록 API</span>
            <CatalogPicker entries={entries} selectedId={input.lookupApiId || null} onSelect={(e) => onPatch({ lookupApiId: e.id })} />
          </div>

          <div className="def-field">
            <span className="def-field-label">의존 입력 key</span>
            <DependsOnKeySelect
              value={input.dependsOnKey}
              depKeyOptions={depKeyOptions}
              envKeys={envKeys}
              groupLabel="기본 입력값 · 이전 조회 결과"
              onChange={(dependsOnKey) => onPatch({ dependsOnKey })}
            />
          </div>

          <div className="grid2">
            <div className="def-field">
              <span className="def-field-label">표현값 (labelField)</span>
              <FieldSelect
                value={input.labelField}
                fields={outs}
                placeholder="labelField (목록 API 선택 시 목록)"
                onChange={(labelField) => onPatch({ labelField })}
              />
            </div>

            <div className="def-field">
              <span className="def-field-label">실제값 (valueField)</span>
              <FieldSelect
                value={input.valueField}
                fields={outs}
                placeholder="valueField (목록 API 선택 시 목록)"
                onChange={(valueField) => onPatch({ valueField })}
              />
            </div>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

export default InputDefEditor;
