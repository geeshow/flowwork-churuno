/**
 * 워크플로우를 짤 때 옆에서 거드는 AI — 작업(위치·이름·설명)을 읽고 무엇을 입력받을지
 * 제안하고(제안 1), 그다음 어떤 스텝을 이어 갈지 제안한다(제안 2).
 *
 * 한 번에 답하게 하지 않는다. 처음에는 이름 목록만 주고, 모델이 필요한 것을 스스로
 * 물어보게 한다(api_detail·workflow_detail·env_keys…). 물음에는 이 파일이 카탈로그와
 * 저장된 작업에서 찾아 답하고, 몇 차례 오간 뒤에 답을 내게 한다 — 무엇을 근거로 골랐는지
 * 남고, 그 API가 실제로 무슨 변수를 받는지 확인한 뒤에 제안하게 되기 때문이다.
 *
 * 제안은 언제나 "초안"이다. 답에 담긴 API·업무 참조는 반드시 목록에서 찾아 확인하고
 * (resolveEntry), 찾지 못한 것은 "직접 고르세요"로 표시해 넘긴다 — 지어낸 이름이
 * 편집기에 그대로 들어가지 않게 한다.
 */
import { aiGenerateText } from 'utils/ai';

import { stepId } from '../editor/stepFactory';

// 질의를 주고받는 차례 — 이 뒤에는 반드시 답을 내게 한다.
// 한 차례가 곧 CLI 호출 한 번(수십 초)이라 짧게 잡는다.
const MAX_ROUNDS = 2;
// 한 차례에 물을 수 있는 개수
const MAX_ASKS = 4;
// 목록으로 되돌려 주는 줄 수 — 답이 길어지면 다음 차례 프롬프트만 무거워진다
const MAX_LINES = 25;

const SYSTEM = `당신은 API 워크플로우 설계를 돕는 조수입니다.

한 번에 답하지 말고, 필요한 것을 먼저 물어 확인한 뒤 답합니다.
매 차례 JSON 하나만 출력합니다 — 설명 문장이나 코드펜스(\`\`\`)를 덧붙이지 마세요.

물어볼 때:  {"thought": "무엇을 확인하려는지 한 줄", "ask": [{"tool": "api_detail", "arg": "계좌 폐쇄"}]}
답할 때:    {"answer": { ... }, "reason": "이렇게 고른 이유 한 줄"}

쓸 수 있는 질의(tool):
- api_search(낱말): 이름·경로·URL에 그 낱말이 든 API 목록
- api_detail(이름): API 하나가 받는 변수와 내놓는 출력 필드
- workflow_search(낱말): 이름·설명에 그 낱말이 든 작업 목록
- workflow_detail(작업 id): 그 작업의 입력값과 스텝 구성 (본보기로 삼기 좋다)
- env_keys(): 실행 환경이 알아서 채워 주는 변수 이름들

한 차례에 ${MAX_ASKS}개까지 물을 수 있습니다. 목록에 없는 API·작업은 절대 지어내지 마세요.
이름·라벨·설명은 한국어로 씁니다.`;

// 첫 차례에 주는 본보기 — 무엇을 어떤 차례로 물어야 하는지 짧게 보여 준다
const FEW_SHOT = `## 물어보는 본보기 (형식만 참고하세요)
차례 1 → {"thought":"휴면 계좌를 다루니 계좌 쪽 API와 비슷한 작업을 먼저 본다","ask":[{"tool":"api_search","arg":"계좌"},{"tool":"workflow_search","arg":"폐쇄"}]}
답    → core/계좌/계좌 목록 조회 (보안ID) … / 계좌/폐쇄/계좌 강제 폐쇄 (account_force_close) …
차례 2 → {"thought":"폐쇄 API가 무엇을 받는지, 비슷한 작업이 무엇을 입력받는지 확인","ask":[{"tool":"api_detail","arg":"계좌 폐쇄"},{"tool":"workflow_detail","arg":"account_force_close"},{"tool":"env_keys"}]}
답    → 변수: authToken, coreBaseUrl, accountNo, reason … / 입력값: app_user_id … / 환경: authToken, coreBaseUrl
차례 3 → {"answer": {…}, "reason":"…"}`;

const catalogLine = (entry) =>
  [
    `${entry.department}/${[...entry.itemPath, entry.name].join('/')}`,
    `${entry.method} ${entry.url}`
  ].join(' | ');

const catalogDetail = (entry) =>
  [
    catalogLine(entry),
    `  변수: ${entry.variables?.join(', ') || '없음'}`,
    `  출력: ${(entry.outputFields ?? []).join(', ') || '없음'}`
  ].join('\n');

