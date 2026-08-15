import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import api from './api';
import { colorForDomain } from './domainPalette';
import { ExecutionDetail, TaskRecentHistory } from './HistoryView';
import WorkflowEditor from './editor/WorkflowEditor';
import WorkflowLayout from './WorkflowLayout';
import WorkflowRunner from './WorkflowRunner';
import { executionHash } from './shareUrl';
import StyledWrapper from './StyledWrapper';

/**
 * #/flowwork 하위 해시 ↔ 내부 route 매핑. useWebRouteSync가 앱 전환(activeApp)만
 * 담당하고, 하위 경로의 해석·미러링은 여기서 한다 (해시는 정적 서빙을 그대로 탄다).
 *   #/flowwork                     home
 *   #/flowwork/t/<도메인>/<업무>    업무 화면
 *   #/flowwork/run/<id>            실행 화면
 *   #/flowwork/executions/<id>     실행 이력 상세 (공유 링크)
 */
const parseFlowworkHash = (hash) => {
  const segments = (hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (segments[0] !== 'flowwork') return null;
  const [, a, b, c] = segments;
  if (a === 'executions' && b) return { view: 'execution', executionId: b };
  if (a === 'run' && b) return { view: 'run', id: b };
  if (a === 't' && b && c) return { view: 'task', domain: b, task: c };
  return { view: 'home' };
};

const hashForRoute = (route) => {
  switch (route.view) {
    case 'execution':
      return executionHash(route.executionId);
    case 'run':
      return `#/flowwork/run/${encodeURIComponent(route.id)}`;
    case 'task':
      return `#/flowwork/t/${encodeURIComponent(route.domain)}/${encodeURIComponent(route.task)}`;
    default:
      // home — 편집 화면도 여기로 온다 (저장 전 상태라 공유 대상이 아니다)
      return '#/flowwork';
  }
};

/**
 * flowwork — 워크플로우 실행/편집 화면. AppTitleBar의 flowwork 탭으로 진입한다.
 * 화면 전환은 내부 route 상태로 처리한다:
 *   home → task(도메인/업무 선택) → run(실행) / execution(이력 상세) / editor(등록·수정)
 */
export default function Flowwork() {
  const [route, setRoute] = useState(() => parseFlowworkHash(window.location.hash) ?? { view: 'home' });
  // 저장/삭제 후 사이드바 목록 갱신용
  const [refreshKey, setRefreshKey] = useState(0);

  // route → URL: 현재 화면이 곧 주소창의 공유 링크가 된다 (replaceState — 이력 스팸 없음)
  useEffect(() => {
    const canonical = hashForRoute(route);
    if (window.location.hash !== canonical) {
      window.history.replaceState(null, '', canonical);
    }
  }, [route]);

  // URL → route: 링크 붙여넣기 등으로 해시가 바뀌면 화면을 맞춘다
  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseFlowworkHash(window.location.hash);
      if (parsed && window.location.hash !== hashForRoute(route)) {
        setRoute(parsed);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [route]);

  const openTask = (domain, task) => setRoute({ view: 'task', domain, task });

  const layoutProps = {
    refreshKey,
    activeId: route.view === 'run' ? route.id : undefined,
    activeTask: route.view === 'task' ? { domain: route.domain, task: route.task } : undefined,
    onOpenTask: openTask,
    action: (
      <button
        className="small"
        onClick={() =>
          setRoute({
            view: 'editor',
            mode: 'new',
            initialDomain: route.view === 'task' ? route.domain : undefined,
            initialTask: route.view === 'task' ? route.task : undefined
          })}
        title="워크플로우 등록"
      >
        + 새 워크플로우
      </button>
    )
  };

  if (route.view === 'editor') {
    return (
      <StyledWrapper>
        <div className="flowwork-content">
          <WorkflowEditor
            mode={route.mode}
            id={route.id}
            initialDomain={route.initialDomain}
            initialTask={route.initialTask}
            onSaved={(wf) => {
              setRefreshKey((k) => k + 1);
              toast.success('워크플로우가 저장되었습니다');
              setRoute({ view: 'task', domain: wf.domain, task: wf.task });
            }}
            onCancel={() => {
              if (route.backTo) setRoute(route.backTo);
              else setRoute({ view: 'home' });
            }}
          />
        </div>
      </StyledWrapper>
    );
  }

  return (
    <StyledWrapper>
      <div className="flowwork-content">
        <WorkflowLayout {...layoutProps}>
          {route.view === 'run' ? (
            <RunDetail
              id={route.id}
              onOpenTask={openTask}
              onOpenExecution={(executionId) => setRoute({ view: 'execution', executionId })}
              onEdit={() => setRoute({ view: 'editor', mode: 'edit', id: route.id, backTo: route })}
            />
          ) : route.view === 'task' ? (
            <TaskDetail
              domain={route.domain}
              task={route.task}
              refreshKey={refreshKey}
              onRun={(id) => setRoute({ view: 'run', id })}
              onEdit={(id) => setRoute({ view: 'editor', mode: 'edit', id, backTo: route })}
              onDeleted={() => setRefreshKey((k) => k + 1)}
              onOpenExecution={(executionId) => setRoute({ view: 'execution', executionId })}
            />
          ) : route.view === 'execution' ? (
            <section className="execution-page">
              <ExecutionDetail executionId={route.executionId} onOpenTask={openTask} />
            </section>
          ) : (
            <div className="detail-empty">
              <p className="muted">왼쪽에서 업무를 선택하면 해당 업무의 워크플로우가 여기에 표시됩니다.</p>
              <p className="muted">워크플로우 등록은 왼쪽 위 "+ 새 워크플로우" 버튼으로 합니다.</p>
            </div>
          )}
        </WorkflowLayout>
      </div>
    </StyledWrapper>
  );
}

/** 선택한 업무(도메인/업무) 하위의 모든 워크플로우(작업)를 한 화면에 나열한다. */
function TaskDetail({ domain, task, refreshKey, onRun, onEdit, onDeleted, onOpenExecution }) {
  const [rows, setRows] = useState(null);
  const [colors, setColors] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.listWorkflows(), api.getDomainColors()])
      .then(([r, c]) => {
        if (!alive) return;
        setRows(r);
        setColors(c);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!rows) return <p className="muted">불러오는 중…</p>;

  const color = colorForDomain(domain.normalize('NFC'), colors);
  const items = rows.filter(
    (w) => w.domain.normalize('NFC') === domain.normalize('NFC') && w.task.normalize('NFC') === task.normalize('NFC')
  );

  const handleDelete = async (w) => {
    if (!confirm(`'${w.name}' 워크플로우를 삭제할까요?`)) return;
    try {
      await api.deleteWorkflow(w.id);
      toast.success('삭제되었습니다');
      onDeleted();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <section>
      <div className="task-detail-head">
        <div className="crumb">
          <span className="task-bullet lg" style={{ background: color }} />
          <span className="muted">{domain}</span>
          <span className="muted">/</span>
          <h2>{task}</h2>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="detail-empty">
          <p className="muted">이 업무에는 아직 워크플로우가 없습니다. "+ 새 워크플로우"로 추가하세요.</p>
        </div>
      ) : (
        <div className="wf-card-grid">
          {items.map((w) => (
            <div key={w.id} className="wf-card wf-card-main" style={{ borderLeftColor: color }}>
              <button className="wf-card-open" onClick={() => onRun(w.id)}>
                <span className="wf-card-title">
                  <span className="task-bullet" style={{ background: color }} />
                  {w.name}
                </span>
                {w.description ? <span className="muted">{w.description}</span> : null}
              </button>
              <div className="wf-card-actions">
                <button className="link small" onClick={() => onEdit(w.id)}>
                  편집
                </button>
                <button className="link small danger" onClick={() => handleDelete(w)}>
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskRecentHistory domain={domain} task={task} workflows={items} onOpen={onOpenExecution} />
    </section>
  );
}

function RunDetail({ id, onOpenTask, onOpenExecution, onEdit }) {
  const [wf, setWf] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setWf(null);
    setError(null);
    api
      .getWorkflow(id)
      .then((w) => alive && setWf(w))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!wf) return <p className="muted">불러오는 중…</p>;
  return (
    <>
      <div className="run-topbar">
        <button className="link" onClick={() => onOpenTask(wf.domain, wf.task)}>
          ← {wf.domain} / {wf.task}
        </button>
        <button className="link" onClick={onEdit}>
          편집
        </button>
      </div>
      <WorkflowRunner workflow={wf} onOpenExecution={onOpenExecution} />
    </>
  );
}
