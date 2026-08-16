import React, { useEffect, useState } from 'react';

import api from '../../api';
import { ExecutionDetail } from '../../HistoryView';

/**
 * 이 작업의 실행 이력 — 목록에서 하나를 고르면 같은 탭 안에서 상세로 들어간다
 * (공유 링크로 여는 실행 상세와 같은 화면).
 */
export function HistoryTab({ workflow, refreshKey, limit = 30 }) {
  const [execs, setExecs] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .listExecutions()
      .then((e) => alive && setExecs(e))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [workflow.id, refreshKey]);

  if (error) return <div className="error-banner">{error}</div>;

  if (openId) {
    return (
      <div>
        <div className="run-topbar">
          <button className="link" onClick={() => setOpenId(null)}>
            ← 이력 목록
          </button>
        </div>
        <ExecutionDetail executionId={openId} />
      </div>
    );
  }

  if (!execs) return <p className="muted">불러오는 중…</p>;

  const rows = execs.filter((e) => e.workflow_id === workflow.id).slice(0, limit);
  if (rows.length === 0) return <p className="muted">아직 실행 이력이 없습니다.</p>;

  return (
    <ul className="exec-list">
      {rows.map((e) => (
        <li key={e.execution_id}>
          <button className="exec-row" onClick={() => setOpenId(e.execution_id)}>
            <span className={`status-badge ${e.overall_status.toLowerCase()}`}>
              {e.overall_status === 'SUCCESS' ? '성공' : '실패'}
            </span>
            <span className="muted exec-time">
              {e.started_at ? new Date(e.started_at * 1000).toLocaleString() : ''}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default HistoryTab;
