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

  // 받아 온 것을 그대로 돌려준다 — 다음 단계로 넘어가야 하는 쪽(마법사)이 기다릴 수 있게.
  // 실패는 상태로만 알리고 여기서는 null이 되므로, 부르는 쪽이 따로 catch하지 않아도 된다.
  const run = (request) => {
    setState({ ...IDLE, loading: true });
    const report = (step) => setState((prev) => ({ ...prev, progress: [...prev.progress, step] }));
    return Promise.resolve()
      .then(() => request(report))
      .then(
        (result) => {
          setState((prev) => ({ ...prev, loading: false, result }));
          return result;
        },
        (e) => {
          setState((prev) => ({ ...prev, loading: false, error: e.message }));
          return null;
        }
      );
  };

  const clear = () => setState(IDLE);

  return { ...state, run, clear };
}

export default useAiSuggestion;
