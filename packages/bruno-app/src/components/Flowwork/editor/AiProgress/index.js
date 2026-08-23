import React from 'react';

/**
 * 무엇을 확인하며 답을 찾아가는 중인지 — 기다리는 동안에는 진행 상황으로, 답이 나온
 * 뒤에는 무엇을 근거로 삼았는지 되짚는 자취로 남는다.
 *
 * 한 걸음이 곧 모델 호출 한 번(수십 초)이라, 걸음마다 무엇을 봤는지 적어 두지 않으면
 * 몇 분 동안 화면이 멈춘 것처럼 보인다.
 */
export function AiProgress({ steps, loading }) {
  if (steps.length === 0 && !loading) return null;

  // 되물어 답을 받으면 그 자리에서 새 대화가 시작되어 모델 쪽 차례는 1부터 다시 센다.
  // 사람이 읽기에는 한 줄기의 분석이므로 번호는 여기서 이어 붙인다.
  let step = 0;

  return (
    <ol className="ai-progress">
      {steps.map((entry, index) => {
        if (entry.answers) {
          return (
            <li key={index}>
              <b>물어보고 답한 것</b>
              <ul>
                {entry.answers.map(({ question, answer }) => (
                  <li key={question}>
                    {question} <b>{answer}</b>
                  </li>
                ))}
              </ul>
            </li>
          );
        }
        step += 1;
        return (
          <li key={index}>
            <b>{step}단계</b>
            {entry.thought ? <span className="muted hint"> {entry.thought}</span> : null}
            <ul>
              {entry.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </li>
        );
      })}
      {loading ? <li className="muted">살펴보는 중…</li> : null}
    </ol>
  );
}

export default AiProgress;
