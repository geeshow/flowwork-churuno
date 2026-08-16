import React, { useEffect, useState } from 'react';

import api from './api';
import { colorForDomain } from './domainPalette';
import EditPage from './Edit';
import { ExecutionDetail, TaskRecentHistory } from './HistoryView';
import WorkflowLayout from './WorkflowLayout';
import WorkflowRunner from './WorkflowRunner';
import { executionHash } from './shareUrl';
import StyledWrapper from './StyledWrapper';

/**
 * #/flowwork 하위 해시 ↔ 내부 route 매핑. useWebRouteSync가 앱 전환(activeApp)만
 * 담당하고, 하위 경로의 해석·미러링은 여기서 한다 (해시는 정적 서빙을 그대로 탄다).
 *
 * 사용 모드 (운영 main 트리, 읽기 전용):
 *   #/flowwork                     home
 *   #/flowwork/t/<도메인>/<업무>    업무 화면
 *   #/flowwork/run/<id>            실행 화면
 *   #/flowwork/executions/<id>     실행 이력 상세 (공유 링크)
 *
 * 편집 모드 (공용 편집 공간 — 저장 즉시 기록, 운영 반영은 작업 단위):
 *   #/flowwork/edit             편집 홈 (변경 목록 · 운영 반영/작업 삭제)
 *   #/flowwork/edit/t/<d>/<t>   업무 화면
 *   #/flowwork/edit/run/<id>    실행 화면 (편집 공간 기준)
 *   #/flowwork/edit/new[/<d>/<t>] 새 워크플로우
 *   #/flowwork/edit/wf/<id>     워크플로우 수정
 */
const parseEditPage = (segments) => {
  const [a, b, c] = segments;
  if (a === 't' && b && c) return { kind: 'task', domain: b, task: c };
  if (a === 'run' && b) return { kind: 'run', id: b };
  if (a === 'new') return { kind: 'new', domain: b, task: c };
  if (a === 'wf' && b) return { kind: 'editWf', id: b };
  return { kind: 'home' };
};

const parseFlowworkHash = (hash) => {
  const segments = (hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (segments[0] !== 'flowwork') return null;
  const [, a, b, c] = segments;
  if (a === 'edit') {
    return { view: 'edit', page: parseEditPage(segments.slice(2)) };
  }
  if (a === 'executions' && b) return { view: 'execution', executionId: b };
  if (a === 'run' && b) return { view: 'run', id: b };
  if (a === 't' && b && c) return { view: 'task', domain: b, task: c };
  return { view: 'home' };
};

const editPageHash = (page) => {
  switch (page.kind) {
    case 'task':
      return `/t/${encodeURIComponent(page.domain)}/${encodeURIComponent(page.task)}`;
    case 'run':
      return `/run/${encodeURIComponent(page.id)}`;
    case 'new':
      return page.domain && page.task
        ? `/new/${encodeURIComponent(page.domain)}/${encodeURIComponent(page.task)}`
        : '/new';
    case 'editWf':
      return `/wf/${encodeURIComponent(page.id)}`;
    default:
      return '';
  }
};

const hashForRoute = (route) => {
  switch (route.view) {
    case 'edit':
      return `#/flowwork/edit${editPageHash(route.page)}`;
    case 'execution':
      return executionHash(route.executionId);
    case 'run':
      return `#/flowwork/run/${encodeURIComponent(route.id)}`;
    case 'task':
      return `#/flowwork/t/${encodeURIComponent(route.domain)}/${encodeURIComponent(route.task)}`;
    default:
      return '#/flowwork';
  }
};

/**
 * flowwork — 워크플로우 실행/편집 화면. AppTitleBar의 flowwork 탭으로 진입한다.
 *
 * 사용 모드는 운영(main) 데이터를 읽기 전용으로 보여주고, 등록/수정은 편집 모드
 * (feature 브랜치 worktree → 커밋 → develop 머지 → 운영 릴리스)에서만 한다.
 */
export default function Flowwork() {
  const [route, setRoute] = useState(() => parseFlowworkHash(window.location.hash) ?? { view: 'home' });

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
  const openExecution = (executionId) => setRoute({ view: 'execution', executionId });

  if (route.view === 'edit') {
    return (
      <StyledWrapper>
        <div className="flowwork-content edit-area">
          <EditPage
            page={route.page}
            go={(page) => setRoute({ view: 'edit', page })}
            onExit={() => setRoute({ view: 'home' })}
            onOpenExecution={openExecution}
          />
        </div>
      </StyledWrapper>
    );
  }

  const layoutProps = {
    activeId: route.view === 'run' ? route.id : undefined,
    activeTask: route.view === 'task' ? { domain: route.domain, task: route.task } : undefined,
    onOpenTask: openTask,
    onOpenHome: () => setRoute({ view: 'home' }),
    action: (
      <button
        className="small"
        onClick={() => setRoute({ view: 'edit', page: { kind: 'home' } })}
        title="워크플로우 등록/수정 — 저장 즉시 기록, 원하는 작업만 운영 반영"
      >
        편집 모드
      </button>
    )
  };

  return (
    <StyledWrapper>
      <div className="flowwork-content">
        <WorkflowLayout {...layoutProps}>
          {route.view === 'run' ? (
            <RunDetail id={route.id} onOpenTask={openTask} onOpenExecution={openExecution} />
          ) : route.view === 'task' ? (
            <TaskDetail
              domain={route.domain}
              task={route.task}
              onRun={(id) => setRoute({ view: 'run', id })}
              onOpenExecution={openExecution}
            />
          ) : route.view === 'execution' ? (
            <section className="execution-page">
              <ExecutionDetail executionId={route.executionId} onOpenTask={openTask} />
            </section>
          ) : (
            <section className="home-guide">
              <div className="guide-hero">
                <h2>워크플로우</h2>
                <p className="muted">
                  Bruno에 저장된 API들을 순서대로 엮어 여러 단계 업무를 한 번에 실행하는 도구입니다. 왼쪽에서
                  업무를 선택하면 실행할 수 있습니다.
                </p>
                <p className="muted">워크플로우 등록/수정과 동작 원리 안내는 왼쪽 위 "편집 모드"에 있습니다.</p>
              </div>
            </section>
          )}
        </WorkflowLayout>
      </div>
    </StyledWrapper>
  );
}

/** 선택한 업무(도메인/업무) 하위의 모든 워크플로우(작업)를 한 화면에 나열한다 (읽기 전용). */
function TaskDetail({ domain, task, onRun, onOpenExecution }) {
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
  }, []);

  if (error) return <div className="error-banner">{error}</div>;
  if (!rows) return <p className="muted">불러오는 중…</p>;

  const color = colorForDomain(domain.normalize('NFC'), colors);
  const items = rows.filter(
    (w) => w.domain.normalize('NFC') === domain.normalize('NFC') && w.task.normalize('NFC') === task.normalize('NFC')
  );

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
          <p className="muted">이 업무에는 아직 워크플로우가 없습니다. 편집 모드에서 추가할 수 있습니다.</p>
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
            </div>
          ))}
        </div>
      )}

      <TaskRecentHistory domain={domain} task={task} workflows={items} onOpen={onOpenExecution} />
    </section>
  );
}

function RunDetail({ id, onOpenTask, onOpenExecution }) {
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
      </div>
      <WorkflowRunner workflow={wf} onOpenExecution={onOpenExecution} />
    </>
  );
}
