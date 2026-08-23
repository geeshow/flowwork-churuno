import React, { useEffect, useState } from 'react';

import api from './api';
import EditPage from './Edit';
import FolderScreen from './FolderScreen';
import { ExecutionDetail } from './HistoryView';
import TopBar from './TopBar';
import WorkflowLayout from './WorkflowLayout';
import WorkflowScreen from './WorkflowScreen';
import WorkflowTabs, { folderKey, useWorkflowTabs, workflowKey } from './WorkflowTabs';
import { executionHash } from './shareUrl';
import StyledWrapper from './StyledWrapper';

/**
 * #/flowwork 하위 해시 ↔ 내부 route 매핑. useWebRouteSync가 앱 전환(activeApp)만
 * 담당하고, 하위 경로의 해석·미러링은 여기서 한다 (해시는 정적 서빙을 그대로 탄다).
 *
 * 사용 모드 (운영 main 트리, Docs 외에는 읽기 전용):
 *   #/flowwork                     home
 *   #/flowwork/t/<도메인>/<업무>    업무 화면
 *   #/flowwork/run/<id>            실행 화면
 *   #/flowwork/executions/<id>     실행 이력 상세 (공유 링크)
 *
 * 편집 모드 (공용 편집 공간 — 저장 즉시 기록, 운영 반영은 작업 단위):
 *   #/flowwork/edit             편집 홈 (변경 목록 · 운영 반영/작업 삭제)
 *   #/flowwork/edit/t/<d>/<t>   업무 화면
 *   #/flowwork/edit/run/<id>    실행 화면 (편집 공간 기준)
 *   #/flowwork/edit/new/<d>/<t> 새 워크플로우 (언제나 업무 안에서 만든다)
 *   #/flowwork/edit/wf/<id>     워크플로우 수정
 */
const parseEditPage = (segments) => {
  const [a, b, c, d] = segments;
  if (a === 't' && b && c) return { kind: 'task', domain: b, task: c, tab: d };
  if (a === 'run' && b) return { kind: 'run', id: b, tab: c };
  if (a === 'new' && b && c) return { kind: 'new', domain: b, task: c };
  if (a === 'wf' && b) return { kind: 'editWf', id: b };
  return { kind: 'home' };
};

