import React from 'react';

const KIND_LABEL = {
  MANUAL: '직접 입력',
  API_COMBO: 'API 콤보',
  DEPENDENT_LOOKUP: '의존 조회',
  DEPENDENT_COMBO: '의존 콤보'
};

const entryPath = (entry) => `${entry.department} > ${[...entry.itemPath, entry.name].join(' > ')}`;

/** AI가 제안한 기본 입력값 — 어떤 방식으로 받고, 어느 API에 기대는지까지 한 줄에. */
export function AiInputRows({ inputs }) {
  return inputs.map((input) => (
    <li key={input.key}>
      <code>{input.key}</code> <b>{input.label}</b>
      <span className="ai-tag">{KIND_LABEL[input.kind] ?? '직접 입력'}</span>
      {input.entry ? <span className="muted hint"> {entryPath(input.entry)}</span> : null}
      {input.why ? <div className="muted hint">{input.why}</div> : null}
    </li>
  ));
}

export default AiInputRows;