const workflowLine = (workflow) =>
  `${workflow.domain}/${workflow.task}/${workflow.name} (id: ${workflow.id})${
    workflow.description ? ` — ${workflow.description}` : ''
  }`;

const section = (title, lines) => `## ${title}\n${lines.length ? lines.join('\n') : '(없음)'}`;

const normalize = (text) => String(text ?? '').normalize('NFC').trim().toLowerCase();

const matches = (haystack, needle) => normalize(haystack).includes(normalize(needle));

/** 모델이 JSON만 뱉지 않는 경우가 있어, 가장 바깥 중괄호만 떼어 읽는다. */
function parseJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('AI 응답을 읽지 못했습니다. 다시 시도하세요.');
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (_error) {
    throw new Error('AI 응답을 읽지 못했습니다. 다시 시도하세요.');
  }
}

async function ask(prompt) {
  const result = await aiGenerateText({ system: SYSTEM, prompt });
  if (result?.error) {
    const hint = /401|토큰|api key/i.test(result.error) ? ' — Preferences > AI에서 AI를 켜고 토큰을 넣으세요.' : '';
    throw new Error(`${result.error}${hint}`);
  }
  if (!result?.text?.trim()) throw new Error('AI가 답하지 않았습니다. 잠시 후 다시 시도하세요.');
  return parseJson(result.text);
}

/** 응답의 API 참조를 카탈로그의 실재하는 항목으로 확인한다 — 못 찾으면 null. */
function resolveEntry(entries, ref) {
  if (!ref?.name) return null;
  const name = normalize(ref.name);
  const path = normalize([ref.department, ...(ref.itemPath ?? [])].join('/'));
  const byName = entries.filter((e) => normalize(e.name) === name);
  if (byName.length === 1) return byName[0];
  return byName.find((e) => normalize([e.department, ...e.itemPath].join('/')) === path) ?? byName[0] ?? null;
}

const catalogEntryOf = (entry) => ({
  department: entry.department,
  collectionFile: entry.collectionFile,
  itemPath: entry.itemPath,
  name: entry.name
});

// -- 모델의 질의에 답하기 ----------------------------------------------------

const stepLine = (step, index) => {
  const kind = step.kind ?? (step.workflowBinding ? '업무 연결' : step.delayBinding ? '지연' : 'API');
  const api = step.apiBinding?.catalogEntry?.name;
  return `  ${index + 1}. [${kind}] ${step.name}${api ? ` — ${api}` : ''}${step.parentId ? ' (블록 안)' : ''}`;
};

/** 모델이 부를 수 있는 질의들 — 답은 모두 이 자리(카탈로그·저장된 작업)에서만 나온다. */
function toolbox({ entries, workflows, envKeys, getWorkflow }) {
  return {
    api_search: (arg) =>
      entries
        .filter((e) => matches([e.name, ...e.itemPath, e.url].join(' '), arg))
        .slice(0, MAX_LINES)
        .map(catalogLine),

    // 이름으로도, 'core/계좌/계좌 폐쇄' 같은 경로로도 물어 오므로 마지막 마디까지 본다
    api_detail: (arg) => {
      const leaf = String(arg ?? '').split('/').pop().trim();
      const entry = resolveEntry(entries, { name: arg }) ?? resolveEntry(entries, { name: leaf });
      if (entry) return catalogDetail(entry).split('\n');
      const near = entries.filter((e) => matches(e.name, leaf)).slice(0, MAX_LINES);
      return near.length > 0
        ? [`'${arg}'와 꼭 맞는 API는 없습니다. 비슷한 것:`, ...near.map(catalogLine)]
        : [`'${arg}' 이름의 API는 없습니다.`];
    },

    workflow_search: (arg) =>
      workflows
        .filter((w) => matches([w.name, w.domain, w.task, w.description].join(' '), arg))
        .slice(0, MAX_LINES)
        .map(workflowLine),

    workflow_detail: async (arg) => {
      const summary = workflows.find((w) => w.id === arg || matches(w.name, arg));
      if (!summary) return [`'${arg}' 작업을 찾지 못했습니다.`];
      const full = await getWorkflow(summary.id).catch(() => null);
      if (!full) return [workflowLine(summary)];
      return [
        workflowLine(summary),
        `  입력값: ${full.baseInputs.map((i) => `${i.key}(${i.kind})`).join(', ') || '없음'}`,
        '  스텝:',
        ...full.steps.map(stepLine)
      ];
    },

    env_keys: () => [[...envKeys].join(', ') || '없음']
  };
}

