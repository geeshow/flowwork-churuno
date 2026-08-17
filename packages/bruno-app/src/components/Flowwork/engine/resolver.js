import { JSONPath } from 'jsonpath-plus';

/**
 * ValueSource 한 개를 실제 값으로 리졸브한다.
 *
 * ctx = { userInputs, env, stepResponses(Map), loopItem }
 * loopItem은 반복 스텝이 도는 동안에만 있다 (그 회차의 항목).
 *
 * API_COMBO / DEPENDENT_LOOKUP은 실행 시점엔 이미 UI에서 값이 확정돼 있으므로
 * 실행 엔진 입장에선 USER_INPUT과 동일하게 취급된다. 입력 타입 분기는
 * UI 레이어에만 존재하고 실행 코어는 오염되지 않는다.
 */
export function resolveValue(source, ctx) {
  switch (source.kind) {
    case 'FIXED':
      return source.value;
    case 'USER_INPUT':
      return ctx.userInputs[source.inputKey] ?? null;
    case 'ENV':
      return ctx.env[source.envKey] ?? null;
    case 'PREV_RESPONSE': {
      const body = ctx.stepResponses.get(source.stepId);
      if (body === undefined) {
        throw new Error(`이전 단계(${source.stepId})의 응답이 없습니다.`);
      }
      const result = JSONPath({ path: source.jsonPath, json: body, wrap: false });
      return result ?? null;
    }
    case 'LOOP_ITEM': {
      if (ctx.loopItem === undefined) {
        throw new Error('반복 스텝이 아닌 곳에서 반복 항목을 참조했습니다.');
      }
      const path = source.itemPath || '$';
      // 항목이 문자열·숫자면 통째로 쓴다 (목록이 값의 배열인 경우)
      if (path === '$') return ctx.loopItem ?? null;
      const result = JSONPath({ path, json: ctx.loopItem, wrap: false });
      return result ?? null;
    }
    default:
      throw new Error(`알 수 없는 값 소스입니다: ${source.kind}`);
  }
}
