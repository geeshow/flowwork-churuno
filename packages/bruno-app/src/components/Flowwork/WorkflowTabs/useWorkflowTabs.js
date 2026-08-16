import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../api';

const storageKey = (source) => `flowwork-open-tabs-${source}`;

const readIds = (source) => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(source)) ?? '[]');
    return Array.isArray(saved) ? saved.map(String) : [];
  } catch (_error) {
    return [];
  }
};

/**
 * 열린 작업 탭 목록 — Bruno의 요청 탭과 같이 여러 작업을 동시에 열어 둔다.
 *
 * 어떤 탭이 활성인지는 주소(activeId)가 정하고, 여기서는 "열려 있는 목록"만 들고
 * 있는다. 새 화면으로 이동하면 그 작업이 목록에 자동으로 붙으므로 사이드바 클릭과
 * 공유 링크가 같은 경로를 탄다.
 */
export function useWorkflowTabs({ source, activeId, refreshKey, onSelect, onCloseLast }) {
  const [openIds, setOpenIds] = useState(() => readIds(source));
  const [summaries, setSummaries] = useState(null);

  useEffect(() => {
    localStorage.setItem(storageKey(source), JSON.stringify(openIds));
  }, [source, openIds]);

  useEffect(() => {
    let alive = true;
    api
      .listWorkflows(source)
      .then((rows) => alive && setSummaries(rows))
      .catch(() => alive && setSummaries([]));
    return () => {
      alive = false;
    };
  }, [source, refreshKey]);

  useEffect(() => {
    if (!activeId) return;
    setOpenIds((cur) => (cur.includes(activeId) ? cur : [...cur, activeId]));
  }, [activeId]);

  // 지워진 작업의 탭은 남겨봐야 열리지 않는다
  useEffect(() => {
    if (!summaries) return;
    const alive = new Set(summaries.map((w) => w.id));
    setOpenIds((cur) => (cur.every((id) => alive.has(id)) ? cur : cur.filter((id) => alive.has(id))));
  }, [summaries]);

  const tabs = useMemo(() => {
    const byId = new Map((summaries ?? []).map((w) => [w.id, w]));
    return openIds.map((id) => byId.get(id)).filter(Boolean);
  }, [openIds, summaries]);

  const close = useCallback(
    (id) => {
      const index = openIds.indexOf(id);
      const rest = openIds.filter((openId) => openId !== id);
      setOpenIds(rest);
      if (id !== activeId) return;
      // 닫힌 탭이 보고 있던 탭이면 옆 탭으로 옮겨간다 (Bruno와 같은 동작)
      const neighbour = rest[Math.min(index, rest.length - 1)];
      if (neighbour) onSelect(neighbour);
      else onCloseLast();
    },
    [openIds, activeId, onSelect, onCloseLast]
  );

  return { tabs, close };
}

export default useWorkflowTabs;
