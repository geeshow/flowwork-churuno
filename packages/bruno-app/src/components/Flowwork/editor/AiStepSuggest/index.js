import React from 'react';
import IconSparkles from 'components/Icons/IconSparkles';

import { stepsFromPlan, suggestSteps } from '../../ai';
import AiPlanRows from '../AiPlanRows';
import AiProgress from '../AiProgress';
import useAiSuggestion from '../useAiSuggestion';

/** 받아 온 과정 — 제안이 있을 때만 그려지므로 여기서는 값이 있다고 보고 읽는다. */
function PlanCard({ suggestion, envKeys, onApply, onClose }) {
  const apply = () => {
    onApply(stepsFromPlan(suggestion.plan, envKeys));
    onClose();
  };

  return (
    <div className="ai-suggest-card">
      {suggestion.plan.length === 0 ? (
        <p className="muted">제안할 스텝을 찾지 못했습니다. 이름·설명을 조금 더 적고 다시 시도해 보세요.</p>
      ) : (
        <ul className="ai-suggest-list">
          <AiPlanRows plan={suggestion.plan} />
        </ul>
      )}
      {suggestion.reason ? <p className="muted hint">{suggestion.reason}</p> : null}

      <div className="ai-suggest-actions">
        <button className="link" onClick={onClose}>
          닫기
        </button>
        <button className="primary small" onClick={apply} disabled={suggestion.plan.length === 0}>
          스텝으로 추가
        </button>
      </div>
    </div>
  );
}

/**
 * 스텝을 어떻게 이어 갈지 물어보는 자리. 지금까지 정한 이름·설명·입력값과 API 카탈로그를
 * 읽어 과정을 제안하고, 적용하면 이미 짜 둔 스텝 뒤에 붙는다 — 기존 스텝은 건드리지 않는다.
 */
export function AiStepSuggest({ workflow, entries, workflows, envKeys, getWorkflow, onApply }) {
  const { loading, error, result, progress, run, clear } = useAiSuggestion();

  return (
    <div className="ai-suggest">
      <div className="ai-suggest-bar">
        <button
          className="small"
          disabled={loading}
          onClick={() =>
            run((onProgress) => suggestSteps({ workflow, entries, workflows, envKeys, getWorkflow, onProgress }))}
          title="작업 내용을 읽고, API와 비슷한 작업을 확인해 가며 이어 갈 스텝을 제안합니다"
        >
          <IconSparkles size={14} strokeWidth={1.5} />
          {loading ? '알아보는 중…' : 'AI 스텝 추천'}
        </button>
        <span className="muted hint">이어 갈 스텝 과정을 제안합니다</span>
      </div>

      <AiProgress steps={progress} loading={loading} />

      {error ? <div className="error-banner">{error}</div> : null}

      {result ? <PlanCard suggestion={result} envKeys={envKeys} onApply={onApply} onClose={clear} /> : null}
    </div>
  );
}

export default AiStepSuggest;
