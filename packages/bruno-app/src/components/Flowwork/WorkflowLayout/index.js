import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { IconLayoutGrid } from '@tabler/icons';

import { updateIsDragging, updateLeftSidebarWidth } from 'providers/ReduxStore/slices/app';
import { setLocalStorageValue, SIDEBAR_WIDTH_KEY } from 'utils/common/localStorage';

import api from '../api';
import { colorForDomain } from '../domainPalette';

// Bruno 사이드바와 동일한 리사이즈 범위
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 270;

// 도메인 표시 순서 (미지정 도메인은 이 뒤에 가나다순으로 붙는다)
export const GROUP_ORDER = ['계좌', '계정', '매매', '정산', '인증', '마케팅', '상품'];

export function orderGroups(groups) {
  const known = GROUP_ORDER.filter((g) => groups.includes(g));
  const rest = groups.filter((g) => !GROUP_ORDER.includes(g)).sort((a, b) => a.localeCompare(b, 'ko'));
  return [...known, ...rest];
}

// 펼침 상태 — 라우트 이동으로 레이아웃이 다시 마운트돼도 유지되도록 저장한다
function usePersistedSet(storageKey) {
  const [set, setSet] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      return new Set(Array.isArray(saved) ? saved.map(String) : []);
    } catch (_error) {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify([...set]));
  }, [storageKey, set]);

  return [set, setSet];
}

