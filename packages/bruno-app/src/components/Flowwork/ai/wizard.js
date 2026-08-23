/**
 * 새 작업을 처음부터 짜 주는 마법사의 AI 쪽.
 *
 * - suggestApis: 위치·이름·설명만 읽고 쓸 만한 API를 골라 준다. 낱말을 뽑는 짧은 한 번은
 *   가장 싼 모델로 돌리고, 실제로 무엇이 걸리는지는 카탈로그를 직접 훑어 정한다
 *   (ai/relevance) — 그래야 줄마다 근거가 붙고, 실패해도 검색으로 이어 갈 수 있다.
 * - draftWorkflow: 고른 API에서 거꾸로 짚어 입력값과 스텝을 짠다. 이미 짜 둔 초안과
 *   고쳐 달라는 말을 함께 주면 그 자리에서 고친 초안을 낸다(개선 1, 개선 2…).
 */
import { catalogDetail, catalogLine, section, workflowLine } from './catalog';
import { askModel, converse, toolbox } from './converse';
import { inputNodes, planNodes } from './plan';
import { producersFor, rankEntries, rankWorkflows } from './relevance';

// 낱말 뽑기는 판단이 거의 없는 일이라 가장 빠르고 싼 모델로 충분하다
const KEYWORD_MODEL = 'haiku';

const KEYWORD_SYSTEM = `당신은 검색어를 뽑는 도구입니다.
주어진 업무에서 API·작업 목록을 뒤질 낱말만 뽑아 JSON 하나로 답합니다.
{"keywords": ["계좌", "잔액", "조회"]}

- 3~7개, 한 낱말씩. 조사·어미를 떼고 명사형으로 씁니다.
- 적힌 말과 함께, 같은 것을 가리키는 다른 말도 넣습니다 (고객↔사용자, 해지↔폐쇄).
- 설명 문장이나 코드펜스(\`\`\`)를 덧붙이지 마세요.`;

export const PURPOSES = [
  { id: 'LOOKUP', label: '조회', hint: '값을 읽어 보여 주기만 한다' },
  { id: 'SINGLE', label: '단건 처리', hint: '하나를 골라 바꾸거나 실행한다' },
  { id: 'BATCH', label: '다건 처리', hint: '목록을 훑어 여러 건을 처리한다' }
];

const PURPOSE_RULE = {
  LOOKUP: '조회만 하는 작업입니다 — 값을 바꾸는 API(POST/PUT/DELETE)는 넣지 마세요.',
  SINGLE: '한 건을 처리하는 작업입니다 — 대상을 확정한 뒤 처리하고, 상태를 확인해야 하면 BRANCH로 감쌉니다.',
  BATCH: '여러 건을 처리하는 작업입니다 — 짜임새 2번(목록 반복)을 쓰고, 목록 가운데 일부만 처리해야 하면 3번(반복 속 분기)을 씁니다.'
};

const DRAFT_SCHEMA = `{
  "name": "휴면 계좌 폐쇄",
  "description": "한 줄 설명",
  "baseInputs": [
    {"key": "app_user_id", "label": "앱 사용자 ID", "kind": "MANUAL", "valueType": "string", "why": "왜 필요한지 한 줄"},
    {"key": "sec_user_id", "label": "보안 사용자 ID", "kind": "DEPENDENT_LOOKUP", "dependsOnKey": "app_user_id",
     "api": {"department": "core", "itemPath": ["사용자"], "name": "사용자 정보 조회 (앱ID)"},
     "valueField": "sec_user_id", "displayFields": ["name", "sec_user_id"], "why": "..."}
  ],
  "steps": [
    {"ref": "s1", "kind": "API", "name": "계좌 목록 조회",
     "api": {"department": "core", "itemPath": ["계좌"], "name": "계좌 목록 조회 (보안ID)"},
     "bindings": {"sec_user_id": {"kind": "USER_INPUT", "inputKey": "sec_user_id"}}, "why": "..."},
    {"ref": "s2", "kind": "REPEAT", "name": "계좌마다",
     "repeat": {"kind": "LIST", "sourceRef": "s1", "itemsPath": "$.data", "maxIterations": 10},
     "children": [
       {"ref": "s3", "kind": "API", "name": "계좌 폐쇄",
        "api": {"department": "core", "itemPath": ["계좌"], "name": "계좌 폐쇄"},
        "bindings": {"accountNo": {"kind": "LOOP_ITEM", "itemPath": "$.accountNo"}}, "why": "..."}
     ], "why": "..."}
  ]
}`;

