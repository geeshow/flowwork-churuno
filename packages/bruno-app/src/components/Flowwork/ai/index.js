/**
 * 워크플로우를 짤 때 옆에서 거드는 AI — 작업(위치·이름·설명)을 읽고 무엇을 입력받을지
 * 제안하고(제안 1), 그다음 어떤 스텝을 이어 갈지 제안한다(제안 2).
 * 처음부터 통째로 짜는 길은 ./wizard에 따로 있다.
 *
 * 한 번에 답하게 하지 않는다. 처음에는 이름 목록만 주고, 모델이 필요한 것을 스스로
 * 물어보게 한다(api_detail·workflow_detail·env_keys…) — 무엇을 근거로 골랐는지 남고,
 * 그 API가 실제로 무슨 변수를 받는지 확인한 뒤에 제안하게 되기 때문이다.
 */
import { catalogLine, resolveEntry, section, workflowLine } from './catalog';
import { converse, toolbox } from './converse';
import { inputNodes, planNodes } from './plan';

export { inputsFromSuggestion, stepsFromPlan } from './plan';

// 첫 차례에 주는 본보기 — 무엇을 어떤 차례로 물어야 하는지 짧게 보여 준다
const FEW_SHOT = `## 물어보는 본보기 (형식만 참고하세요)
차례 1 → {"thought":"휴면 계좌를 다루니 계좌 쪽 API와 비슷한 작업을 먼저 본다","ask":[{"tool":"api_search","arg":"계좌"},{"tool":"workflow_search","arg":"폐쇄"}]}
답    → core/계좌/계좌 목록 조회 (보안ID) … / 계좌/폐쇄/계좌 강제 폐쇄 (account_force_close) …
차례 2 → {"thought":"폐쇄 API가 무엇을 받는지, 비슷한 작업이 무엇을 입력받는지 확인","ask":[{"tool":"api_detail","arg":"계좌 폐쇄"},{"tool":"workflow_detail","arg":"account_force_close"},{"tool":"env_keys"}]}
답    → 변수: authToken, coreBaseUrl, accountNo, reason … / 입력값: app_user_id … / 환경: authToken, coreBaseUrl
차례 3 → {"answer": {…}, "reason":"…"}`;

// -- 제안 1: 이름·설명·입력값 ------------------------------------------------

const SETUP_SCHEMA = `{
  "name": "휴면 계좌 폐쇄",
  "description": "한 줄 설명",
  "baseInputs": [
    {"key": "app_user_id", "label": "앱 사용자 ID", "kind": "MANUAL", "valueType": "string", "why": "왜 필요한지 한 줄"},
    {"key": "sec_user_id", "label": "보안 사용자 ID", "kind": "DEPENDENT_LOOKUP", "dependsOnKey": "app_user_id",
     "api": {"department": "core", "itemPath": ["사용자"], "name": "사용자 정보 조회 (앱ID)"},
     "valueField": "sec_user_id", "displayFields": ["name", "sec_user_id"], "why": "..."}
  ],
  "apis": [{"department": "core", "itemPath": ["계좌"], "name": "계좌 목록 조회 (보안ID)", "why": "..."}]
}`;

/**
 * 지금까지 적어 둔 작업(위치·이름·설명)을 읽고, 어디에 두고 무엇이라 부르고 시작할 때
 * 무엇을 받아야 하는지 제안한다. 입력값의 근거는 모델이 물어 확인한 API의 변수 목록이다.
 */
export async function suggestSetup({ workflow, entries, workflows, envKeys, getWorkflow, onProgress }) {
  const intro = [
    section('지금 짜고 있는 작업', [
      `위치: ${workflow.domain || '(아직 없음)'} / ${workflow.task || '(아직 없음)'}`,
      `이름: ${workflow.name || '(아직 없음)'}`,
      `설명: ${workflow.description || '(아직 없음)'}`,
      `이미 적어 둔 입력값: ${workflow.baseInputs.map((i) => i.key).join(', ') || '없음'}`
    ]),
    section('이미 있는 작업 (이름만 — 자세한 건 workflow_detail로)', workflows.map(workflowLine)),
    section('쓸 수 있는 API (이름만 — 변수·출력은 api_detail로)', entries.map(catalogLine)),
    `## 할 일
이 작업을 무엇이라 부르고, 시작할 때 무엇을 입력받아야 하는지 제안하세요.
위치(도메인/업무)는 이미 정해져 있습니다 — 바꾸려 하지 말고, 그 자리에 어울리게 제안하세요.
- baseInputs는 쓸 API의 변수 중 "사람이 넣어야 하는 것"만 고릅니다. 환경 변수로 채워지는 값이나
  앞 스텝의 응답에서 나오는 값은 넣지 마세요 — 어느 쪽인지 env_keys·api_detail로 확인하세요.
- 앞 입력값으로 조회해 채울 수 있는 값이면 kind를 DEPENDENT_LOOKUP(확인용) 또는
  DEPENDENT_COMBO(목록에서 고르기)로 하고 dependsOnKey와 api를 함께 적습니다.
  목록에서 바로 고르는 값이면 API_COMBO에 api를 적습니다. 그 밖에는 MANUAL입니다.
- apis에는 이 작업에서 쓸 만한 API를 실행 순서대로 적습니다 (위 목록에 있는 것만).

## answer 형식
${SETUP_SCHEMA}
valueType은 string·number·password 중 하나입니다.`,
    FEW_SHOT
  ].join('\n\n');

  const { answer, reason, asked } = await converse({
    intro,
    tools: toolbox({ entries, workflows, envKeys, getWorkflow }),
    onProgress
  });

  return {
    name: String(answer.name ?? '').trim(),
    description: String(answer.description ?? '').trim(),
    inputs: inputNodes(answer.baseInputs, entries),
    apis: (Array.isArray(answer.apis) ? answer.apis : []).flatMap((ref) => {
      const entry = resolveEntry(entries, ref);
      return entry ? [{ entry, why: String(ref.why ?? '').trim() }] : [];
    }),
    reason,
    rounds: asked.length
  };
}