async function answerAsks(asks, tools) {
  const lines = [];
  for (const { tool, arg } of asks) {
    const run = tools[tool];
    if (!run) {
      lines.push(`${tool}(${arg ?? ''}) → 그런 질의는 없습니다.`);
      continue;
    }
    const answer = await run(arg);
    lines.push(`${tool}(${arg ?? ''}) →`, ...answer);
  }
  return lines;
}

/**
 * 질의 ↔ 답을 몇 차례 주고받은 뒤 답을 받아 온다.
 * 매 차례 지금까지 오간 것을 통째로 다시 보낸다 — 브리지가 단발 호출이라 대화가 남지 않는다.
 */
async function converse({ intro, tools, onProgress }) {
  const transcript = [];

  for (let round = 1; round <= MAX_ROUNDS + 1; round += 1) {
    const last = round > MAX_ROUNDS;
    const closing = last
      ? '## 이번 차례\n더 묻지 말고 answer를 내세요.'
      : `## 이번 차례 (${round}/${MAX_ROUNDS})\n더 확인할 것이 있으면 ask를, 충분하면 answer를 내세요.`;

    const reply = await ask([intro, ...transcript, closing].join('\n\n'));

    const answer = reply.answer ?? (reply.ask ? null : reply);
    if (answer) return { answer, reason: String(reply.reason ?? '').trim(), asked: [...transcript] };

    const asks = reply.ask.slice(0, MAX_ASKS).filter((a) => a?.tool);
    if (asks.length === 0) continue;

    const thought = String(reply.thought ?? '').trim();
    onProgress?.(`${round}차 확인 — ${asks.map((a) => `${a.tool}(${a.arg ?? ''})`).join(', ')}${thought ? ` · ${thought}` : ''}`);

    transcript.push([`## 차례 ${round}에 물어본 것`, JSON.stringify(asks, null, 0), '## 그 답', ...(await answerAsks(asks, tools))].join('\n'));
  }

  throw new Error('AI가 끝내 답을 내지 못했습니다. 다시 시도하세요.');
}

// -- 제안 1: 분류·이름·입력값 ------------------------------------------------

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
    inputs: (Array.isArray(answer.baseInputs) ? answer.baseInputs : []).flatMap((input) => {
      const key = String(input.key ?? '').trim();
      if (!key) return [];
      return [{ ...input, key, label: String(input.label ?? '').trim() || key, entry: resolveEntry(entries, input.api) }];
    }),
    apis: (Array.isArray(answer.apis) ? answer.apis : []).flatMap((ref) => {
      const entry = resolveEntry(entries, ref);
      return entry ? [{ entry, why: String(ref.why ?? '').trim() }] : [];
    }),
    reason,
    rounds: asked.length
  };
}

/** 제안된 입력값 → 편집기의 baseInputs. 참조한 API를 찾지 못했으면 직접 입력으로 내린다. */
export function inputsFromSuggestion(inputs) {
  return inputs.map(({ key, label, kind, valueType, dependsOnKey, valueField, displayFields, labelField, entry }) => {
    const base = { key, label };
    if (entry && kind === 'API_COMBO') {
      return { ...base, kind, sourceApiId: entry.id, labelField: labelField || '', valueField: valueField || '' };
    }
    if (entry && kind === 'DEPENDENT_LOOKUP') {
      return {
        ...base,
        kind,
        dependsOnKey: dependsOnKey || '',
        lookupApiId: entry.id,
        displayFields: Array.isArray(displayFields) ? displayFields : [],
        valueField: valueField || ''
      };
    }
    if (entry && kind === 'DEPENDENT_COMBO') {
      return {
        ...base,
        kind,
        dependsOnKey: dependsOnKey || '',
        lookupApiId: entry.id,
        labelField: labelField || '',
        valueField: valueField || ''
      };
    }
    const type = ['string', 'number', 'password'].includes(valueType) ? valueType : 'string';
    return { ...base, kind: 'MANUAL', valueType: type };
  });
}

// -- 제안 2: 스텝 과정 -------------------------------------------------------

const KINDS = new Set(['API', 'WORKFLOW', 'DELAY', 'REPEAT', 'BRANCH']);

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

