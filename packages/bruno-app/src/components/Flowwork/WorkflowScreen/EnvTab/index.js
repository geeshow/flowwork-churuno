import React, { useEffect, useMemo, useState } from 'react';

import api from '../../api';

/** 이 작업이 실제로 참조하는 환경변수 키 — 목록에서 먼저 보여준다 */
const usedKeys = (workflow) => {
  const keys = new Set();
  for (const step of workflow.steps) {
    for (const source of Object.values(step.apiBinding?.variableBindings ?? {})) {
      if (source?.kind === 'ENV' && source.envKey) keys.add(source.envKey);
    }
  }
  return keys;
};

/**
 * 환경변수 — 실행 시 {{변수}} 자리에 채워지는 값들. 값은 서버(main 기준)가 주는
 * 그대로 읽기 전용으로 보여준다.
 */
export function EnvTab({ workflow }) {
  const [env, setEnv] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .getEnvironments()
      .then((e) => alive && setEnv(e))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const used = useMemo(() => usedKeys(workflow), [workflow]);
  const rows = useMemo(() => {
    if (!env) return [];
    return Object.entries(env).sort(([a], [b]) => {
      const byUse = Number(used.has(b)) - Number(used.has(a));
      return byUse || a.localeCompare(b);
    });
  }, [env, used]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!env) return <p className="muted">불러오는 중…</p>;
  if (rows.length === 0) return <p className="muted">등록된 환경변수가 없습니다.</p>;

  return (
    <div className="wf-env">
      <p className="muted">
        실행할 때 <code>{'{{변수}}'}</code>에 채워지는 값입니다. 이 작업이 쓰는 변수에는 표시가 붙습니다.
      </p>
      <table className="result-table kv">
        <tbody>
          {rows.map(([key, value]) => (
            <tr key={key} className={used.has(key) ? 'env-used' : ''}>
              <th>
                <code className="field-key">{key}</code>
                {used.has(key) ? <span className="env-used-chip">사용</span> : null}
              </th>
              <td>{String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default EnvTab;
