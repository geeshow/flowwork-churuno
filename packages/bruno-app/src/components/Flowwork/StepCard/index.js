import React, { useState } from 'react';

import { conditionSource } from '../engine/branch';
import ResultTable from '../ResultTable';

/**
 * 스텝 종류 배지/분류 계산.
 *  - API 스텝: "API" + "부서 > 폴더" (카탈로그 분류)
 *  - 연결업무 스텝: "연결업무" + "도메인 > 업무 > 업무명" (연결된 워크플로우)
 *  - 지연 스텝: "지연" + "N초 대기"
 */
export function stepTypeMeta(step, resolveWorkflow) {
  if (step.delayBinding) {
    return { typeLabel: '지연', category: `${step.delayBinding.seconds ?? 0}초 대기` };
  }
  if (step.workflowBinding) {
    const w = resolveWorkflow?.(step.workflowBinding.ref.id);
    return { typeLabel: '연결업무', category: w ? `${w.domain} > ${w.task} > ${w.name}` : '' };
  }
  const ce = step.apiBinding?.catalogEntry;
  return { typeLabel: 'API', category: ce ? [ce.department, ...ce.itemPath].join(' > ') : '' };
}

/** 종류 배지의 색 구분 — 배지를 그리는 모든 화면이 같은 규칙을 쓴다. */
export const stepBadgeClass = (typeLabel) => {
  if (typeLabel === 'API') return 'api';
  return typeLabel === '지연' ? 'delay' : 'wf';
};

/**
 * 반복 스텝을 감싸는 테두리에 붙는 말 — 무엇을 기준으로 도는지.
 * 흐름도와 실행 화면이 같은 문구를 쓰도록 여기 한 곳에 둔다.
 */
export function repeatLabel(repeat, resolveStepName) {
  if (!repeat) return '';
  if (repeat.kind === 'COUNT') return `${repeat.count ?? 0}회 반복`;
  const source = resolveStepName?.(repeat.sourceStepId);
  const base = source ? `${source}의 목록마다` : '목록마다';
  return repeat.maxIterations ? `${base} · 최대 ${repeat.maxIterations}회` : base;
}

// "$.data.secUserId" → "secUserId" — 이름표에 쓸 마지막 마디
export const leafOf = (jsonPath) =>
  (jsonPath ?? '').replace(/\[\d*\]/g, '').split('.').filter(Boolean).pop() ?? '';

const OPERATOR_TEXT = {
  EQ: '=',
  NE: '≠',
  GT: '>',
  GTE: '≥',
  LT: '<',
  LTE: '≤',
  CONTAINS: '포함',
  EXISTS: '값이 있을',
  NOT_EXISTS: '값이 없을'
};
const VALUELESS_OPERATORS = new Set(['EXISTS', 'NOT_EXISTS']);

/**
 * 분기 조건을 사람이 읽는 한 줄로 — 조건별로 감싸는 테두리의 이름표에 쓴다.
 * resolve로 스텝 이름·입력값 라벨·응답 필드 라벨을 한글로 바꿔 넣을 수 있다.
 */
export function conditionLabel(condition, resolve = {}) {
  if (!condition) return '';
  const source = conditionSource(condition);
  const subject = conditionSubject(source, resolve);
  const operator = OPERATOR_TEXT[condition.operator] ?? condition.operator;
  if (VALUELESS_OPERATORS.has(condition.operator)) return `${subject} ${operator} 때만`;
  return `${subject} ${operator} ${condition.compareValue} 일 때만`;
}

function conditionSubject(source, { stepName, inputLabel, fieldLabel }) {
  switch (source.kind) {
    case 'PREV_RESPONSE': {
      const step = stepName?.(source.stepId) ?? '이전 스텝';
      return `${step}의 ${fieldLabel?.(source.stepId, source.jsonPath) ?? leafOf(source.jsonPath)}`;
    }
    case 'USER_INPUT':
      return inputLabel?.(source.inputKey) ?? source.inputKey;
    case 'ENV':
      return `환경변수 ${source.envKey}`;
    case 'LOOP_ITEM':
      return `반복 항목의 ${leafOf(source.itemPath) || '값'}`;
    default:
      return '조건';
  }
}

