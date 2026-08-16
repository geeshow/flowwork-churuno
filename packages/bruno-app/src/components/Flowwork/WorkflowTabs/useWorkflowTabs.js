import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../api';

const storageKey = (source) => `flowwork-open-tabs-${source}`;

// 탭 하나를 가리키는 키 — 작업은 id로, 폴더는 경로로 잡는다
export const workflowKey = (id) => `wf:${id}`;
export const folderKey = (domain, task) => `folder:${domain}/${task}`;

const readKeys = (source) => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(source)) ?? '[]');
    return Array.isArray(saved) ? saved.map(String) : [];
  } catch (_error) {
    return [];
  }
};

/**
 * 열린 탭 목록 — Bruno의 요청 탭과 같이 여러 화면을 동시에 열어 둔다.
 * 작업(워크플로우)과 폴더(업무) 화면이 같은 줄에 섞여 놓인다.
 *
 * 어떤 탭이 활성인지는 주소(activeKey)가 정하고, 여기서는 "열려 있는 목록"만
 * 들고 있는다. 새 화면으로 이동하면 그 탭이 목록에 자동으로 붙으므로 사이드바
 * 클릭과 공유 링크가 같은 경로를 탄다.
 */
export function useWorkflowTabs({ source, activeKey, refreshKey, onSelect, onCloseLast }) {
  const [openKeys, setOpenKeys] = useState(() => readKeys(source));
  const [rows, setRows] = useState(null);

  useEffect(() => {
    localStorage.setItem(storageKey(source), JSON.stringify(openKeys));
  }, [source, openKeys]);

  useEffect(() => {
    let alive = true;
    Promise.all([api.listWorkflows(source), api.listTasks(source)])
      .then(([workflows, tasks]) => alive && setRows({ workflows, tasks }))
      .catch(() => alive && setRows({ workflows: [], tasks: [] }));
    return () => {
      alive = false;
    };
  }, [source, refreshKey]);

  useEffect(() => {
    if (!activeKey) return;
    setOpenKeys((cur) => (cur.includes(activeKey) ? cur : [...cur, activeKey]));
  }, [activeKey]);

  const byKey = useMemo(() => {
    const map = new Map();
    for (const w of rows?.workflows ?? []) {
      map.set(workflowKey(w.id), { key: workflowKey(w.id), kind: 'workflow', id: w.id, name: w.name, domain: w.domain, task: w.task });
    }
    for (const t of rows?.tasks ?? []) {
      const name = t.task.slice(t.task.lastIndexOf('/') + 1);
      map.set(folderKey(t.domain, t.task), { key: folderKey(t.domain, t.task), kind: 'folder', name, domain: t.domain, task: t.task });
    }
    return map;
  }, [rows]);

  // 지워진 작업·폴더의 탭은 남겨봐야 열리지 않는다
  useEffect(() => {
    if (!rows) return;
    setOpenKeys((cur) => (cur.every((key) => byKey.has(key)) ? cur : cur.filter((key) => byKey.has(key))));
  }, [rows, byKey]);

  const tabs = useMemo(() => openKeys.map((key) => byKey.get(key)).filter(Boolean), [openKeys, byKey]);

  const close = useCallback(
    (key) => {
      const index = openKeys.indexOf(key);
      const rest = openKeys.filter((openKey) => openKey !== key);
      setOpenKeys(rest);
      if (key !== activeKey) return;
      // 닫힌 탭이 보고 있던 탭이면 옆 탭으로 옮겨간다 (Bruno와 같은 동작)
      const neighbour = rest[Math.min(index, rest.length - 1)];
      if (neighbour) onSelect(byKey.get(neighbour));
      else onCloseLast();
    },
    [openKeys, activeKey, byKey, onSelect, onCloseLast]
  );

  return { tabs, close };
}

export default useWorkflowTabs;