// -- 제안 2: 스텝 과정 -------------------------------------------------------

const STEPS_SCHEMA = `{
  "steps": [
    {"ref": "s1", "kind": "API", "name": "사용자 정보 조회",
     "api": {"department": "core", "itemPath": ["사용자"], "name": "사용자 정보 조회 (앱ID)"},
     "bindings": {"app_user_id": {"kind": "USER_INPUT", "inputKey": "app_user_id"}},
     "why": "왜 이 스텝이 필요한지 한 줄"},
    {"ref": "s2", "kind": "REPEAT", "name": "계좌마다",
     "repeat": {"kind": "LIST", "sourceRef": "s1", "itemsPath": "$.data", "maxIterations": 10},
     "children": [
       {"ref": "s3", "kind": "API", "name": "소유자 확인", "api": {"department": "core", "itemPath": ["사용자"], "name": "사용자 정보 조회"},
        "bindings": {"CIF": {"kind": "LOOP_ITEM", "itemPath": "$.owner.cif"}}, "why": "..."}
     ], "why": "..."},
    {"ref": "s4", "kind": "BRANCH", "name": "활성일 때",
     "condition": {"source": {"kind": "PREV_RESPONSE", "stepRef": "s1", "jsonPath": "$.data.status"},
                   "operator": "EQ", "compareValue": "ACTIVE"},
     "children": [], "why": "..."},
    {"ref": "s5", "kind": "DELAY", "name": "2초 대기", "seconds": 2, "why": "..."},
    {"ref": "s6", "kind": "WORKFLOW", "name": "매도", "workflowId": "sell",
     "inputs": {"accountNo": {"kind": "USER_INPUT", "inputKey": "accountNo"}}, "why": "..."}
  ]
}`;

/**
 * 지금까지 정한 위치·이름·설명·입력값을 바탕으로 이어 갈 스텝을 제안한다.
 * 반복·분기는 children으로 감싸 오게 하고, 앞 스텝 참조는 모델이 붙인 ref로 받는다
 * (번호로 받으면 스텝이 늘 때마다 어긋난다).
 */
export async function suggestSteps({ workflow, entries, workflows, envKeys, getWorkflow, onProgress }) {
  const intro = [
    section('지금 짜고 있는 작업', [
      `위치: ${workflow.domain} / ${workflow.task}`,
      `이름: ${workflow.name}`,
      `설명: ${workflow.description || '(없음)'}`,
      `시작할 때 받는 입력값: ${workflow.baseInputs.map((i) => `${i.key}(${i.label || i.key})`).join(', ') || '없음'}`,
      `이미 짜 둔 스텝: ${workflow.steps.map((s) => s.name || '(이름 없음)').join(' → ') || '없음'}`
    ]),
    section('쓸 수 있는 API (이름만 — 변수·출력은 api_detail로)', entries.map(catalogLine)),
    section(
      '통째로 불러 쓸 수 있는 다른 작업 (자세한 건 workflow_detail로)',
      workflows.filter((w) => w.id !== workflow.id).map(workflowLine)
    ),
    `## 할 일
이 작업이 이어서 실행할 스텝을 순서대로 제안하세요 (이미 짜 둔 스텝 뒤에 붙습니다).
- 스텝에 넣을 API는 반드시 api_detail로 변수·출력을 확인한 뒤에 고르세요.
- 앞 스텝의 응답에서 나오는 값은 PREV_RESPONSE로, 시작 입력값은 USER_INPUT으로 잇습니다.
  jsonPath는 그 API가 실제로 내놓는 출력 필드여야 합니다.
- 목록을 하나씩 처리해야 하면 REPEAT 블록으로 감싸고, 그 안에서는 LOOP_ITEM으로 그 회차의
  항목을 참조합니다. 조건에 따라 갈리면 BRANCH 블록으로 감쌉니다.
- 이미 같은 일을 하는 작업이 있으면 스텝을 새로 짜지 말고 WORKFLOW로 불러 씁니다.
- 5개 안팎으로, 실제로 필요한 것만 제안하세요.

## answer 형식
${STEPS_SCHEMA}
값의 출처(kind)는 USER_INPUT(inputKey) · PREV_RESPONSE(stepRef, jsonPath) · LOOP_ITEM(itemPath) ·
ENV(envKey) · FIXED(value) 중 하나입니다. 연산자는 EQ·NE·GT·GTE·LT·LTE·EXISTS·NOT_EXISTS·CONTAINS입니다.`,
    FEW_SHOT
  ].join('\n\n');

  const { answer, reason, asked } = await converse({
    intro,
    tools: toolbox({ entries, workflows, envKeys, getWorkflow }),
    onProgress
  });

  const known = new Set(workflows.map((w) => w.id));
  return {
    plan: planNodes(Array.isArray(answer.steps) ? answer.steps : [], entries, known),
    reason,
    rounds: asked.length
  };
}
