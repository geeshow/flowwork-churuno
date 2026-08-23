import React from 'react';
import IconSparkles from 'components/Icons/IconSparkles';

import { PURPOSES, suggestApis } from '../../../ai/wizard';
import { colorForDomain } from '../../../domainPalette';
import useAiSuggestion from '../../useAiSuggestion';
import ApiFinder from '../ApiFinder';
import PickRow, { entryPath, workflowPath } from '../PickRow';

/** 추천 결과 — 받아 왔을 때만 그려지므로 여기서는 값이 있다고 보고 읽는다. */
function Suggested({ result, picked, onToggle, domainColors }) {
  return (
    <>
      <div className="pick-keywords">
        <span className="muted hint">찾은 낱말</span>
        {result.keywords.map((word) => (
          <span key={word} className="ai-tag">
            {word}
          </span>
        ))}
      </div>

      {result.apis.length === 0 ? (
        <p className="muted">걸리는 API가 없습니다. 아래에서 직접 찾으세요.</p>
      ) : (
        <ul className="ai-suggest-list">
          {result.apis.map(({ entry, hits, where }) => (
            <PickRow
              key={entry.id}
              checked={picked.apis.includes(entry.id)}
              onToggle={() => onToggle('apis', entry.id)}
              title={entryPath(entry)}
              subtitle={`${where.join('·')}에 걸림`}
              kindLabel="API"
              tags={hits}
            />
          ))}
        </ul>
      )}

      {result.workflows.length > 0 ? (
        <>
          <h4>비슷한 업무 ({result.workflows.length})</h4>
          <p className="muted hint">통째로 불러 쓰거나, 짜는 본보기로 삼습니다.</p>
          <ul className="ai-suggest-list">
            {result.workflows.map(({ workflow, hits }) => (
              <PickRow
                key={workflow.id}
                checked={picked.workflows.includes(workflow.id)}
                onToggle={() => onToggle('workflows', workflow.id)}
                title={workflowPath(workflow)}
                subtitle={workflow.description}
                kindLabel="업무"
                kindColor={colorForDomain(workflow.domain.normalize('NFC'), domainColors)}
                tags={hits}
              />
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

/**
 * 이 작업에 꼭 쓸 API를 고르는 자리. 찾는 길이 둘이다 — 직접 검색하거나, 이름·설명을
 * 읽고 골라 오게 하거나. 둘 다 같은 목록에 체크로 쌓인다.
 */
export function ApiPicker({
  workflow,
  entries,
  workflows,
  picked,
  onChange,
  envKeys,
  purpose,
  onPurposeChange,
  requirement,
  onRequirementChange,
  domainColors
}) {
  const suggesting = useAiSuggestion();

  const toggle = (kind, id) => {
    const list = picked[kind];
    onChange({ ...picked, [kind]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
  };

  return (
    <div className="ai-wizard-pick">
      <div className="ai-suggest-bar">
        <button className="small" disabled={suggesting.loading} onClick={() => suggesting.run(() => suggestApis(workflow, entries, workflows))}>
          <IconSparkles size={14} strokeWidth={1.5} />
          {suggesting.loading ? '찾는 중…' : 'AI 추천'}
        </button>
        <span className="muted hint">이름·설명을 읽고 관련 API를 골라 옵니다</span>
      </div>

      {suggesting.error ? <div className="error-banner">{suggesting.error}</div> : null}
      {suggesting.result?.error ? (
        <p className="muted hint">{suggesting.result.error} — 적어 둔 글에서 낱말을 뽑았습니다.</p>
      ) : null}
      {suggesting.result ? (
        <Suggested result={suggesting.result} picked={picked} onToggle={toggle} domainColors={domainColors} />
      ) : null}

      <ApiFinder
        entries={entries}
        workflows={workflows}
        envKeys={envKeys}
        picked={picked}
        onChange={onChange}
        domainColors={domainColors}
      />

      <h4>이 작업이 하려는 일</h4>
      {PURPOSES.map((p) => (
        <label key={p.id} className="purpose-row">
          <input type="radio" checked={purpose === p.id} onChange={() => onPurposeChange(p.id)} />
          <b>{p.label}</b>
          <span className="muted hint">{p.hint}</span>
        </label>
      ))}

      {/* 고른 재료만으로는 말할 수 없는 것 — 순서, 걸러 낼 조건, 넣지 말아야 할 것 */}
      <label className="field wide">
        <span className="field-label">
          요구사항 <span className="hint">(선택 — 짜임새나 조건을 미리 일러둘 수 있습니다)</span>
        </span>
        <textarea
          rows={2}
          value={requirement}
          placeholder="예: 상태가 DORMANT인 계좌만 폐쇄하고, 나머지는 건드리지 마세요"
          onChange={(e) => onRequirementChange(e.target.value)}
        />
      </label>
    </div>
  );
}

export default ApiPicker;
