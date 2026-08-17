import React, { useEffect, useMemo, useState } from 'react';

import api, { VersionConflictError } from '../../api';
import ConfirmButton from '../../ConfirmButton';
import { colorForDomain, isValidHex, PRESET_COLORS } from '../../domainPalette';
import { conditionSource } from '../../engine/branch';
import { isBlockStep } from '../../engine/runWorkflow';
import Flowmap from '../../WorkflowScreen/Flowmap';
import AddStepButton from '../AddStepButton';
import BlockEditor from '../BlockEditor';
import InputDefEditor from '../InputDefEditor';
import StepEditor, { normalizeStepForSave } from '../StepEditor';

// 도메인/업무는 파일 경로 세그먼트 — 단어문자 + 한글 + 하이픈 + 공백(앞뒤 제외)만 허용.
// 업무는 하위 업무를 가질 수 있어 '/'로 나뉜 마디마다 이 규칙을 적용한다.
const SAFE_SEGMENT = /^[\w가-힣-](?:[\w가-힣 -]*[\w가-힣-])?$/;
const SEGMENT_RULE = '영문/숫자/한글/-/_ 와 사이 공백';

const emptyWorkflow = (domain = '', task = '') => ({
  id: crypto.randomUUID(),
  domain,
  task,
  name: '',
  description: '',
  baseInputs: [],
  steps: []
});

const newStep = (kind, parentId) => {
  const base = {
    id: `step_${Math.random().toString(36).slice(2, 8)}`,
    order: 0,
    name: '', // API/업무를 선택하면 그 이름으로 자동 설정
    ...(parentId ? { parentId } : {})
  };
  switch (kind) {
    case 'REPEAT':
      return { ...base, kind: 'REPEAT', name: '반복', repeat: { kind: 'COUNT', count: 3 } };
    case 'BRANCH':
      return {
        ...base,
        kind: 'BRANCH',
        name: '분기',
        branchCondition: { source: { kind: 'USER_INPUT', inputKey: '' }, operator: 'EQ', compareValue: '' }
      };
    case 'DELAY':
      return { ...base, name: '대기', delayBinding: { seconds: 3 } };
    case 'WORKFLOW':
      return { ...base, workflowBinding: { ref: { id: '' }, inputMappings: {} } };
    default:
      return {
        ...base,
        apiBinding: {
          catalogEntry: { department: '', collectionFile: '', itemPath: [], name: '' },
          variableBindings: {}
        }
      };
  }
};

// 블록은 자기 자신과 그 안에 든 스텝들을 한 덩어리로 다룬다 (옮기기·삭제)
const subtreeOf = (steps, step) => {
  const ids = new Set([step.id]);
  return steps.filter((s) => {
    if (s.id === step.id) return true;
    if (s.parentId && ids.has(s.parentId)) {
      ids.add(s.id);
      return true;
    }
    return false;
  });
};

const depthOf = (step, steps) => {
  let depth = 0;
  let parentId = step.parentId;
  while (parentId) {
    depth += 1;
    parentId = steps.find((s) => s.id === parentId)?.parentId;
  }
  return depth;
};

// 반복 블록 안에 있으면 그 회차의 항목(LOOP_ITEM)을 값으로 쓸 수 있다
const insideRepeat = (step, steps) => {
  if (step.repeat && !isBlockStep(step)) return true;
  let parentId = step.parentId;
  while (parentId) {
    const parent = steps.find((s) => s.id === parentId);
    if (!parent) return false;
    if (parent.kind === 'REPEAT') return true;
    parentId = parent.parentId;
  }
  return false;
};

// 블록이 실행될 수 있는 모양인지 — 무엇을 기준으로 돌지·언제 돌지와, 안에 든 스텝
function validateBlock(block, steps) {
  if (!steps.some((s) => s.parentId === block.id)) return '안에 스텝을 하나 이상 넣으세요.';
  if (block.kind === 'REPEAT') {
    if (block.repeat?.kind === 'LIST' && !block.repeat.sourceStepId) return '반복할 목록을 만드는 스텝을 선택하세요.';
    return null;
  }
  const source = conditionSource(block.branchCondition ?? {});
  if (source.kind === 'USER_INPUT' && !source.inputKey) return '조건으로 볼 입력값을 선택하세요.';
  if (source.kind === 'ENV' && !source.envKey) return '조건으로 볼 환경변수를 선택하세요.';
  if (source.kind === 'PREV_RESPONSE' && !source.stepId) return '조건으로 볼 스텝을 선택하세요.';
  return null;
}

