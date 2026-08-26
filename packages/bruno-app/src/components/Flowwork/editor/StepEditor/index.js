import React, { useMemo, useState } from 'react';

import { refKey } from '../../engine/catalogLookup';
import { requestFieldSlots } from '../../engine/template';
import { stepBadgeClass, stepTypeMeta } from '../../StepCard';
import BranchConditionEditor from '../BranchConditionEditor';
import CatalogPicker from '../CatalogPicker';
import MidInputEditor from '../MidInputEditor';
import RepeatEditor from '../RepeatEditor';
import VariableBindingEditor from '../VariableBindingEditor';
import WorkflowLinkEditor from '../WorkflowLinkEditor';

const EMPTY_API_BINDING = {
  catalogEntry: { department: '', collectionFile: '', itemPath: [], name: '' },
  variableBindings: {}
};

/**
 * 지금 고른 처리 방식. 편집 중에는 방식을 바꿔도 다른 방식의 설정을 지우지 않으므로
 * (되돌아오면 그대로 있어야 한다) 고른 방식을 editorMode에 따로 적어 둔다.
 * 저장할 때 normalizeStepForSave가 고른 방식만 남기고 editorMode는 떼어낸다.
 */
export const stepMode = (step) => {
  if (step.editorMode) return step.editorMode;
  if (step.delayBinding) return 'DELAY';
  return step.workflowBinding ? 'WORKFLOW' : 'API';
};

/** 저장할 모양 — 고르지 않은 처리 방식의 설정은 파일에 남기지 않는다. */
export function normalizeStepForSave(step) {
  const mode = stepMode(step);
  const { editorMode: _editorMode, apiBinding, workflowBinding, delayBinding, ...rest } = step;
  if (mode === 'DELAY') {
    // 부를 API가 없는 스텝이라 결과 표시·반복은 뜻이 없다
    return { ...rest, delayBinding, resultView: undefined, repeat: undefined };
  }
  return mode === 'WORKFLOW' ? { ...rest, workflowBinding } : { ...rest, apiBinding };
}

