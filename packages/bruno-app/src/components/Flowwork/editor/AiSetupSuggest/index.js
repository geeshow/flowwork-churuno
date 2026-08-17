import React from 'react';
import IconSparkles from 'components/Icons/IconSparkles';

import { inputsFromSuggestion, suggestSetup } from '../../ai';
import AiProgress from '../AiProgress';
import useAiSuggestion from '../useAiSuggestion';

const INPUT_KIND_LABEL = {
  MANUAL: '직접 입력',
  API_COMBO: 'API 콤보',
  DEPENDENT_LOOKUP: '의존 조회',
  DEPENDENT_COMBO: '의존 콤보'
};

const entryPath = (entry) => `${entry.department} > ${[...entry.itemPath, entry.name].join(' > ')}`;

/** 받아 온 초안 — 제안이 있을 때만 그려지므로 여기서는 값이 있다고 보고 읽는다. */
function SetupCard({ suggestion, onApply, onClose }) {
  const apply = () => {
    onApply({
      name: suggestion.name,
      description: suggestion.description,
      baseInputs: inputsFromSuggestion(suggestion.inputs)
    });
    onClose();
  };

  return (
    <div className="ai-suggest-card">
      <dl className="ai-suggest-fields">
        <dt>이름</dt>
        <dd>{suggestion.name || '—'}</dd>
        <dt>설명</dt>
        <dd>{suggestion.description || '—'}</dd>
      </dl>

      <h4>입력값 {suggestion.inputs.length}개</h4>
      {suggestion.inputs.length === 0 ? (
        <p className="muted">시작할 때 받을 값이 없다고 봅니다.</p>
      ) : (
        <ul className="ai-suggest-list">
          {suggestion.inputs.map((input) => (
            <li key={input.key}>
              <code>{input.key}</code> <b>{input.label}</b>
              <span className="ai-tag">{INPUT_KIND_LABEL[input.kind] ?? '직접 입력'}</span>
              {input.entry ? <span className="muted hint"> {entryPath(input.entry)}</span> : null}
              {input.why ? <div className="muted hint">{input.why}</div> : null}
            </li>
          ))}
        </ul>
      )}

      {suggestion.apis.length > 0 ? (
        <>
          <h4>쓸 만한 API</h4>
          <ul className="ai-suggest-list">
            {suggestion.apis.map(({ entry, why }) => (
              <li key={entry.id}>
                {entryPath(entry)}
                {why ? <div className="muted hint">{why}</div> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {suggestion.reason ? <p className="muted hint">{suggestion.reason}</p> : null}

      <div className="ai-suggest-actions">
        <button className="link" onClick={onClose}>
          닫기
        </button>
        <button className="primary small" onClick={apply}>
          적용
        </button>
      </div>
    </div>
  );
}

/**
 * 지금까지 적어 둔 작업(위치·이름·설명)을 읽고 무엇을 입력받아야 하는지 물어보는 자리.
 * 모델이 API·비슷한 작업을 되물어 확인해 가며 답하므로, 그 과정을 그대로 보여 준다.
 */
export function AiSetupSuggest({ workflow, entries, workflows, envKeys, getWorkflow, onApply }) {
  const { loading, error, result, progress, run, clear } = useAiSuggestion();
  const ready = workflow.name.trim().length > 0;

  return (
    <div className="ai-suggest">
      <div className="ai-suggest-bar">
        <button
          className="small"
          disabled={!ready || loading}
          onClick={() =>
            run((onProgress) => suggestSetup({ workflow, entries, workflows, envKeys, getWorkflow, onProgress }))}
          title="작업 위치·이름·설명을 읽고, API를 확인해 가며 입력값을 제안합니다 — 적용 전에 고칠 수 있습니다"
        >
          <IconSparkles size={14} strokeWidth={1.5} />
          {loading ? '알아보는 중…' : 'AI 추천'}
        </button>
        <span className="muted hint">
          {ready ? '위치·이름·설명을 읽고 입력값을 제안합니다' : '이름을 먼저 입력하면 입력값을 제안합니다'}
        </span>
      </div>

      <AiProgress lines={progress} loading={loading} />

      {error ? <div className="error-banner">{error}</div> : null}

      {result ? <SetupCard suggestion={result} onApply={onApply} onClose={clear} /> : null}
    </div>
  );
}

export default AiSetupSuggest;
