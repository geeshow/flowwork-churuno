import React, { useEffect, useState } from 'react';

import api from '../api';
import DocsPane from '../DocsPane';
import { colorForDomain } from '../domainPalette';
import { stepTypeMeta } from '../StepCard';
import WorkflowRunner from '../WorkflowRunner';
import EnvTab from './EnvTab';
import FileMode from './FileMode';
import Flowmap from './Flowmap';
import HistoryTab from './HistoryTab';

// AI(생성·자동완성)에 이 작업이 무엇을 하는지 알려주는 문맥 —
// 이름·위치·설명에 더해 실제 스텝 순서와 입력값까지 넘겨야 쓸만한 문장이 나온다
const docsContext = (wf) => ({
  scope: 'workflow',
  name: wf.name,
  location: `${wf.domain} / ${wf.task}`,
  description: wf.description || '',
  inputs: wf.baseInputs.map((input) => ({ key: input.key, label: input.label, type: input.type })),
  steps: [...wf.steps]
    .sort((a, b) => a.order - b.order)
    .map((step) => {
      const { typeLabel, category } = stepTypeMeta(step);
      return {
        order: step.order,
        name: step.name,
        kind: typeLabel,
        api: category,
        branch: step.branchCondition ? '조건부 실행' : undefined,
        asksUser: step.midInputs?.length ? step.midInputs.map((i) => i.label || i.key) : undefined
      };
    })
});

export const WORKFLOW_TABS = [
  { id: 'run', label: '실행' },
  { id: 'history', label: 'History' },
  { id: 'flowmap', label: 'Flowmap' },
  { id: 'env', label: '환경변수' },
  { id: 'docs', label: 'Docs' }
];

/**
 * 작업 화면 — Bruno의 요청 화면과 같은 구성이다. 위쪽에 어디에 있는 무슨 작업인지
 * 고정으로 띄우고, 그 아래를 탭(실행 / History / Flowmap / 환경변수 / Docs)으로 나눈다.
 *
 * 편집 모드(source="edit")에서만 수정·삭제와 문서 편집을 열어준다.
 */
export function WorkflowScreen({
  id,
  source = 'prod',
  tab,
  onTabChange,
  refreshKey,
  changed,
  fileMode,
  onEdit,
  onDelete,
  onOpenExecution,
  onSaved
}) {
  const [wf, setWf] = useState(null);
  const [colors, setColors] = useState({});
  const [workflows, setWorkflows] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setWf(null);
    setError(null);
    Promise.all([api.getWorkflow(id, source), api.getDomainColors(source), api.listWorkflows(source)])
      .then(([w, c, list]) => {
        if (!alive) return;
        setWf(w);
        setColors(c);
        setWorkflows(list);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id, source, refreshKey]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!wf) return <p className="muted">불러오는 중…</p>;

  const color = colorForDomain(wf.domain.normalize('NFC'), colors);
  const editable = source === 'edit';

  return (
    <section className="wf-screen">
      <header className="wf-screen-head" style={{ borderLeftColor: color }}>
        <div className="wf-screen-crumb">
          {[wf.domain, ...wf.task.split('/')].map((crumb, depth) => (
            <React.Fragment key={`${depth}-${crumb}`}>
              <span className="muted">{crumb}</span>
              <span className="muted">/</span>
            </React.Fragment>
          ))}
          <strong>{wf.name}</strong>
          {changed ? <span className="changed-badge">변경됨</span> : null}
        </div>
        {wf.description ? <p className="muted wf-screen-desc">{wf.description}</p> : null}
        {editable ? (
          <div className="wf-screen-actions">
            {onEdit ? (
              <button className="link small" onClick={() => onEdit(wf.id)}>
                수정
              </button>
            ) : null}
            {onDelete ? onDelete(wf) : null}
          </div>
        ) : null}
      </header>

      {fileMode ? (
        <FileMode workflow={wf} editable={editable} onSaved={onSaved} />
      ) : (
        <>
          <nav className="wf-tabs">
            {WORKFLOW_TABS.map((t) => (
              <button
                key={t.id}
                className={`wf-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => onTabChange(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="wf-tab-body">
            {tab === 'history' ? (
              <HistoryTab workflow={wf} refreshKey={refreshKey} />
            ) : tab === 'flowmap' ? (
              <Flowmap workflow={wf} workflows={workflows} />
            ) : tab === 'env' ? (
              <EnvTab workflow={wf} />
            ) : tab === 'docs' ? (
              <DocsPane
                docs={wf.docs ?? ''}
                editable={editable}
                context={docsContext(wf)}
                emptyLabel="이 작업이 무엇을 하는지 적어두면, 처음 보는 사람도 실행 전에 무슨 일이 일어나는지 알 수 있습니다."
                onSave={(next) => api.saveWorkflow({ ...wf, docs: next }).then(onSaved)}
              />
            ) : (
              <WorkflowRunner workflow={wf} source={source} onOpenExecution={onOpenExecution} />
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default WorkflowScreen;
