import React, { useEffect, useMemo, useState } from 'react';

import api from '../api';
import { colorForDomain } from '../domainPalette';
import { executionShareUrl } from '../shareUrl';
import { StepCard, stepTypeMeta } from '../StepCard';

const cell = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const toStepState = (entry) => {
  const status = entry.response?.status;
  return {
    stepId: entry.step_id ?? '',
    status: status != null && status >= 200 && status < 300 ? 'SUCCESS' : 'FAILED',
    request: entry.request,
    response: entry.response?.body
  };
};

const overallStatus = (entries) => {
  const ok = entries.every((e) => {
    const s = e.response?.status;
    return s != null && s >= 200 && s < 300;
  });
  return ok ? 'SUCCESS' : 'FAILED';
};

/**
 * 실행 상세 — 저장된 실행 로그를 불러와, 실행 화면과 "동일하게" 렌더한다.
 * 로그의 workflow_id로 워크플로우를 로드해 스텝 이름/결과표(resultView)를 함께 보여준다.
 * (응답은 저장 시 리댁션된 사본이라 비밀번호 등은 마스킹된 채 공유된다.)
 */
export function ExecutionDetail({ executionId, onOpenTask }) {
  const [entries, setEntries] = useState(null);
  const [wfById, setWfById] = useState(new Map());
  const [topWfId, setTopWfId] = useState(undefined);
  const [colors, setColors] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setEntries(null);
    setWfById(new Map());
    setTopWfId(undefined);
    api
      .getExecution(executionId)
      .then(async (r) => {
        if (!alive) return;
        const steps = r.steps;
        setEntries(steps);
        api.getDomainColors().then((c) => alive && setColors(c)).catch(() => {});
        // 최상위 워크플로우: 입력값 엔트리에 기록된 id 우선(첫 스텝이 하위 업무 연결일 수 있음)
        const inputs = steps.find((e) => e.kind === 'inputs');
        const firstStep = steps.find((e) => e.step_id);
        const top = inputs?.workflow_id ?? firstStep?.workflow_id;
        if (alive) setTopWfId(top);
        // 로그에 등장하는 모든 워크플로우 로드 (연결된 하위 업무 포함) → 스텝 이름/결과표 복원
        const ids = [...new Set(steps.map((e) => e.workflow_id).filter(Boolean))];
        if (top && !ids.includes(top)) ids.push(top);
        const loaded = await Promise.all(
          ids.map((id) =>
            api
              .getWorkflow(id)
              .then((w) => [id, w])
              .catch(() => null))
        );
        if (alive) setWfById(new Map(loaded.filter(Boolean)));
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [executionId]);

  const topWf = topWfId ? wfById.get(topWfId) : undefined;
  // 각 로그 엔트리를 자기 워크플로우의 스텝(리프 id)으로 해석하는 헬퍼
  const stepFor = (entry) => {
    const wf = entry.workflow_id ? wfById.get(entry.workflow_id) : undefined;
    const leafId = entry.step_id?.split('/').pop();
    return wf?.steps.find((s) => s.id === leafId);
  };
  // 입력값 key → label (최상위 기본 입력값 + 모든 워크플로우의 중간 입력)
  const inputLabels = useMemo(() => {
    const m = new Map();
    for (const b of topWf?.baseInputs ?? []) m.set(b.key, b.label);
    for (const w of wfById.values()) for (const s of w.steps) for (const mi of s.midInputs ?? []) m.set(mi.key, mi.label);
    return m;
  }, [topWf, wfById]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!entries) return <p className="muted">불러오는 중…</p>;

  const stepEntries = entries.filter((e) => e.step_id);
  const inputsEntry = entries.find((e) => e.kind === 'inputs');
  const status = overallStatus(stepEntries);
  const startedAt = stepEntries[0]?.timestamp;
  const color = topWf ? colorForDomain(topWf.domain.normalize('NFC'), colors) : 'currentColor';

  return (
    <div>
      {topWf && onOpenTask ? (
        <div className="run-topbar">
          <button className="link" onClick={() => onOpenTask(topWf.domain, topWf.task)}>
            ← {topWf.domain} / {topWf.task}
          </button>
        </div>
      ) : null}
      <div className="exec-detail-head">
        <div className="crumb">
          <span className="task-bullet lg" style={{ background: color }} />
          {topWf ? (
            <>
              <span className="muted">{topWf.domain}</span>
              <span className="muted">/</span>
              <span className="muted">{topWf.task}</span>
              <span className="muted">/</span>
              <h2>{topWf.name}</h2>
            </>
          ) : (
            <h2>{topWfId ?? '실행 결과'}</h2>
          )}
          <span className={`status-badge ${status.toLowerCase()}`}>{status === 'SUCCESS' ? '성공' : '실패'}</span>
        </div>
        {startedAt ? <span className="muted">{new Date(startedAt * 1000).toLocaleString()}</span> : null}
      </div>

      <div className="share-row">
        <code>{executionShareUrl(executionId)}</code>
        <button className="link" onClick={() => navigator.clipboard?.writeText(executionShareUrl(executionId))}>
          공유 링크 복사
        </button>
      </div>

      {inputsEntry?.values && Object.keys(inputsEntry.values).length > 0 ? (
        <div className="exec-inputs">
          <div className="exec-inputs-title">입력값</div>
          <table className="result-table kv">
            <tbody>
              {Object.entries(inputsEntry.values).map(([k, v]) => (
                <tr key={k}>
                  <th>
                    {inputLabels.get(k) ?? k} <code className="field-key">{k}</code>
                  </th>
                  <td>{cell(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="step-list">
        {stepEntries.map((entry, i) => {
          const step = stepFor(entry);
          const meta = step
            ? stepTypeMeta(step, (id) => {
                const w = wfById.get(id);
                return w ? { domain: w.domain, task: w.task, name: w.name } : undefined;
              })
            : undefined;
          return (
            <StepCard
              key={`${entry.step_id}-${i}`}
              step={{ id: entry.step_id, order: i + 1, name: step?.name ?? entry.step_id }}
              state={toStepState(entry)}
              resultView={step?.resultView}
              typeLabel={meta?.typeLabel}
              category={meta?.category}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * 업무 화면 하단의 최근 이력 — 이 업무(도메인/업무)의 실행만 최신순으로 나열하고,
 * 작업(워크플로우)별 필터 칩을 제공한다.
 */
export function TaskRecentHistory({ domain, task, workflows, onOpen, limit = 20 }) {
  const [execs, setExecs] = useState(null);
  const [error, setError] = useState(null);
  const [filterWf, setFilterWf] = useState(null); // null = 전체

  useEffect(() => {
    let alive = true;
    setFilterWf(null);
    api
      .listExecutions()
      .then((e) => alive && setExecs(e))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [domain, task]);

  const wfById = useMemo(() => new Map(workflows.map((w) => [w.id, w])), [workflows]);

  if (error) return <div className="error-banner">{error}</div>;

  // 이 업무의 실행만 (workflows가 이미 도메인/업무로 걸러져 있으므로 id 매칭으로 충분)
  const rows = (execs ?? [])
    .filter((e) => e.workflow_id && wfById.has(e.workflow_id))
    .filter((e) => !filterWf || e.workflow_id === filterWf)
    .slice(0, limit);

  return (
    <div className="task-history">
      <div className="task-history-head">
        <h3>최근 이력</h3>
        <div className="task-history-filter">
          <button className={`filter-chip ${filterWf === null ? 'active' : ''}`} onClick={() => setFilterWf(null)}>
            전체
          </button>
          {workflows.map((w) => (
            <button
              key={w.id}
              className={`filter-chip ${filterWf === w.id ? 'active' : ''}`}
              onClick={() => setFilterWf(filterWf === w.id ? null : w.id)}
            >
              {w.name}
            </button>
          ))}
        </div>
      </div>

      {!execs ? (
        <p className="muted">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="muted">{filterWf ? '이 작업의 실행 이력이 없습니다.' : '이 업무의 실행 이력이 없습니다.'}</p>
      ) : (
        <ul className="exec-list">
          {rows.map((e) => (
            <li key={e.execution_id}>
              <button className="exec-row" onClick={() => onOpen(e.execution_id)}>
                <span className="exec-crumb">
                  <span className="exec-wf">{wfById.get(e.workflow_id)?.name ?? '(삭제된 워크플로우)'}</span>
                </span>
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
      )}
    </div>
  );
}
