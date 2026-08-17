import { resolveValue } from './resolver';

/**
 * 조건이 보는 값의 출처. 예전 파일은 이전 스텝 응답만 볼 수 있어
 * {sourceStepId, jsonPath}로 적혀 있다 — 읽을 때 지금 형태로 올려준다.
 */
export function conditionSource(condition) {
  return condition.source ?? {
    kind: 'PREV_RESPONSE',
    stepId: condition.sourceStepId ?? '',
    jsonPath: condition.jsonPath ?? '$'
  };
}

/**
 * 스텝의 분기 조건을 평가한다.
 *
 * - 조건이 없으면 항상 실행(true)
 * - 조건이 있으면 지정한 값(이전 응답·입력값·환경변수·반복 항목)을 연산자로 비교
 * - 값을 구할 수 없으면(아직 실행되지 않은 스텝 등) 값이 없는 것으로 본다
 */
export function evaluateBranchCondition(step, ctx) {
  const condition = step.branchCondition;
  if (!condition) return true;

  let actual;
  try {
    actual = resolveValue(conditionSource(condition), ctx);
  } catch (_error) {
    actual = undefined;
  }
  return compare(actual, condition);
}

function compare(actual, cond) {
  const { operator, compareValue } = cond;
  switch (operator) {
    case 'EXISTS':
      return actual !== undefined && actual !== null;
    case 'NOT_EXISTS':
      return actual === undefined || actual === null;
    case 'EQ':
      return actual === compareValue;
    case 'NE':
      return actual !== compareValue;
    case 'GT':
      return numeric(actual, compareValue, (a, b) => a > b);
    case 'GTE':
      return numeric(actual, compareValue, (a, b) => a >= b);
    case 'LT':
      return numeric(actual, compareValue, (a, b) => a < b);
    case 'LTE':
      return numeric(actual, compareValue, (a, b) => a <= b);
    case 'CONTAINS':
      if (Array.isArray(actual)) return actual.includes(compareValue);
      return typeof actual === 'string' && String(compareValue) !== ''
        ? actual.includes(String(compareValue))
        : false;
    default:
      return false;
  }
}

// 숫자가 아닌 값(응답의 "12" 같은 문자열)도 비교되도록 수를 맞춰 본다
function numeric(actual, compareValue, test) {
  if (typeof actual === 'number' && typeof compareValue === 'number') return test(actual, compareValue);
  return test(Number(actual), Number(compareValue));
}