/** 같은 조건이 이어지는 스텝은 한 상자로 묶는다 — 조건이 같은지 가리는 열쇠. */
export const conditionKey = (condition) =>
  condition ? JSON.stringify([conditionSource(condition), condition.operator, condition.compareValue]) : '';

const STATUS_META = {
  PENDING: { icon: '○', label: '대기', cls: 'pending' },
  RUNNING: { icon: '◍', label: '실행 중', cls: 'running' },
  SUCCESS: { icon: '✓', label: '성공', cls: 'success' },
  FAILED: { icon: '✕', label: '실패', cls: 'failed' },
  SKIPPED: { icon: '⤼', label: '건너뜀', cls: 'skipped' }
};

function JsonBlock({ title, data }) {
  return (
    <div className="json-block">
      <div className="json-title">{title}</div>
      <pre>{typeof data === 'string' ? data : JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

/**
 * 스텝 카드 — 실행 상태를 색/아이콘으로 표시하고, 클릭 시 request/response 전체를
 * JSON 뷰어로 펼친다. 실행 화면과 히스토리 상세가 동일 컴포넌트를 재사용한다.
 */
export function StepCard({ step, state, resultView, typeLabel, category, outputLabels, footer }) {
  const [open, setOpen] = useState(false);
  const [rawResp, setRawResp] = useState(false);
  const status = state?.status ?? 'PENDING';
  const meta = STATUS_META[status];
  const hasDetail = state?.request || state?.response || state?.error;
  const asTable = resultView?.mode === 'TABLE';
  // 중간 입력이 뜬 동안에는 결과를 보고 선택해야 하므로 상세(응답)를 강제로 펼친다.
  const showDetail = hasDetail && (open || !!footer);

  return (
    <div className={`step-card ${meta.cls}`}>
      <button
        className="step-head"
        onClick={() => hasDetail && setOpen((v) => !v)}
        aria-expanded={showDetail}
      >
        <span className="step-order">{step.order}</span>
        <span className="step-name">
          <span className="step-name-text">
            <span className="step-name-row">
              {typeLabel ? (
                <span className={`step-type-badge ${stepBadgeClass(typeLabel)}`}>{typeLabel}</span>
              ) : null}
              <span>{step.name || `스텝 ${step.order}`}</span>
              {step.parallel ? <span className="step-flag">비동기</span> : null}
            </span>
            {category ? <span className="step-category">{category}</span> : null}
          </span>
        </span>
        {state?.iterations ? (
          <span className="step-iterations" title="반복 진행">
            {state.iteration}/{state.iterations}회
            {state.skipped ? <span> · 건너뜀 {state.skipped}</span> : null}
            {state.failures ? <span className="error-text"> · 실패 {state.failures}</span> : null}
          </span>
        ) : null}
        <span className={`step-status ${meta.cls}`}>
          <span className="step-icon">{meta.icon}</span> {meta.label}
        </span>
        {hasDetail ? <span className="chevron">{showDetail ? '▾' : '▸'}</span> : null}
      </button>

      {showDetail ? (
        <div className="step-detail">
          {state?.error ? <JsonBlock title="에러" data={state.error} /> : null}
          {state?.request ? <JsonBlock title="요청" data={state.request} /> : null}
          {state?.response !== undefined ? (
            asTable && !rawResp ? (
              <div className="json-block">
                <div className="json-title">
                  <span>응답</span>
                  <button className="link small" onClick={() => setRawResp(true)}>
                    {'{ }'} 원본
                  </button>
                </div>
                <ResultTable data={state.response} columns={resultView.columns} labels={outputLabels} />
              </div>
            ) : asTable && rawResp ? (
              <div className="json-block">
                <div className="json-title">
                  <span>응답</span>
                  <button className="link small" onClick={() => setRawResp(false)}>
                    표로 보기
                  </button>
                </div>
                <pre>{JSON.stringify(state.response, null, 2)}</pre>
              </div>
            ) : (
              <JsonBlock title="응답" data={state.response} />
            )
          ) : null}
        </div>
      ) : null}

      {footer ? <div className="step-midinput">{footer}</div> : null}
    </div>
  );
}

export default StepCard;
