import React, { useEffect, useMemo, useState } from 'react';

import api, { VersionConflictError } from '../../api';
import ConfirmButton from '../../ConfirmButton';
import { conditionSource } from '../../engine/branch';
import { isBlockStep } from '../../engine/runWorkflow';
import { withoutDraftNote } from '../../ai/wizard';
import Flowmap from '../../WorkflowScreen/Flowmap';
import AddStepButton from '../AddStepButton';
import AiSetupSuggest from '../AiSetupSuggest';
import AiStepSuggest from '../AiStepSuggest';
import AiWizard from '../AiWizard';
import BlockEditor from '../BlockEditor';
import InputDefEditor from '../InputDefEditor';
import { newStep } from '../stepFactory';
import StepEditor, { normalizeStepForSave } from '../StepEditor';

const emptyWorkflow = (domain = '', task = '') => ({
  id: crypto.randomUUID(),
  domain,
  task,
  name: '',
  description: '',
  baseInputs: [],
  steps: []
});

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

// 이 자리에서 끝나는 블록들 — 안쪽 블록부터. "안에 스텝 추가"는 블록에 든 마지막
// 스텝 아래에 놓아야 새 스텝이 어디에 붙는지 보인다 (빈 블록이면 그 머리 바로 아래).
const blocksEndingAt = (steps, index) =>
  steps
    .filter((s) => isBlockStep(s) && steps.indexOf(subtreeOf(steps, s).slice(-1)[0]) === index)
    .sort((a, b) => depthOf(b, steps) - depthOf(a, steps));

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
  // 새 작업은 언제나 고른 도메인·업무 안에서 시작하므로 위치는 여기서 정하지 않는다.
  // 옮기기·이름 바꾸기는 사이드바 작업 메뉴가, 도메인 색은 도메인 메뉴가 맡는다.
  const [wf, setWf] = useState(mode === 'new' ? emptyWorkflow(initialDomain, initialTask) : null);
  const [entries, setEntries] = useState([]);
  const [env, setEnv] = useState({});
  const [workflows, setWorkflows] = useState([]);
  const [domainColors, setDomainColors] = useState({});
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
  // 자식에게 넘기는 이름 목록 — 매번 새 배열을 만들면 그 안의 useMemo가 헛돈다
  const envKeyList = useMemo(() => [...envKeys], [envKeys]);
  const inputKeys = useMemo(() => (wf ? wf.baseInputs.map((i) => i.key).filter(Boolean) : []), [wf]);

  if (error && !wf) return <div className="error-banner">{error}</div>;
  if (!wf) return <p className="muted">불러오는 중…</p>;

  const identityReady = !!wf.name.trim();
  // 미리보기는 저장할 모양(고르지 않은 처리 방식은 뺀 것)으로 그린다
  const previewWorkflow = { ...wf, steps: wf.steps.map((s, idx) => ({ ...normalizeStepForSave(s), order: idx + 1 })) };

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

  // AI 제안은 덮어쓰지 않는다 — 이미 적어 둔 입력값은 그대로 두고 없는 key만 더한다
  const applySetupSuggestion = ({ name, description, baseInputs }) => {
    const have = new Set(wf.baseInputs.map((i) => i.key));
    setWf({
      ...wf,
      name: name || wf.name,
      description: description || wf.description,
      baseInputs: [...wf.baseInputs, ...baseInputs.filter((i) => !have.has(i.key))]
    });
  };

  // 마법사 초안은 편집기에 앉히기만 한다 — 처음부터 짜 주는 길이라 이미 적어 둔 것과
  // 겹칠 일이 없고, 저장은 사람이 한 번 훑어본 뒤에 누르는 것이 맞다.
  // docs는 어떻게 짜였는지를 적은 참고 글 — 사람이 쓴 문서 뒤에 붙이되, 여러 판을
  // 오가며 다시 확정하면 앞서 붙인 것을 갈아 끼운다 (판마다 쌓이면 어느 것이 지금 것인지 모른다).
  const confirmDraft = ({ name, description, baseInputs, steps, docs }) =>
    setWf({
      ...wf,
      name: name || wf.name,
      description: description || wf.description,
      baseInputs,
      steps,
      docs: [withoutDraftNote(wf.docs), docs].filter(Boolean).join('\n\n')
    });

  function validate(w) {
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
          {/* 위치는 여기서 정하지 않는다 — 새 작업은 고른 업무 안에서 시작하고,
              옮기기·이름 바꾸기는 사이드바 작업 메뉴에서 한다 */}
          <div className="field wide">
            <span className="field-label">위치</span>
            <div className="field-fixed">{[wf.domain, ...wf.task.split('/')].join(' / ')}</div>
          </div>
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

      {mode === 'new' ? (
        <AiWizard
          workflow={wf}
          entries={entries}
          workflows={workflows}
          envKeys={envKeyList}
          domainColors={domainColors}
          getWorkflow={(wid) => api.getWorkflow(wid, 'edit')}
          onConfirm={confirmDraft}
        />
      ) : null}

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
        <AiSetupSuggest
          workflow={wf}
          entries={entries}
          workflows={workflows}
          envKeys={envKeyList}
          getWorkflow={(id) => api.getWorkflow(id, 'edit')}
          onApply={applySetupSuggestion}
        />
        <InputDefEditor
          inputs={wf.baseInputs}
          entries={entries}
          inputKeys={inputKeys}
          envKeys={envKeyList}
          onChange={(baseInputs) => patch({ baseInputs })}
        />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>스텝 ({wf.steps.length})</h3>
        </div>

        {identityReady ? (
          <AiStepSuggest
            workflow={wf}
            entries={entries}
            workflows={workflows}
            envKeys={envKeyList}
            getWorkflow={(id) => api.getWorkflow(id, 'edit')}
            onApply={(steps) => setWf({ ...wf, steps: [...wf.steps, ...steps] })}
          />
        ) : null}

        {!identityReady ? (
          <p className="muted">먼저 이름을 입력하면 스텝을 추가할 수 있습니다.</p>
        ) : wf.steps.length === 0 ? (
          <p className="muted">스텝이 없습니다. 아래 "스텝 추가"로 API를 선택하고 입력을 매핑하세요.</p>
        ) : null}

        <div className="step-editor-list">
          {wf.steps.map((step, i) => (
            <React.Fragment key={step.id}>
              <div className="step-editor-row" style={{ marginLeft: depthOf(step, wf.steps) * 24 }}>
                {isBlockStep(step) ? (
                  <BlockEditor
                    block={step}
                    index={i}
                    total={wf.steps.length}
                    prevSteps={prevStepsFor(wf.steps, i)}
                    inputKeys={inputKeys}
                    envKeys={envKeyList}
                    repeating={insideRepeat(step, wf.steps)}
                    onChange={(s) => updateStep(i, s)}
                    onRemove={() => removeStep(step)}
                    onMove={(dir) => moveStep(i, dir)}
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
              {blocksEndingAt(wf.steps, i).map((block) => (
                <div
                  key={`add-in-${block.id}`}
                  className="step-editor-row"
                  style={{ marginLeft: (depthOf(block, wf.steps) + 1) * 24 }}
                >
                  <AddStepButton
                    label={`+ 이 ${block.kind === 'REPEAT' ? '반복' : '분기'} 안에 스텝 추가`}
                    onAdd={(kind) => addStep(kind, block.id)}
                  />
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>

        {identityReady ? <AddStepButton onAdd={(kind) => addStep(kind, null)} /> : null}
      </section>
    </div>
  );
}

export default WorkflowEditor;