/**
 * 이 편집기가 실제로 만들 수 있는 짜임새들.
 *
 * 모델은 무엇을 쓸 수 있는지 모르면 아는 것만 쓴다 — 실제로 첫 시도에서는 목록 가운데
 * 일부만 고르는 일을 "가려내는 API"를 지어내 풀려 했다. 짤 수 있는 모양을 보여 주면
 * 그 자리에 분기를 쓴다. 여기 없는 모양(동시 호출·중간 입력)은 초안으로 옮길 수 없어
 * 일부러 빼 둔다 — 보여 주면 쓰려 들고, 쓰면 조용히 떨어져 나간다.
 */
const PATTERNS = `## 짤 수 있는 짜임새 (필요한 것만 골라 쓰세요)

1) 순차 조회 — 앞 스텝의 응답을 뒤에서 쓴다
   s1(사용자 정보 조회) → s2(계좌 목록 조회)
   s2의 bindings: {"sec_user_id": {"kind": "PREV_RESPONSE", "stepRef": "s1", "jsonPath": "$.sec_user_id"}}

2) 목록 반복 — 목록을 만든 스텝을 sourceRef로 잡고, 그 회차의 항목을 LOOP_ITEM으로 쓴다
   {"kind": "REPEAT", "repeat": {"kind": "LIST", "sourceRef": "s1", "itemsPath": "$.data", "maxIterations": 10},
    "children": [{"kind": "API", "bindings": {"accountNo": {"kind": "LOOP_ITEM", "itemPath": "$.accountNo"}}}]}

3) 반복 속 분기 — 목록 가운데 일부만 처리한다. 가려낼 API를 찾지 말고 그 회차 항목의 값을 조건으로 본다
   REPEAT 안에 {"kind": "BRANCH", "name": "휴면일 때만",
     "condition": {"source": {"kind": "LOOP_ITEM", "itemPath": "$.status"}, "operator": "EQ", "compareValue": "DORMANT"},
     "children": [{"kind": "API", "name": "계좌 폐쇄", …}]}

4) 조건 분기 — 앞 스텝의 응답에 따라 갈린다
   {"kind": "BRANCH", "condition": {"source": {"kind": "PREV_RESPONSE", "stepRef": "s1", "jsonPath": "$.data.status"},
     "operator": "EQ", "compareValue": "ACTIVE"}, "children": [...]}

5) 재시도·폴링 — 정해진 횟수만큼 기다렸다 다시 확인한다
   {"kind": "REPEAT", "repeat": {"kind": "COUNT", "count": 5},
    "children": [{"kind": "DELAY", "seconds": 2}, {"kind": "API", "name": "상태 확인", …}]}

6) 업무 연결 — 같은 일을 하는 작업이 이미 있으면 스텝을 새로 짜지 않는다
   {"kind": "WORKFLOW", "name": "매도", "workflowId": "sell",
    "inputs": {"accountNo": {"kind": "USER_INPUT", "inputKey": "accountNo"}}}

7) 값을 어디서 가져오는지 — 늘 같은 값은 FIXED, 실행 환경이 채우는 값은 ENV
   {"reason": {"kind": "FIXED", "value": "휴면 계좌 자동 폐쇄"}, "authToken": {"kind": "ENV", "envKey": "authToken"}}`;

