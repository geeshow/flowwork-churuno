import React from 'react';

const KIND_LABEL = {
  API: 'API 호출',
  WORKFLOW: '업무 연결',
  DELAY: '지연',
  REPEAT: '반복',
  BRANCH: '분기'
};

const detailOf = (node) => {
  switch (node.kind) {
    case 'API':
      return node.entry ? `${node.entry.department} > ${node.entry.itemPath.join(' > ')}` : '';
    case 'WORKFLOW':
      return node.linkedId;
    case 'DELAY':
      return `${Number(node.seconds) || 1}초`;
    case 'REPEAT':
      return node.repeat?.kind === 'COUNT' ? `${node.repeat.count}회` : '목록마다';
    case 'BRANCH':
      return `${node.condition?.operator ?? 'EQ'} ${node.condition?.compareValue ?? ''}`.trim();
    default:
      return '';
  }
};

/**
 * AI가 짠 스텝 계획을 사람이 읽는 줄로 — 반복·분기 안에 든 스텝은 편집기와 같은
 * 들여쓰기로 보여 준다. 카탈로그에서 찾지 못한 참조는 경고를 달아 넘긴다.
 */
export function AiPlanRows({ plan, depth = 0 }) {
  return plan.map((node) => (
    <React.Fragment key={node.ref}>
      <li style={{ marginLeft: depth * 16 }}>
        <span className="ai-tag">{KIND_LABEL[node.kind]}</span>
        <b>{node.name}</b>
        {detailOf(node) ? <span className="muted hint"> {detailOf(node)}</span> : null}
        {node.missing ? <span className="ai-tag warn">카탈로그에 없음 — 직접 고르세요</span> : null}
        {node.why ? <div className="muted hint">{node.why}</div> : null}
      </li>
      <AiPlanRows plan={node.children} depth={depth + 1} />
    </React.Fragment>
  ));
}

export default AiPlanRows;
