import React, { useEffect, useState } from 'react';

import api from '../api';
import { colorForDomain } from '../domainPalette';
import WorkflowRunner from '../WorkflowRunner';
import DocsTab from './DocsTab';
import EnvTab from './EnvTab';
import Flowmap from './Flowmap';
import HistoryTab from './HistoryTab';

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
          <DocsTab workflow={wf} editable={editable} onSaved={onSaved} />
        ) : (
          <WorkflowRunner workflow={wf} source={source} onOpenExecution={onOpenExecution} />
        )}
      </div>
    </section>
  );
}

export default WorkflowScreen;