const FEW_SHOT = `## 물어보는 본보기 (형식만 참고하세요)
1단계 → {"thought":"고른 API가 요구하는 값이 어디서 오는지부터 본다","ask":[{"tool":"api_detail","arg":"사용자 정보 조회 (앱ID)"},{"tool":"env_keys"}]}
답    → 변수: authToken, coreBaseUrl, app_user_id / 출력: sec_user_id, name … / 환경: authToken, coreBaseUrl
2단계 → {"answer": {…}, "reason":"app_user_id만 받으면 sec_user_id는 조회로 채울 수 있어서"}`;

const WORD_RULE = /[\s/,·]+/;

/** AI 없이 뽑는 낱말 — 낱말 뽑기가 실패해도 추천을 이어 갈 수 있게 한다. */
export function localKeywords({ domain, task, name, description }) {
  const words = [domain, ...String(task ?? '').split('/'), name, description]
    .flatMap((text) => String(text ?? '').split(WORD_RULE))
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);
  return [...new Set(words)].slice(0, 7);
}

/**
 * 위치·이름·설명만 읽고 쓸 만한 API·작업을 골라 준다.
 * 낱말은 모델이 뽑고(동의어까지), 무엇이 걸렸는지는 카탈로그를 훑어 정한다.
 */
export async function suggestApis(workflow, entries, workflows) {
  const prompt = [
    section('업무', [
      `위치: ${workflow.domain} / ${workflow.task}`,
      `이름: ${workflow.name}`,
      `설명: ${workflow.description || '(없음)'}`
    ]),
    '## 할 일\n이 업무와 관련된 API·작업을 찾을 낱말을 뽑으세요.'
  ].join('\n\n');

  const fallback = localKeywords(workflow);
  let keywords = fallback;
  let error = null;

  try {
    const reply = await askModel({ system: KEYWORD_SYSTEM, prompt, model: KEYWORD_MODEL });
    const picked = (Array.isArray(reply.keywords) ? reply.keywords : [])
      .map((word) => String(word).trim())
      .filter((word) => word.length >= 2);
    if (picked.length > 0) keywords = picked;
  } catch (e) {
    error = e.message;
  }

  return {
    keywords,
    error,
    apis: rankEntries(entries, keywords, 20, { department: workflow.domain }),
    workflows: rankWorkflows(workflows, keywords)
  };
}

const answerLines = (answers) =>
  answers.map(({ question, answer }) => `- ${question} → ${answer || '(답 없음)'}`);

const bullet = (lines) => lines.map((line) => `- ${line}`);

/** 참고 글의 머리 — 다시 확정했을 때 앞서 붙인 것을 찾아 갈아 끼우는 표식이기도 하다. */
export const DRAFT_NOTE_HEADING = '## AI로 만든 초안 (참고)';

/** 이미 붙어 있는 참고 글을 떼어 낸 문서 — 사람이 쓴 글만 남는다. */
export const withoutDraftNote = (docs) => String(docs ?? '').split(DRAFT_NOTE_HEADING)[0].trimEnd();

/**
 * 마법사가 이 작업을 어떻게 짰는지 — 저장할 때 Docs 끝에 참고로 붙인다.
 *
 * 초안은 사람이 손본 뒤 저장되므로 나중에 보면 왜 이런 모양인지 알기 어렵다. 무엇을
 * 고르고 무엇을 답했고 무엇을 고쳐 달라 했는지가 남아 있어야 다음 사람이 이어 고친다.
 */