// 값을 가져다 쓸 수 있는 앞 스텝들 — 블록은 자기 응답이 없으므로 뺀다
const prevStepsFor = (steps, index) =>
  steps
    .slice(0, index)
    .filter((s) => !isBlockStep(s))
    .map((s, si) => ({ id: s.id, label: `${si + 1}. ${s.name || '스텝'}` }));

/**
 * 워크플로우 등록/수정 — 항상 편집 worktree(source=edit) 기준으로 읽고 쓴다.
 * 저장은 현재 편집 브랜치의 worktree 파일 쓰기(커밋 전 임시 저장)이고,
 * main 반영은 커밋 → develop 머지 → 운영 릴리스 단계를 거친다.
 * 낙관적 잠금 충돌 시 덮어쓰기/다시 불러오기를 선택한다.
 */
export function WorkflowEditor({ mode, id, initialDomain, initialTask, onSaved, onCancel }) {
  // 위치(도메인·업무)와 도메인 색은 이 화면에서 고치지 않는다. 수정은 작업의 내용만
  // 다루고, 옮기기·이름 바꾸기는 사이드바 메뉴가, 색은 도메인 메뉴가 맡는다.
  // 새로 만들 때만, 그것도 폴더 밖에서 시작했을 때만 위치를 직접 정한다.
  const locationLocked = mode === 'edit' || (!!initialDomain && !!initialTask);
  const editingLocation = mode === 'new' && !locationLocked;
  const [wf, setWf] = useState(mode === 'new' ? emptyWorkflow(initialDomain, initialTask) : null);
  const [entries, setEntries] = useState([]);
  const [env, setEnv] = useState({});
  const [workflows, setWorkflows] = useState([]);
  const [domainColors, setDomainColors] = useState({});
  // 사용자가 직접 고른 색(도메인 색 오버라이드). 빈 문자열이면 도메인 기본색을 따른다.
  const [pickedColor, setPickedColor] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [envOpen, setEnvOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  // 동시 저장 충돌 — 다른 사용자가 조회 이후 같은 워크플로우를 저장/삭제한 경우.
  const [conflict, setConflict] = useState(null); // { deleted: boolean }

  useEffect(() => {
    let alive = true;
    Promise.all([api.searchCatalog(''), api.getEnvironments(), api.listWorkflows('edit'), api.getDomainColors('edit')])
      .then(([cat, envs, wfs, colors]) => {
        if (!alive) return;
        setEntries(cat.results);
        setEnv(envs);
        setWorkflows(wfs);
        setDomainColors(colors);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    let alive = true;
    api
      .getWorkflow(id, 'edit')
      .then((w) => alive && setWf(w))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [mode, id]);

  const envKeys = useMemo(() => new Set(Object.keys(env)), [env]);
  const inputKeys = useMemo(() => (wf ? wf.baseInputs.map((i) => i.key).filter(Boolean) : []), [wf]);

  const domainOptions = useMemo(
    () => [...new Set(workflows.map((w) => w.domain))].sort((a, b) => a.localeCompare(b, 'ko')),
    [workflows]
  );
  const taskOptions = useMemo(
    () =>
      [...new Set(workflows.filter((w) => !wf || w.domain === wf.domain).map((w) => w.task))].sort((a, b) =>
        a.localeCompare(b, 'ko')),
    [workflows, wf]
  );

  if (error && !wf) return <div className="error-banner">{error}</div>;
  if (!wf) return <p className="muted">불러오는 중…</p>;

  const identityReady = !!wf.domain.trim() && !!wf.task.trim() && !!wf.name.trim();
  // 미리보기는 저장할 모양(고르지 않은 처리 방식은 뺀 것)으로 그린다
  const previewWorkflow = { ...wf, steps: wf.steps.map((s, idx) => ({ ...normalizeStepForSave(s), order: idx + 1 })) };

  // 이 워크플로우 도메인의 색상 (사용자가 고른 색 > 저장된 도메인 색 > 결정적 기본색)
  const domainColor = pickedColor || colorForDomain(wf.domain.normalize('NFC'), domainColors);

  const patch = (p) => setWf({ ...wf, ...p });

  const updateStep = (i, step) => setWf({ ...wf, steps: wf.steps.map((s, idx) => (idx === i ? step : s)) });

  // 같은 자리(같은 블록 안)의 형제끼리만 자리를 바꾼다. 블록은 안에 든 스텝까지 함께 움직인다.
  const moveStep = (i, dir) => {
    const step = wf.steps[i];
    const siblings = wf.steps.filter((s) => (s.parentId ?? null) === (step.parentId ?? null));
    const target = siblings[siblings.indexOf(step) + dir];
    if (!target) return;

    const moving = subtreeOf(wf.steps, step);
    const targetBlock = subtreeOf(wf.steps, target);
    const rest = wf.steps.filter((s) => !moving.includes(s));
    const at = dir < 0 ? rest.indexOf(targetBlock[0]) : rest.indexOf(targetBlock[targetBlock.length - 1]) + 1;
    rest.splice(at, 0, ...moving);
    setWf({ ...wf, steps: rest });
  };

  // 블록 안에 넣을 때는 그 블록의 마지막 자리 뒤에 붙인다
  const addStep = (kind, parentId) => {
    const steps = [...wf.steps];
    const parent = parentId ? steps.find((s) => s.id === parentId) : null;
    const at = parent ? steps.indexOf(subtreeOf(steps, parent).slice(-1)[0]) + 1 : steps.length;
    steps.splice(at, 0, newStep(kind, parentId));
    setWf({ ...wf, steps });
  };

  const removeStep = (step) => {
    const doomed = new Set(subtreeOf(wf.steps, step).map((s) => s.id));
    setWf({ ...wf, steps: wf.steps.filter((s) => !doomed.has(s.id)) });
  };

  function validate(w) {
    if (!SAFE_SEGMENT.test(w.domain)) return `도메인은 ${SEGMENT_RULE}만 사용할 수 있습니다.`;
    if (!w.task.split('/').every((segment) => SAFE_SEGMENT.test(segment))) {
      return `업무는 ${SEGMENT_RULE}만 사용할 수 있습니다 (하위 업무는 '/'로 구분).`;
    }
    if (!w.name.trim()) return '이름을 입력하세요.';
    // (도메인, 업무) 내 이름 중복 사전 검사 (서버도 409로 최종 검증)
    const dup = workflows.some(
      (x) => x.id !== w.id && x.domain === w.domain && x.task === w.task && x.name === w.name.trim()
    );
    if (dup) return `'${w.domain}/${w.task}'에 이미 '${w.name}' 이름이 있습니다.`;
    for (const [idx, s] of w.steps.entries()) {
      if (isBlockStep(s)) {
        const problem = validateBlock(s, w.steps);
        if (problem) return `${idx + 1}번 ${s.kind === 'REPEAT' ? '반복' : '분기'} 블록: ${problem}`;
        continue;
      }
      if (s.delayBinding) {
        if (!(Number(s.delayBinding.seconds) >= 0)) return `${idx + 1}번 스텝: 대기 시간을 초 단위로 입력하세요.`;
      } else if (s.workflowBinding) {
        if (!s.workflowBinding.ref.id) return `${idx + 1}번 스텝: 연결할 업무를 선택하세요.`;
      } else if (s.apiBinding) {
        if (!s.apiBinding.catalogEntry.name) return `${idx + 1}번 스텝: 처리 API를 선택하세요.`;
      } else {
        return `${idx + 1}번 스텝: 처리 방식(API·업무 연결·지연)을 설정하세요.`;
      }
      if (s.repeat?.kind === 'LIST' && !s.repeat.sourceStepId) {
        return `${idx + 1}번 스텝: 반복할 목록을 만드는 스텝을 선택하세요.`;
      }
    }
    return null;
  }

  async function handleSave(force = false) {
    const normalized = {
      ...wf,
      name: wf.name.trim(),
      // 고르지 않은 처리 방식의 설정은 여기서 떨어져 나간다 (편집 중에는 남겨 둔다)
      steps: wf.steps.map((s, idx) => ({ ...normalizeStepForSave(s), order: idx + 1 }))
    };
    const problem = validate(normalized);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    setConflict(null);
    try {
      // 새 도메인을 여기서 만들었다면 그 도메인의 색도 함께 확정해 둔다
      if (editingLocation && isValidHex(domainColor)) {
        await api.setDomainColor(normalized.domain.normalize('NFC'), domainColor);
      }
      await api.saveWorkflow(normalized, { force });
      onSaved(normalized);
    } catch (e) {
      if (e instanceof VersionConflictError) {
        const server = await api.getWorkflow(normalized.id, 'edit').catch(() => null);
        setConflict({ deleted: server == null });
      } else {
        setError(e.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function reloadFromServer() {
    const server = await api.getWorkflow(wf.id, 'edit').catch(() => null);
    if (server) setWf(server);
    setConflict(null);
  }

  return (
    <div className="editor">
      <div className="editor-head">
        <h2>{mode === 'new' ? '새 워크플로우' : '워크플로우 편집'}</h2>
        <div className="editor-actions">
          <button className="link" onClick={onCancel}>
            취소
          </button>
          <button className="small" onClick={() => setPreview(true)} title="지금까지 짠 내용으로 흐름도를 봅니다">
            미리보기
          </button>
          <button className="primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

      {preview ? (
        <div className="name-prompt-backdrop" onMouseDown={() => setPreview(false)}>
          <div className="preview-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="preview-head">
              <h4>흐름도 미리보기 <span className="hint">(저장 전 내용)</span></h4>
              <button className="link small" onClick={() => setPreview(false)}>
                닫기
              </button>
            </div>
            <Flowmap workflow={previewWorkflow} workflows={workflows} />
          </div>
        </div>
      ) : null}

      {error ? <div className="error-banner">{error}</div> : null}

      {conflict ? (
        <section className="panel save-conflict">
          <h3>⚠ 저장 충돌</h3>
          {conflict.deleted ? (
            <p className="muted">다른 사용자가 이 워크플로우를 삭제했습니다. 내 내용으로 다시 저장(복원)하거나 편집을 취소하세요.</p>
          ) : (
            <p className="muted">다른 사용자가 이 워크플로우를 먼저 저장했습니다. 서버 최신 내용을 불러오거나 내 수정으로 덮어쓰세요.</p>
          )}
          <div className="save-conflict-actions">
            {!conflict.deleted ? (
              <ConfirmButton
                className="link"
                confirmLabel="내 수정을 버리고 불러오기 — 확정"
                onConfirm={() => void reloadFromServer()}
              >
                서버 최신 내용 불러오기
              </ConfirmButton>
            ) : null}
            <ConfirmButton
              className="primary"
              disabled={saving}
              confirmLabel={conflict.deleted ? '다시 저장 — 확정' : '다른 사용자 수정 덮어쓰기 — 확정'}
              onConfirm={() => void handleSave(true)}
            >
              {conflict.deleted ? '내 내용으로 다시 저장' : '내 수정으로 덮어쓰기 저장'}
            </ConfirmButton>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h3>기본 정보</h3>
        <div className="meta-grid">
          {locationLocked ? (
            /* 위치는 여기서 바꾸지 않는다 — 옮기기·이름 바꾸기는 사이드바 작업 메뉴에서 */
            <div className="field wide">
              <span className="field-label">위치</span>
              <div className="field-fixed">{[wf.domain, ...wf.task.split('/')].join(' / ')}</div>
            </div>
          ) : (
            <>
              <label className="field">
                <span className="field-label">도메인</span>
                <input
                  list="flowwork-domain-options"
                  value={wf.domain}
                  placeholder="예: 계좌 (선택 또는 입력)"
                  onChange={(e) => {
                    setPickedColor(''); // 도메인이 바뀌면 그 도메인의 색을 따르도록 오버라이드 해제
                    patch({ domain: e.target.value });
                  }}
                />
                <datalist id="flowwork-domain-options">
                  {domainOptions.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </label>
              <label className="field">
                <span className="field-label">업무</span>
                <input
                  list="flowwork-task-options"
                  value={wf.task}
                  placeholder="예: 계좌개설 · 하위 업무는 개설/신규 (선택 또는 입력)"
                  onChange={(e) => patch({ task: e.target.value })}
                />
                <datalist id="flowwork-task-options">
                  {taskOptions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </label>
            </>
          )}
          {/* 색은 도메인의 것이라 새 도메인을 만들 때만 여기서 정하고, 이후 변경은 도메인 메뉴에서 */}
          {editingLocation ? (
            <div className="field wide">
              <span className="field-label">
                도메인 색상 <span className="hint">(작업 테두리·불릿에 사용 · 도메인 단위로 저장)</span>
              </span>
              <div className="color-picker">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`color-swatch ${domainColor.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                    style={{ background: c }}
                    title={c}
                    onClick={() => setPickedColor(c)}
                  />
                ))}
                <label className="color-custom" title="직접 선택">
                  <input
                    type="color"
                    value={isValidHex(domainColor) ? domainColor : '#4c8dff'}
                    onChange={(e) => setPickedColor(e.target.value)}
                  />
                  <span className="color-custom-face" style={{ background: domainColor }} />
                </label>
              </div>
            </div>
          ) : null}
          <label className="field wide">
            <span className="field-label">
              이름 <span className="hint">(도메인·업무 내에서 유일)</span>
            </span>
            <input value={wf.name} placeholder="정산 취소 처리" onChange={(e) => patch({ name: e.target.value })} />
          </label>
          <label className="field wide">
            <span className="field-label">설명</span>
            <input
              value={wf.description ?? ''}
              placeholder="고객 정산을 조회하고, 상태가 ACTIVE면 취소한다."
              onChange={(e) => patch({ description: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>
            환경 변수 <span className="hint">({Object.keys(env).length}개 · 읽기 전용)</span>
          </h3>
          <button className="link" onClick={() => setEnvOpen((v) => !v)}>
            {envOpen ? '접기' : '보기'}
          </button>
        </div>
        {envOpen ? (
          Object.keys(env).length === 0 ? (
            <p className="muted">환경 변수가 없습니다.</p>
          ) : (
            <div className="env-list">
              {Object.entries(env).map(([k, v]) => (
                <div key={k} className="env-row">
                  <code className="env-key">{k}</code>
                  <code className="env-val">{v}</code>
                </div>
              ))}
            </div>
          )
        ) : null}
      </section>

      <section className="panel">
        <h3>
          기본 입력값 <span className="hint">(스텝보다 먼저 정의)</span>
        </h3>
        <InputDefEditor
          inputs={wf.baseInputs}
          entries={entries}
          inputKeys={inputKeys}
          envKeys={[...envKeys]}
          onChange={(baseInputs) => patch({ baseInputs })}
        />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>스텝 ({wf.steps.length})</h3>
        </div>

        {!identityReady ? (
          <p className="muted">먼저 도메인·업무·이름을 입력하면 스텝을 추가할 수 있습니다.</p>
        ) : wf.steps.length === 0 ? (
          <p className="muted">스텝이 없습니다. 아래 "스텝 추가"로 API를 선택하고 입력을 매핑하세요.</p>
        ) : null}

        <div className="step-editor-list">
          {wf.steps.map((step, i) => (
            <div key={step.id} className="step-editor-row" style={{ marginLeft: depthOf(step, wf.steps) * 24 }}>
              {isBlockStep(step) ? (
                <BlockEditor
                  block={step}
                  index={i}
                  total={wf.steps.length}
                  prevSteps={prevStepsFor(wf.steps, i)}
                  inputKeys={inputKeys}
                  envKeys={[...envKeys]}
                  repeating={insideRepeat(step, wf.steps)}
                  onChange={(s) => updateStep(i, s)}
                  onRemove={() => removeStep(step)}
                  onMove={(dir) => moveStep(i, dir)}
                  onAddInside={(kind) => addStep(kind, step.id)}
                />
              ) : (
                <StepEditor
                  step={step}
                  index={i}
                  total={wf.steps.length}
                  entries={entries}
                  workflows={workflows}
                  selfId={wf.id}
                  envKeys={envKeys}
                  inputKeys={inputKeys}
                  prevSteps={prevStepsFor(wf.steps, i)}
                  repeating={insideRepeat(step, wf.steps)}
                  onChange={(s) => updateStep(i, s)}
                  onRemove={() => removeStep(step)}
                  onMove={(dir) => moveStep(i, dir)}
                />
              )}
            </div>
          ))}
        </div>

        {identityReady ? <AddStepButton onAdd={(kind) => addStep(kind, null)} /> : null}
      </section>
    </div>
  );
}

export default WorkflowEditor;