const parseFlowworkHash = (hash) => {
  const segments = (hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (segments[0] !== 'flowwork') return null;
  const [, a, b, c, d] = segments;
  if (a === 'edit') {
    return { view: 'edit', page: parseEditPage(segments.slice(2)) };
  }
  if (a === 'executions' && b) return { view: 'execution', executionId: b };
  if (a === 'run' && b) return { view: 'run', id: b, tab: c };
  if (a === 't' && b && c) return { view: 'task', domain: b, task: c, tab: d };
  return { view: 'home' };
};

// 화면 안에서 열려 있는 탭까지 주소에 담는다 — 링크로 그 탭을 바로 열 수 있다
const runHash = (id, tab) =>
  `/run/${encodeURIComponent(id)}${tab && tab !== 'run' ? `/${encodeURIComponent(tab)}` : ''}`;

const taskHash = (domain, task, tab) =>
  `/t/${encodeURIComponent(domain)}/${encodeURIComponent(task)}${
    tab && tab !== 'overview' ? `/${encodeURIComponent(tab)}` : ''
  }`;

const editPageHash = (page) => {
  switch (page.kind) {
    case 'task':
      return taskHash(page.domain, page.task, page.tab);
    case 'run':
      return runHash(page.id, page.tab);
    case 'new':
      return `/new/${encodeURIComponent(page.domain)}/${encodeURIComponent(page.task)}`;
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
      return `#/flowwork${runHash(route.id, route.tab)}`;
    case 'task':
      return `#/flowwork${taskHash(route.domain, route.task, route.tab)}`;
    default:
      return '#/flowwork';
  }
};

// Bruno 앱으로 갔다 오면 이 컴포넌트가 통째로 다시 마운트되고, 그 사이 주소는
// Bruno 쪽 해시로 바뀌어 있다. 마지막 화면을 적어 두었다가 그 자리로 돌아온다.
const LAST_HASH_KEY = 'flowwork-last-hash';

const initialRoute = () =>
  parseFlowworkHash(window.location.hash)
  ?? parseFlowworkHash(localStorage.getItem(LAST_HASH_KEY))
  ?? { view: 'home' };

// 머리띠 브레드크럼 — 지금 열려 있는 화면의 위치를 컬렉션부터 늘어놓는다
const crumbsFor = (route, tabs) => {
  if (route.view === 'task') return [route.domain, ...route.task.split('/')];
  if (route.view === 'run') {
    const tab = tabs.find((t) => t.kind === 'workflow' && t.id === route.id);
    return tab ? [tab.domain, ...tab.task.split('/'), tab.name] : [];
  }
  return [];
};

/**
 * flowwork — 워크플로우 실행/편집 화면. AppTitleBar의 flowwork 탭으로 진입한다.
 *
 * 사용 모드는 운영(main) 데이터를 읽기 전용으로 보여주고, 등록/수정은 편집 모드
 * (feature 브랜치 worktree → 커밋 → develop 머지 → 운영 릴리스)에서만 한다.
 * 다만 Docs는 사용 모드에서도 쓸 수 있다 — 서버가 운영에 바로 기록한다.
 */
export default function Flowwork() {
  const [route, setRoute] = useState(initialRoute);
  // 사용 모드가 읽는 브랜치 = 워크스페이스 이름
  const [workspace, setWorkspace] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .editState()
      .then((s) => alive && setWorkspace(s.prod_branch))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // route → URL: 현재 화면이 곧 주소창의 공유 링크가 된다 (replaceState — 이력 스팸 없음)
  useEffect(() => {
    const canonical = hashForRoute(route);
    localStorage.setItem(LAST_HASH_KEY, canonical);
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

  const openWorkflow = (id) => setRoute({ view: 'run', id });
  const openTask = (domain, task) => setRoute({ view: 'task', domain, task });
  const openExecution = (executionId) => setRoute({ view: 'execution', executionId });
  const activeId = route.view === 'run' ? route.id : undefined;
  const activeKey
    = route.view === 'run'
      ? workflowKey(route.id)
      : route.view === 'task'
        ? folderKey(route.domain, route.task)
        : undefined;
  const openTab = (tab) => (tab.kind === 'folder' ? openTask(tab.domain, tab.task) : openWorkflow(tab.id));
  const { tabs, close } = useWorkflowTabs({
    source: 'prod',
    activeKey,
    onSelect: openTab,
    onCloseLast: () => setRoute({ view: 'home' })
  });

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
    workspace,
    activeId,
    activeTask: route.view === 'task' ? { domain: route.domain, task: route.task } : undefined,
    onOpenTask: openTask,
    onOpenWorkflow: openWorkflow,
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
          <TopBar workspace={workspace} crumbs={crumbsFor(route, tabs)} />
          <WorkflowTabs tabs={tabs} activeKey={activeKey} onSelect={openTab} onClose={close} />
          {route.view === 'task' ? (
            <FolderScreen
              domain={route.domain}
              task={route.task}
              tab={route.tab ?? 'overview'}
              onTabChange={(tab) => setRoute({ view: 'task', domain: route.domain, task: route.task, tab })}
              onOpenWorkflow={openWorkflow}
            />
          ) : route.view === 'run' ? (
            <WorkflowScreen
              id={route.id}
              tab={route.tab ?? 'run'}
              onTabChange={(tab) => setRoute({ view: 'run', id: route.id, tab })}
              onOpenExecution={openExecution}
            />
          ) : route.view === 'execution' ? (
            <section className="execution-page">
              <ExecutionDetail executionId={route.executionId} onOpenWorkflow={openWorkflow} />
            </section>
          ) : (
            <section className="home-guide">
              <div className="guide-hero">
                <h2>워크플로우</h2>
                <p className="muted">
                  Bruno에 저장된 API들을 순서대로 엮어 여러 단계 업무를 한 번에 실행하는 도구입니다. 왼쪽에서
                  폴더를 펼쳐 작업을 선택하면 실행할 수 있습니다.
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
