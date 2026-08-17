import { useState } from 'react';

const IDLE = { loading: false, error: null, result: null, progress: [] };

/**
 * AI 제안 한 건의 상태 — 요청 중인지, 무엇을 물어보고 있는지(progress), 무엇을 받았는지.
 * 제안은 받아 두기만 하고 적용은 부르는 쪽이 한다.
 *
 * 한 번 제안에 모델이 몇 차례 되물으므로, 그 사이 무엇을 확인하는 중인지 progress로 남긴다
 * — 수십 초 기다리는 동안 화면이 멈춘 것처럼 보이지 않게.
 */
export function useAiSuggestion() {
  const [state, setState] = useState(IDLE);

  const run = (request) => {
    setState({ ...IDLE, loading: true });
    const report = (line) => setState((prev) => ({ ...prev, progress: [...prev.progress, line] }));
    Promise.resolve()
      .then(() => request(report))
      .then((result) => setState((prev) => ({ ...prev, loading: false, result })))
      .catch((e) => setState((prev) => ({ ...prev, loading: false, error: e.message })));
  };

  const clear = () => setState(IDLE);

  return { ...state, run, clear };
}

export default useAiSuggestion;