export function StepEditor({
  step,
  index,
  total,
  entries,
  workflows,
  selfId,
  envKeys,
  inputKeys,
  prevSteps,
  repeating,
  onChange,
  onRemove,
  onMove
}) {
  const mode = stepMode(step);
  const apiBinding = step.apiBinding ?? EMPTY_API_BINDING;
  // 반복 항목을 값으로 쓸 수 있는 자리 — 반복 블록 안에 있거나, 스텝 자체가 반복한다
  const inLoop = repeating || !!step.repeat;

  // 스텝 종류 배지/분류 (실행 화면과 동일) — 지금 고른 방식만 보고 정한다
  const { typeLabel, category } = stepTypeMeta(normalizeStepForSave(step), (id) => {
    const w = workflows.find((x) => x.id === id);
    return w ? { domain: w.domain, task: w.task, name: w.name } : undefined;
  });

  const selectedEntry = useMemo(
    () => entries.find((e) => refKey(e) === refKey(apiBinding.catalogEntry)) ?? null,
    [entries, apiBinding.catalogEntry]
  );

  // API의 모든 변수에 더해 헤더/쿼리 파라미터/바디 필드도 매핑 대상으로 나열한다
  // (환경변수 포함 — 사용자가 소스를 선택). 바인딩하지 않은 필드는 템플릿 값 그대로.
  const bindableVars = useMemo(
    () => (selectedEntry ? [...selectedEntry.variables, ...requestFieldSlots(selectedEntry.requestTemplate)] : []),
    [selectedEntry]
  );

  // 결과 표시(원본/표 + 컬럼)
  const rv = step.resultView ?? { mode: 'RAW', columns: [] };
  const setRv = (patch) => onChange({ ...step, resultView: { ...rv, ...patch } });
  const outFields = selectedEntry?.outputFields ?? [];
  const customCols = rv.columns.filter((c) => !outFields.includes(c));
  const [colText, setColText] = useState('');
  const addCol = () => {
    const c = colText.trim();
    if (c && !rv.columns.includes(c)) setRv({ columns: [...rv.columns, c] });
    setColText('');
  };

  // 방식을 바꿔도 다른 방식의 설정은 그대로 둔다 — 되돌아오면 고르던 값이 남아 있고,
  // 저장할 때 고른 방식만 파일에 남는다. 이름은 손대지 않는다(직접 붙인 이름이 지워지지
  // 않게) — API·업무를 새로 고르면 그때 그 이름으로 맞춰진다.
  const setMode = (next) => {
    if (next === mode) return;
    if (next === 'WORKFLOW') {
      onChange({
        ...step,
        editorMode: next,
        workflowBinding: step.workflowBinding ?? { ref: { id: '' }, inputMappings: {} }
      });
    } else if (next === 'DELAY') {
      onChange({
        ...step,
        editorMode: next,
        delayBinding: step.delayBinding ?? { seconds: 3 },
        name: step.name || '대기'
      });
    } else {
      onChange({ ...step, editorMode: next, apiBinding: step.apiBinding ?? EMPTY_API_BINDING });
    }
  };

  const onSelectEntry = (entry) => {
    // 기존 바인딩 유지 + 변수명이 환경변수 key와 같으면 ENV로 기본값 채움.
    // 요청 필드 슬롯은 API에 적힌 값을 고정값으로 미리 채워, 값을 보면서 바꾸게 한다.
    const kept = {};
    for (const v of entry.variables) {
      if (apiBinding.variableBindings[v]) kept[v] = apiBinding.variableBindings[v];
      else if (envKeys.has(v)) kept[v] = { kind: 'ENV', envKey: v };
    }
    for (const slot of requestFieldSlots(entry.requestTemplate)) {
      if (apiBinding.variableBindings[slot.key]) kept[slot.key] = apiBinding.variableBindings[slot.key];
      else if (slot.value !== undefined) kept[slot.key] = { kind: 'FIXED', value: slot.value };
    }
    onChange({
      ...step,
      name: entry.name, // 스텝 이름 = 선택한 API 이름 (자동)
      apiBinding: {
        ...apiBinding,
        catalogEntry: {
          department: entry.department,
          collectionFile: entry.collectionFile,
          itemPath: entry.itemPath,
          name: entry.name
        },
        variableBindings: kept
      }
    });
  };

  const onLinkChange = (workflowBinding) => {
    // 스텝 이름 = 연결한 업무 이름 (자동)
    const linked = workflows.find((w) => w.id === workflowBinding?.ref.id);
    onChange({ ...step, workflowBinding, name: linked?.name ?? '' });
  };

  const setBinding = (variable, source) =>
    onChange({
      ...step,
      apiBinding: { ...apiBinding, variableBindings: { ...apiBinding.variableBindings, [variable]: source } }
    });

  return (
    <div className="step-editor">
      <div className="step-editor-head">
        <span className="step-order">{index + 1}</span>
        <span className="step-title">
          <span className="step-name-text">
            <span className="step-name-row">
              <span className={`step-type-badge ${stepBadgeClass(typeLabel)}`}>{typeLabel}</span>
              <span>{step.name || <span className="muted">새 스텝</span>}</span>
              {step.repeat ? <span className="step-flag">반복</span> : null}
              {step.parallel ? <span className="step-flag">비동기</span> : null}
            </span>
            {category ? <span className="step-category">{category}</span> : null}
          </span>
        </span>
        <div className="step-actions">
          <button className="icon-btn" disabled={index === 0} onClick={() => onMove(-1)} title="위로">
            ↑
          </button>
          <button className="icon-btn" disabled={index === total - 1} onClick={() => onMove(1)} title="아래로">
            ↓
          </button>
          <button className="icon-btn danger" onClick={onRemove} title="스텝 삭제">
            ✕
          </button>
        </div>
      </div>

      <div className="step-section">
        <div className="processing-head">
          <h4>처리 방식</h4>
          {/* 비동기 요청 = 앞 스텝과 함께 출발하고 응답을 기다리지 않는다 */}
          <label className="async-toggle" title="앞 스텝과 함께 출발하고, 다음 스텝은 이 응답을 기다리지 않습니다">
            <input
              type="checkbox"
              checked={!!step.parallel}
              disabled={index === 0}
              onChange={(e) => onChange({ ...step, parallel: e.target.checked })}
            />
            비동기 요청
          </label>
          <div className="mode-toggle">
            <button className={mode === 'API' ? 'active' : ''} onClick={() => setMode('API')}>
              API 호출
            </button>
            <button className={mode === 'WORKFLOW' ? 'active' : ''} onClick={() => setMode('WORKFLOW')}>
              다른 업무 연결
            </button>
            <button className={mode === 'DELAY' ? 'active' : ''} onClick={() => setMode('DELAY')}>
              지연(대기)
            </button>
          </div>
        </div>

        {mode === 'API' ? (
          <>
            <CatalogPicker entries={entries} selectedId={selectedEntry?.id ?? null} onSelect={onSelectEntry} />
            {selectedEntry ? (
              <div className="binding-block">
                <h5>변수 바인딩</h5>
                <VariableBindingEditor
                  variables={bindableVars}
                  bindings={apiBinding.variableBindings}
                  inputKeys={inputKeys}
                  envKeys={[...envKeys]}
                  prevStepIds={prevSteps}
                  repeating={inLoop}
                  onChange={setBinding}
                />
              </div>
            ) : null}
          </>
        ) : mode === 'DELAY' ? (
          <div className="repeat-row">
            <label className="field-label">대기 시간</label>
            <input
              type="number"
              min="0"
              step="1"
              value={step.delayBinding?.seconds ?? 0}
              onChange={(e) => onChange({ ...step, delayBinding: { seconds: Number(e.target.value) } })}
            />
            <span className="hint">초 — 다음 스텝은 이만큼 쉬었다가 시작합니다</span>
          </div>
        ) : (
          <WorkflowLinkEditor
            binding={step.workflowBinding}
            workflows={workflows}
            selfId={selfId}
            inputKeys={inputKeys}
            envKeys={[...envKeys]}
            prevStepIds={prevSteps}
            onChange={onLinkChange}
          />
        )}
      </div>

      {mode === 'API' ? (
        <div className="step-section">
          <h4>결과 표시</h4>
          <div className="mode-toggle">
            <button className={rv.mode === 'RAW' ? 'active' : ''} onClick={() => setRv({ mode: 'RAW' })}>
              원본(JSON)
            </button>
            <button className={rv.mode === 'TABLE' ? 'active' : ''} onClick={() => setRv({ mode: 'TABLE' })}>
              표
            </button>
          </div>

          {rv.mode === 'TABLE' ? (
            <div className="result-cols">
              {outFields.length ? (
                <div className="checkbox-row">
                  {outFields.map((f) => {
                    const on = rv.columns.includes(f);
                    // 필드 설명(한글 라벨)이 있으면 설명을, 없으면 필드명을 표시
                    const label = selectedEntry?.outputLabels?.[f];
                    return (
                      <label key={f} className={`checkbox-chip ${on ? 'on' : ''}`} title={f}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) =>
                            setRv({
                              columns: e.target.checked ? [...rv.columns, f] : rv.columns.filter((x) => x !== f)
                            })}
                        />
                        {label ?? f}
                      </label>
                    );
                  })}
                </div>
              ) : null}

              {customCols.length ? (
                <div className="checkbox-row">
                  {customCols.map((c) => (
                    <span key={c} className="col-chip">
                      {c}
                      <button className="chip-x" onClick={() => setRv({ columns: rv.columns.filter((x) => x !== c) })}>
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="col-add">
                <input
                  placeholder="중첩 필드 추가 (예: owner.name)"
                  value={colText}
                  onChange={(e) => setColText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCol();
                    }
                  }}
                />
                <button className="link small" onClick={addCol}>
                  + 추가
                </button>
              </div>
              <p className="hint">
                비우면 전체 필드 자동 · 응답이 배열이면 각 행, 객체면 필드/값 표. 점 표기로 중첩 값을 지정합니다.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="step-section">
        <h4>중간 입력 (다음 스텝 전에 추가 입력)</h4>
        <p className="hint">
          이 스텝이 성공하면 폼이 떠서 값을 받고, 그 값으로 다음 스텝이 진행됩니다. "결과에서 선택"은 이 스텝의
          응답(배열)에서 콤보로 고릅니다.
        </p>
        <MidInputEditor
          midInputs={step.midInputs ?? []}
          outFields={outFields}
          onChange={(midInputs) => onChange({ ...step, midInputs })}
        />
      </div>

      <div className="step-section">
        <h4>분기 조건</h4>
        <BranchConditionEditor
          condition={step.branchCondition}
          prevStepIds={prevSteps}
          inputKeys={inputKeys}
          envKeys={[...envKeys]}
          repeating={inLoop}
          onChange={(branchCondition) => onChange({ ...step, branchCondition })}
        />
      </div>

      {mode === 'DELAY' ? null : (
        <div className="step-section">
          <h4>반복</h4>
          <RepeatEditor
            repeat={step.repeat}
            prevStepIds={prevSteps}
            onChange={(repeat) => onChange({ ...step, repeat })}
          />
        </div>
      )}

      <label className="stop-toggle">
        <input
          type="checkbox"
          checked={!!step.stopOnFailure}
          onChange={(e) => onChange({ ...step, stopOnFailure: e.target.checked })}
        />
        실패 시 이후 스텝 중단 (stopOnFailure)
      </label>
    </div>
  );
}

export default StepEditor;