/** 응답의 스텝 나무 → 화면에 보여 줄 계획. 실재 여부(entry/workflowId)를 여기서 확정한다. */
function planNodes(nodes, entries, known) {
  return nodes.flatMap((node) => {
    const kind = KINDS.has(node.kind) ? node.kind : 'API';
    const entry = kind === 'API' ? resolveEntry(entries, node.api) : null;
    const linkedId = kind === 'WORKFLOW' && known.has(node.workflowId) ? node.workflowId : '';
    return [
      {
        ref: String(node.ref ?? ''),
        kind,
        name: String(node.name ?? '').trim() || entry?.name || '스텝',
        why: String(node.why ?? '').trim(),
        entry,
        linkedId,
        // 카탈로그·작업 목록에서 찾지 못한 참조 — 사람이 직접 골라야 한다
        missing: (kind === 'API' && !entry) || (kind === 'WORKFLOW' && !linkedId),
        bindings: node.bindings ?? node.inputs ?? {},
        seconds: node.seconds,
        repeat: node.repeat,
        condition: node.condition,
        children: Array.isArray(node.children) ? planNodes(node.children, entries, known) : []
      }
    ];
  });
}

const flattenPlan = (plan) => plan.flatMap((node) => [node, ...flattenPlan(node.children)]);

const OPERATORS = new Set(['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'EXISTS', 'NOT_EXISTS', 'CONTAINS']);

function valueSource(source, idByRef) {
  switch (source?.kind) {
    case 'USER_INPUT':
      return source.inputKey ? { kind: 'USER_INPUT', inputKey: source.inputKey } : null;
    case 'ENV':
      return source.envKey ? { kind: 'ENV', envKey: source.envKey } : null;
    case 'FIXED':
      return { kind: 'FIXED', value: source.value ?? '' };
    case 'LOOP_ITEM':
      return { kind: 'LOOP_ITEM', itemPath: source.itemPath || '$' };
    case 'PREV_RESPONSE': {
      const stepId = idByRef.get(source.stepRef);
      return stepId ? { kind: 'PREV_RESPONSE', stepId, jsonPath: source.jsonPath || '$' } : null;
    }
    default:
      return null;
  }
}

/**
 * 계획 → 편집기의 스텝 배열(평면 + parentId). 적용을 누를 때 한 번 부른다.
 * 환경 변수와 이름이 같은 변수는 카탈로그에서 직접 고를 때처럼 환경변수로 미리 이어 둔다.
 */
export function stepsFromPlan(plan, envKeys = []) {
  const idByRef = new Map(flattenPlan(plan).map((node) => [node.ref, stepId()]));
  const fromEnv = new Set(envKeys);

  const build = (nodes, parentId) =>
    nodes.flatMap((node) => {
      const id = idByRef.get(node.ref);
      const base = { id, order: 0, name: node.name, ...(parentId ? { parentId } : {}) };
      const bindings = Object.fromEntries(
        Object.entries(node.bindings)
          .map(([variable, source]) => [variable, valueSource(source, idByRef)])
          .filter(([, source]) => source !== null)
      );

      switch (node.kind) {
        case 'REPEAT': {
          const repeat
            = node.repeat?.kind === 'COUNT'
              ? { kind: 'COUNT', count: Number(node.repeat.count) || 1 }
              : {
                  kind: 'LIST',
                  sourceStepId: idByRef.get(node.repeat?.sourceRef) ?? '',
                  itemsPath: node.repeat?.itemsPath || '$.data',
                  maxIterations: Number(node.repeat?.maxIterations) || 10
                };
          return [{ ...base, kind: 'REPEAT', repeat }, ...build(node.children, id)];
        }
        case 'BRANCH': {
          const source = valueSource(node.condition?.source, idByRef) ?? { kind: 'USER_INPUT', inputKey: '' };
          const operator = OPERATORS.has(node.condition?.operator) ? node.condition.operator : 'EQ';
          return [
            {
              ...base,
              kind: 'BRANCH',
              branchCondition: { source, operator, compareValue: node.condition?.compareValue ?? '' }
            },
            ...build(node.children, id)
          ];
        }
        case 'DELAY':
          return [{ ...base, delayBinding: { seconds: Number(node.seconds) || 1 } }];
        case 'WORKFLOW':
          return [{ ...base, workflowBinding: { ref: { id: node.linkedId }, inputMappings: bindings } }];
        default:
          return [
            {
              ...base,
              apiBinding: {
                catalogEntry: node.entry
                  ? catalogEntryOf(node.entry)
                  : { department: '', collectionFile: '', itemPath: [], name: '' },
                variableBindings: {
                  ...Object.fromEntries(
                    (node.entry?.variables ?? [])
                      .filter((variable) => fromEnv.has(variable))
                      .map((variable) => [variable, { kind: 'ENV', envKey: variable }])
                  ),
                  ...bindings
                }
              },
              ...(node.entry?.outputFields?.length
                ? { resultView: { mode: 'TABLE', columns: node.entry.outputFields.slice(0, 5) } }
                : {})
            }
          ];
      }
    });

  return build(plan, null);
}
