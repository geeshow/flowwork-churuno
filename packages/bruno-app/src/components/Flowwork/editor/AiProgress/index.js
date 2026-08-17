import React from 'react';

/**
 * 제안을 내기까지 모델이 무엇을 되물어 확인했는지 — 기다리는 동안에는 진행 상황으로,
 * 제안이 나온 뒤에는 무엇을 근거로 삼았는지 되짚는 자취로 남는다.
 */
export function AiProgress({ lines, loading }) {
  if (lines.length === 0 && !loading) return null;

  return (
    <ol className="ai-progress">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
      {loading ? <li className="muted">…</li> : null}
    </ol>
  );
}

export default AiProgress;