export function draftNote({ purpose, pickedEntries, pickedWorkflows, timeline }) {
  const answers = timeline.flatMap((entry) =>
    entry.kind === 'analyze' ? entry.steps.flatMap((step) => step.answers ?? []) : []);
  const requests = timeline.flatMap((entry) => (entry.kind === 'analyze' && entry.request ? [entry.request] : []));
  const last = [...timeline].reverse().find((entry) => entry.kind === 'draft');

  return [
    DRAFT_NOTE_HEADING,
    '',
    ...bullet([
      `목적: ${PURPOSES.find((p) => p.id === purpose)?.label ?? '조회'}`,
      `고른 API: ${pickedEntries.map((e) => `${e.department}/${[...e.itemPath, e.name].join('/')}`).join(', ') || '없음'}`,
      ...(pickedWorkflows.length > 0
        ? [`고른 업무: ${pickedWorkflows.map((w) => `${w.domain}/${w.task}/${w.name}`).join(', ')}`]
        : [])
    ]),
    ...(answers.length > 0 ? ['', '### 물어보고 답한 것', ...bullet(answerLines(answers).map((l) => l.slice(2)))] : []),
    ...(requests.length > 0
      ? ['', '### 고쳐 달라고 한 것', ...requests.map((request, index) => `${index + 1}. ${request}`)]
      : []),
    ...(last?.version.draft.reason ? ['', '### AI가 밝힌 근거', last.version.draft.reason] : [])
  ].join('\n');
}

const supplyLines = (picked, entries, envKeys) =>
  producersFor(entries, picked, envKeys).map(
    ({ entry, supplies }) =>
      `${catalogLine(entry)}  ← ${[...new Set(supplies.map((s) => s.variable))].join(', ')}을(를) 내놓음`
  );

/** 이미 짜 둔 초안을 모델이 읽을 수 있는 글로 — 고칠 자리를 ref로 짚게 한다. */
function draftLines(previous) {
  const steps = (plan, depth = 0) =>
    plan.flatMap((node) => [
      `${'  '.repeat(depth + 1)}[${node.ref}] ${node.kind} ${node.name}${
        node.entry ? ` — ${node.entry.name}` : ''
      }`,
      ...steps(node.children, depth + 1)
    ]);

  return [
    `이름: ${previous.name}`,
    `설명: ${previous.description || '(없음)'}`,
    `입력값: ${previous.inputs.map((i) => `${i.key}(${i.kind})`).join(', ') || '없음'}`,
    '스텝:',
    ...steps(previous.plan)
  ];
}

/**
 * 고른 API로 초안을 짠다. previous와 request를 함께 주면 그 초안을 고친 것을 낸다.
 * 모델이 사람에게 물을 것이 있다고 하면 답 대신 물음을 돌려준다 — 답을 받아 answers에
 * 실어 다시 부르면 이어진다 (브리지가 단발 호출이라 대화가 남지 않는다).
 */