const toggleIn = (setSet) => (key) =>
  setSet((cur) => {
    const next = new Set(cur);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

// 업무 경로("개설/신규")의 상위 경로들 — 깊은 항목을 열 때 조상까지 함께 펼친다
const ancestorsOf = (path) => {
  const segments = path.split('/');
  return segments.slice(0, -1).map((_, i) => segments.slice(0, i + 1).join('/'));
};

// 업무 경로("개설/신규")를 마디 단위로 비교해 부모가 자식 바로 앞에 오게 한다.
// 경로 문자열끼리 비교하면 '/'가 무시돼 형제 사이에 남의 자식이 끼어든다.
function compareTaskPaths(a, b) {
  const left = a.split('/');
  const right = b.split('/');
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    const order = left[i].localeCompare(right[i], 'ko');
    if (order) return order;
  }
  return left.length - right.length;
}

/**
 * 좌측 사이드바에 Bruno와 같은 [워크스페이스 → 컬렉션 → 폴더 → 작업] 트리를 두고,
 * 우측 detail 영역에 선택한 작업 화면(children)을 보여준다. 도메인이 컬렉션,
 * 업무가 폴더, 워크플로우가 작업이다 — 폴더를 누르면 접고 펴기만 하고, 화면이
 * 바뀌는 것은 작업을 눌렀을 때뿐이다.
 *
 * source="edit"이면 편집 worktree(develop/feature 브랜치) 기준 목록을 보여주고,
 * taskChanged/workflowChanged/domainBadge로 변경 상태를 표시할 수 있다.
 * refreshKey가 바뀌면 목록을 다시 불러온다 (저장/삭제 후 갱신용).
 */
export function WorkflowLayout({
  title = '워크플로우',
  workspace,
  source = 'prod',
  refreshKey,
  action,
  activeId,
  activeTask,
  onOpenWorkflow,
  onOpenHome,
  taskChanged,
  workflowChanged,
  domainBadge,
  taskMenu,
  domainMenu,
  workflowMenu,
  children
}) {
  const dispatch = useDispatch();
  const [rows, setRows] = useState(null);
  const [taskDirs, setTaskDirs] = useState([]);
  const [colors, setColors] = useState({});
  const [error, setError] = useState(null);
  // 타이틀바의 사이드바 토글·폭 조절을 Bruno 화면과 동일한 상태로 따른다
  const sidebarCollapsed = useSelector((state) => state.app.sidebarCollapsed);
  const leftSidebarWidth = useSelector((state) => state.app.leftSidebarWidth);
  const [dragging, setDragging] = useState(false);
  const [asideWidth, setAsideWidth] = useState(leftSidebarWidth ?? DEFAULT_SIDEBAR_WIDTH);
  const lastWidthRef = useRef(asideWidth);
  const sidebarWidth = dragging ? asideWidth : leftSidebarWidth ?? DEFAULT_SIDEBAR_WIDTH;

  const handleDragbarMouseDown = (e) => {
    e.preventDefault();
    const width = leftSidebarWidth ?? DEFAULT_SIDEBAR_WIDTH;
    setAsideWidth(width);
    lastWidthRef.current = width;
    setDragging(true);
    dispatch(updateIsDragging({ isDragging: true }));
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e) => {
      e.preventDefault();
      const nextWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, e.clientX + 2));
      if (Math.abs(nextWidth - lastWidthRef.current) < 3) return;
      lastWidthRef.current = nextWidth;
      setAsideWidth(nextWidth);
    };
    const handleMouseUp = (e) => {
      e.preventDefault();
      setDragging(false);
      dispatch(updateLeftSidebarWidth({ leftSidebarWidth: lastWidthRef.current }));
      setLocalStorageValue(SIDEBAR_WIDTH_KEY, lastWidthRef.current);
      dispatch(updateIsDragging({ isDragging: false }));
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, dispatch]);
  // 펼친 컬렉션/폴더 집합. 여러 개를 동시에 열어둘 수 있고, 새 선택이 기존 열림을 닫지 않는다.
  // 라우트 이동으로 레이아웃이 다시 마운트돼도 유지되도록 localStorage에 저장.
  const [openDomains, setOpenDomains] = usePersistedSet('flowwork-open-domains');
  const [openTasks, setOpenTasks] = usePersistedSet('flowwork-open-tasks');

  useEffect(() => {
    let alive = true;
    Promise.all([api.listWorkflows(source), api.getDomainColors(source), api.listTasks(source)])
      .then(([r, c, t]) => {
        if (!alive) return;
        setRows(r);
        setColors(c);
        setTaskDirs(t);
        setError(null);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [source, refreshKey]);

  // 열려 있는 작업(워크플로우)이 있으면 그 (컬렉션,폴더)를 강조 대상으로
  const activeWf = useMemo(() => rows?.find((w) => w.id === activeId) ?? null, [rows, activeId]);
  const hlDomain = (activeTask?.domain ?? activeWf?.domain)?.normalize('NFC');
  const hlTask = (activeTask?.task ?? activeWf?.task)?.normalize('NFC');

  // 선택된 항목이 보이도록 그 컬렉션과 상위 폴더들을 (기존 열림은 유지한 채) 펼친다
  useEffect(() => {
    if (!hlDomain) return;
    setOpenDomains((cur) => (cur.has(hlDomain) ? cur : new Set(cur).add(hlDomain)));
    if (!hlTask) return;
    setOpenTasks((cur) => {
      const missing = [hlTask, ...ancestorsOf(hlTask)].filter((p) => !cur.has(`${hlDomain}/${p}`));
      if (missing.length === 0) return cur;
      const next = new Set(cur);
      for (const path of missing) next.add(`${hlDomain}/${path}`);
      return next;
    });
  }, [hlDomain, hlTask, setOpenDomains, setOpenTasks]);

  // 컬렉션(도메인) → 폴더(업무) → 작업(워크플로우) 트리. 폴더는 하위 폴더를 가질 수 있어
  // 경로("개설/신규")로 다루고 화면에서는 깊이만큼 들여쓴다. 작업이 없는 빈 폴더도
  // 서버의 폴더 목록으로 채운다.
  const tree = useMemo(() => {
    const byDomain = new Map();
    for (const d of GROUP_ORDER) byDomain.set(d, { tasks: new Set(), workflows: new Map() });
    const groupFor = (domain) => {
      const d = domain.normalize('NFC');
      const group = byDomain.get(d) ?? { tasks: new Set(), workflows: new Map() };
      byDomain.set(d, group);
      return group;
    };
    const addTask = (domain, task) => {
      const { tasks } = groupFor(domain);
      // 상위 폴더는 목록에 없어도 트리에서 빠지면 안 된다
      const segments = task.normalize('NFC').split('/');
      for (let i = 1; i <= segments.length; i += 1) tasks.add(segments.slice(0, i).join('/'));
    };
    for (const w of rows ?? []) {
      addTask(w.domain, w.task);
      const { workflows } = groupFor(w.domain);
      const key = w.task.normalize('NFC');
      workflows.set(key, [...(workflows.get(key) ?? []), w]);
    }
    for (const t of taskDirs) addTask(t.domain, t.task);
    return orderGroups([...byDomain.keys()]).map((domain) => {
      const { tasks, workflows } = byDomain.get(domain);
      return {
        domain,
        workflowCount: [...workflows.values()].reduce((n, list) => n + list.length, 0),
        tasks: [...tasks].sort(compareTaskPaths).map((path) => {
          const segments = path.split('/');
          return {
            path,
            name: segments[segments.length - 1],
            depth: segments.length - 1,
            workflows: [...(workflows.get(path) ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
          };
        })
      };
    });
  }, [rows, taskDirs]);

  return (
    <div className="workspace">
      {sidebarCollapsed ? null : (
        <div className="wf-sidebar-wrap">
          <aside className="wf-sidebar" style={{ width: sidebarWidth }}>
            <div className="sidebar-scroll">
              <div className="sidebar-head">
                {onOpenHome ? (
                  <button className="sidebar-title-btn" onClick={onOpenHome} title="홈으로">
                    <h2 className="sidebar-title">{title}</h2>
                  </button>
                ) : (
                  <h2 className="sidebar-title">{title}</h2>
                )}
                {action}
              </div>

              {/* 워크스페이스 = 이 화면이 읽고 쓰는 브랜치 */}
              {workspace ? (
                <div className="wf-workspace" title={`브랜치 ${workspace}`}>
                  <IconLayoutGrid size={14} strokeWidth={1.5} />
                  <span className="wf-workspace-name">{workspace}</span>
                </div>
              ) : null}

              {error ? <div className="error-banner">{error}</div> : null}

              {!rows ? (
                <p className="muted">불러오는 중…</p>
              ) : (
                <nav className="domain-tree">
                  {tree.map(({ domain, tasks, workflowCount }) => {
                    const color = colorForDomain(domain, colors);
                    const open = openDomains.has(domain);
                    return (
                      <div key={domain} className={`domain-group ${open ? 'open' : ''}`}>
                        <div className="domain-row">
                          <button
                            className="domain-head"
                            onClick={() => toggleIn(setOpenDomains)(domain)}
                            aria-expanded={open}
                          >
                            <span className="domain-caret">{open ? '▾' : '▸'}</span>
                            <span className="domain-swatch" style={{ background: color }} />
                            <span className="domain-name">{domain}</span>
                            {domainBadge?.(domain)}
                            <span className="domain-count">{workflowCount}</span>
                          </button>
                          {domainMenu?.(domain)}
                        </div>
                        {open ? (
                          tasks.length === 0 ? (
                            <div className="task-empty muted">폴더 없음</div>
                          ) : (
                            <ul className="task-menu">
                              {tasks.map(({ path, name, depth, workflows }) => {
                                // 상위 폴더가 접혀 있으면 그 아래는 그리지 않는다
                                if (!ancestorsOf(path).every((p) => openTasks.has(`${domain}/${p}`))) return null;
                                const folderOpen = openTasks.has(`${domain}/${path}`);
                                const on = hlDomain === domain && hlTask === path;
                                return (
                                  <React.Fragment key={path}>
                                    <li className="task-row">
                                      <button
                                        className={`task-item ${on && !activeId ? 'active' : ''}`}
                                        style={{ paddingLeft: 8 + depth * 14 }}
                                        onClick={() => toggleIn(setOpenTasks)(`${domain}/${path}`)}
                                        aria-expanded={folderOpen}
                                      >
                                        <span className="task-caret">{folderOpen ? '▾' : '▸'}</span>
                                        {taskChanged?.(domain, path) ? (
                                          <span className="task-bullet changed" title="운영 미반영 변경 있음">
                                            U
                                          </span>
                                        ) : (
                                          <span className="task-bullet" style={{ background: color }} />
                                        )}
                                        <span className="task-text">{name}</span>
                                      </button>
                                      {taskMenu?.(domain, path)}
                                    </li>
                                    {folderOpen
                                      ? workflows.map((w) => (
                                          <li key={w.id} className="task-row">
                                            <button
                                              className={`task-item wf-item ${activeId === w.id ? 'active' : ''}`}
                                              style={{ paddingLeft: 22 + depth * 14 }}
                                              onClick={() => onOpenWorkflow(w.id)}
                                              title={w.description ?? w.name}
                                            >
                                              {workflowChanged?.(w.id) ? (
                                                <span className="task-bullet changed" title="운영 미반영 변경">
                                                  U
                                                </span>
                                              ) : (
                                                <span className="task-bullet hollow" style={{ borderColor: color }} />
                                              )}
                                              <span className="task-text">{w.name}</span>
                                            </button>
                                            {workflowMenu?.(w)}
                                          </li>
                                        ))
                                      : null}
                                  </React.Fragment>
                                );
                              })}
                            </ul>
                          )
                        ) : null}
                      </div>
                    );
                  })}
                </nav>
              )}
            </div>
          </aside>
          <div className="wf-sidebar-drag-handle" onMouseDown={handleDragbarMouseDown}>
            <div className="drag-border" />
          </div>
        </div>
      )}

      <div className="wf-detail">{children}</div>
    </div>
  );
}

export default WorkflowLayout;
