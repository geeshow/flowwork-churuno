import React, { useEffect, useMemo, useState } from 'react';

import api from '../api';
import { colorForDomain } from '../domainPalette';

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
 * refreshKey가 바뀌면 목록을 다시 불러온다 (저장/삭제 후 갱신용).
 */
export function WorkflowLayout({
  title = '워크플로우',
  refreshKey,
  action,
  activeId,
  activeTask,
  onOpenTask,
  children
}) {
  const [rows, setRows] = useState(null);
  const [colors, setColors] = useState({});
  const [error, setError] = useState(null);
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
    Promise.all([api.listWorkflows(), api.getDomainColors()])
      .then(([r, c]) => {
        if (!alive) return;
        setRows(r);
        setColors(c);
        setError(null);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  // 실행 중인 워크플로우가 있으면 그 (도메인,업무)를 강조 대상으로
  const runningWf = useMemo(() => rows?.find((w) => w.id === activeId) ?? null, [rows, activeId]);
  const hlDomain = (activeTask?.domain ?? runningWf?.domain)?.normalize('NFC');
  const hlTask = (activeTask?.task ?? runningWf?.task)?.normalize('NFC');

  // 선택된 업무가 있으면 그 도메인을 (기존에 열린 도메인은 유지한 채) 펼친다
  useEffect(() => {
    if (!hlDomain) return;
    setOpenDomains((cur) => (cur.has(hlDomain) ? cur : new Set(cur).add(hlDomain)));
  }, [hlDomain]);

  // 도메인 → 업무(정렬) 트리
  const tree = useMemo(() => {
    const byDomain = new Map();
    for (const d of GROUP_ORDER) byDomain.set(d, []);
    for (const w of rows ?? []) {
      const d = w.domain.normalize('NFC');
      const list = byDomain.get(d) ?? [];
      list.push(w);
      byDomain.set(d, list);
    }
    return orderGroups([...byDomain.keys()]).map((domain) => {
      const items = byDomain.get(domain);
      const tasks = [...new Set(items.map((w) => w.task.normalize('NFC')))].sort((a, b) => a.localeCompare(b, 'ko'));
      return { domain, tasks };
    });
  }, [rows]);

  return (
    <div className="workspace">
      <aside className="wf-sidebar">
        <div className="sidebar-scroll">
          <div className="sidebar-head">
            <h2 className="sidebar-title">{title}</h2>
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
                              <li key={task}>
                                <button
                                  className={`task-item ${on ? 'active' : ''}`}
                                  onClick={() => onOpenTask(domain, task)}
                                >
                                  <span className="task-bullet" style={{ background: color }} />
                                  <span className="task-text">{task}</span>
                                </button>
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

      <div className="wf-detail">{children}</div>
    </div>
  );
}

export default WorkflowLayout;