export async function draftWorkflow({
  workflow,
  purpose,
  pickedEntries,
  pickedWorkflows,
  entries,
  workflows,
  envKeys,
  getWorkflow,
  answers = [],
  previous = null,
  request = '',
  requirement = '',
  requestId,
  onProgress
}) {
  const revising = previous !== null;

  const task = revising
    ? `## 할 일
아래 "고쳐 달라는 것"에 맞게 지금 초안을 고치세요.
- 고치지 않아도 되는 스텝은 ref를 그대로 두어 어느 것이 그대로인지 알 수 있게 하고,
  steps는 언제나 전체를 다시 내세요 (바뀐 것만 내면 나머지가 사라집니다).
- 이미 정해진 API는 그대로 둡니다. 사람이 그 스텝을 빼 달라거나 잘못 골랐다고 짚은 것만
  지우거나 다른 API로 바꾸세요 — 더 나아 보인다는 이유로 바꾸지 마세요.
- 스텝을 더할 때 쓸 API는 api_detail로 변수·출력을 확인한 뒤에 고릅니다.
- 고쳐 달라는 것과 상관없는 부분은 손대지 마세요.`
    : `## 할 일
고른 API에서 거꾸로 짚어 가며, 시작할 때 무엇을 받아야 하고 어떤 순서로 불러야 하는지 정하세요.
- 고른 API가 요구하는 변수부터 봅니다. 그 값이 앞 스텝의 출력으로 나오면 PREV_RESPONSE로 잇고,
  다른 API를 조회해야 나오면 그 API를 스텝으로 앞에 세우고, 어디서도 나오지 않으면 baseInputs로 받습니다.
- 환경 변수로 채워지는 값은 baseInputs에 넣지 마세요.
- baseInputs 중 앞 입력값으로 조회해 채울 수 있는 것은 kind를 DEPENDENT_LOOKUP(확인용) 또는
  DEPENDENT_COMBO(목록에서 고르기)로 하고 dependsOnKey와 api를 함께 적습니다.
  목록에서 바로 고르는 값이면 API_COMBO에 api를 적습니다. 그 밖에는 MANUAL입니다.
- 고르지 않은 API라도 값을 잇는 데 꼭 필요하면 넣되, api_detail로 확인한 뒤에 쓰세요.
- 확인해야 답할 수 있는 것이 있으면 askUser로 사람에게 물으세요.`;

  const intro = [
    section('지금 짜고 있는 작업', [
      `위치: ${workflow.domain} / ${workflow.task}`,
      `이름: ${workflow.name}`,
      `설명: ${workflow.description || '(없음)'}`
    ]),
    section('이 작업의 목적', [
      `${PURPOSES.find((p) => p.id === purpose)?.label ?? '조회'} — ${PURPOSE_RULE[purpose] ?? PURPOSE_RULE.LOOKUP}`
    ]),
    section(revising ? '쓸 수 있는 API (사람이 고른 것)' : '사람이 고른 API (이것들을 중심으로 짜세요)', pickedEntries.map(catalogDetail)),
    section('사람이 고른 기존 작업 (통째로 불러 쓸 수 있음)', pickedWorkflows.map(workflowLine)),
    section('값이 어디서 오는지 (변수 ← 그 값을 내놓는 API)', supplyLines(pickedEntries, entries, envKeys)),
    section('실행 환경이 알아서 채우는 변수 (입력값으로 받지 마세요)', [envKeys.join(', ') || '없음']),
    ...(requirement ? [section('사람이 덧붙인 요구사항 (반드시 반영하세요)', [requirement])] : []),
    ...(revising ? [section('지금 초안', draftLines(previous)), section('고쳐 달라는 것', [request])] : []),
    ...(answers.length > 0 ? [section('사람에게 물어 확인한 것', answerLines(answers))] : []),
    `${task}

## answer 형식
${DRAFT_SCHEMA}
valueType은 string·number·password 중 하나입니다.
값의 출처(kind)는 USER_INPUT(inputKey) · PREV_RESPONSE(stepRef, jsonPath) · LOOP_ITEM(itemPath) ·
ENV(envKey) · FIXED(value) 중 하나입니다. 연산자는 EQ·NE·GT·GTE·LT·LTE·EXISTS·NOT_EXISTS·CONTAINS입니다.`,
    PATTERNS,
    FEW_SHOT
  ].join('\n\n');

  const result = await converse({
    intro,
    tools: toolbox({ entries, workflows, envKeys, getWorkflow }),
    onProgress,
    requestId,
    // 되묻는 것은 첫 초안 한 번뿐이다 — 고쳐 달라는 말은 이미 사람의 답이고,
    // 고칠 때마다 되물으면 끝나지 않는다
    allowUserQuestions: !revising && answers.length === 0
  });

  if (result.questions) return { questions: result.questions };

  const { answer, reason } = result;
  const known = new Set(workflows.map((w) => w.id));
  return {
    name: String(answer.name ?? '').trim() || workflow.name,
    description: String(answer.description ?? '').trim(),
    inputs: inputNodes(answer.baseInputs, entries),
    plan: planNodes(Array.isArray(answer.steps) ? answer.steps : [], entries, known),
    reason
  };
}
