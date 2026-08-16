import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

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

/**
 * 좌측 사이드바에 [도메인(세로) → 업무(자식 메뉴)] 트리를 고정으로 두고,
 * 우측 detail 영역에 선택한 업무의 워크플로우 목록 / 실행 화면(children)을 보여준다.
 * 자식(업무) 메뉴 왼쪽에는 도메인 전용 색상 불릿을 찍어 도메인을 구분한다.
 *
 * source="edit"이면 편집 worktree(develop/feature 브랜치) 기준 목록을 보여주고,
 * taskBadge/domainBadge로 업무·도메인 옆에 변경 상태 배지를 붙일 수 있다.
 * refreshKey가 바뀌면 목록을 다시 불러온다 (저장/삭제 후 갱신용).
 */
export function WorkflowLayout({
  title = '워크플로우',
  source = 'prod',
  refreshKey,
  action,
  activeId,
  activeTask,
  onOpenTask,
  onOpenHome,
  taskBadge,
  domainBadge,
  taskMenu,
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
  // 펼친 도메인 집합. 여러 도메인을 동시에 열어둘 수 있고, 새 선택이 기존 열림을 닫지 않는다.
  // 라우트 이동으로 레이아웃이 다시 마운트돼도 유지되도록 localStorage에 저장.
  const [openDomains, setOpenDomains] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('flowwork-open-domains') ?? '[]');
      return new Set(Array.isArray(saved) ? saved.map(String) : []);
    } catch (_error) {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem('flowwork-open-domains', JSON.stringify([...openDomains]));
  }, [openDomains]);

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

  // 실행 중인 워크플로우가 있으면 그 (도메인,업무)를 강조 대상으로
  const runningWf = useMemo(() => rows?.find((w) => w.id === activeId) ?? null, [rows, activeId]);
  const hlDomain = (activeTask?.domain ?? runningWf?.domain)?.normalize('NFC');
  const hlTask = (activeTask?.task ?? runningWf?.task)?.normalize('NFC');

  // 선택된 업무가 있으면 그 도메인을 (기존에 열린 도메인은 유지한 채) 펼친다
  useEffect(() => {
    if (!hlDomain) return;
    setOpenDomains((cur) => (cur.has(hlDomain) ? cur : new Set(cur).add(hlDomain)));
  }, [hlDomain]);

  // 도메인 → 업무(정렬) 트리. 워크플로우가 없는 빈 업무도 서버의 폴더 목록으로 채운다.
  const tree = useMemo(() => {
    const byDomain = new Map();
    for (const d of GROUP_ORDER) byDomain.set(d, new Set());
    const add = (domain, task) => {
      const d = domain.normalize('NFC');
      const tasks = byDomain.get(d) ?? new Set();
      tasks.add(task.normalize('NFC'));
      byDomain.set(d, tasks);
    };
    for (const w of rows ?? []) add(w.domain, w.task);
    for (const t of taskDirs) add(t.domain, t.task);
    return orderGroups([...byDomain.keys()]).map((domain) => ({
      domain,
      tasks: [...byDomain.get(domain)].sort((a, b) => a.localeCompare(b, 'ko'))
    }));
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

              {error ? <div className="error-banner">{error}</div> : null}

              {!rows ? (
                <p className="muted">불러오는 중…</p>
              ) : (
                <nav className="domain-tree">
                  {tree.map(({ domain, tasks }) => {
                    const color = colorForDomain(domain, colors);
                    const open = openDomains.has(domain);
                    return (
                      <div key={domain} className={`domain-group ${open ? 'open' : ''}`}>
                        <button
                          className="domain-head"
                          onClick={() =>
                            setOpenDomains((cur) => {
                              const next = new Set(cur);
                              if (next.has(domain)) next.delete(domain);
                              else next.add(domain);
                              return next;
                            })}
                          aria-expanded={open}
                        >
                          <span className="domain-caret">{open ? '▾' : '▸'}</span>
                          <span className="domain-swatch" style={{ background: color }} />
                          <span className="domain-name">{domain}</span>
                          {domainBadge?.(domain)}
                          <span className="domain-count">{tasks.length}</span>
                        </button>
                        {open ? (
                          tasks.length === 0 ? (
                            <div className="task-empty muted">업무 없음</div>
                          ) : (
                            <ul className="task-menu">
                              {tasks.map((task) => {
                                const on = hlDomain === domain && hlTask === task;
                                return (
                                  <li key={task} className="task-row">
                                    <button
                                      className={`task-item ${on ? 'active' : ''}`}
                                      onClick={() => onOpenTask(domain, task)}
                                    >
                                      <span className="task-bullet" style={{ background: color }} />
                                      <span className="task-text">{task}</span>
                                      {taskBadge?.(domain, task)}
                                    </button>
                                    {taskMenu?.(domain, task)}
                                  </li>
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
