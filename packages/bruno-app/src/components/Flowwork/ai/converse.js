/**
 * 모델과 몇 차례 주고받아 답을 받아 오는 자리.
 *
 * 브리지가 단발 호출이라 대화가 남지 않으므로, 매 차례 지금까지 오간 것을 통째로 다시
 * 보낸다. 모델의 질의에는 이 파일이 카탈로그와 저장된 작업에서만 답한다 — 지어낸 이름이
 * 다음 차례 프롬프트에 섞여 들어가지 않게.
 */
import { aiGenerateText } from 'utils/ai';

import { catalogDetail, catalogLine, matches, resolveEntry, stepLine, workflowLine } from './catalog';

// 질의를 주고받는 차례 — 이 뒤에는 반드시 답을 내게 한다.
// 한 차례가 곧 CLI 호출 한 번(수십 초)이라 짧게 잡는다.
export const MAX_ROUNDS = 2;
// 한 차례에 물을 수 있는 개수
const MAX_ASKS = 4;
// 목록으로 되돌려 주는 줄 수 — 답이 길어지면 다음 차례 프롬프트만 무거워진다
const MAX_LINES = 25;

const TOOL_GUIDE = `쓸 수 있는 질의(tool):
- api_search(낱말): 이름·경로·URL에 그 낱말이 든 API 목록
- api_detail(이름): API 하나가 받는 변수와 내놓는 출력 필드
- workflow_search(낱말): 이름·설명에 그 낱말이 든 작업 목록
- workflow_detail(작업 id): 그 작업의 입력값과 스텝 구성 (본보기로 삼기 좋다)
- env_keys(): 실행 환경이 알아서 채워 주는 변수 이름들`;

// 사람에게 되묻는 길은 마법사에서만 연다 — 물음이 화면에 뜨고 답을 기다릴 자리가
// 있어야 쓸모가 있고, 버튼 하나로 끝나는 제안에서는 그저 한 차례를 더 쓰게 만든다.
const USER_QUESTION_GUIDE = `사람에게 되묻기: {"askUser": [{"id": "q1", "question": "어떤 상태의 계좌를 대상으로 하나요?", "choices": ["ACTIVE만", "DORMANT만", "상태를 가리지 않음"]}]}
- 카탈로그를 봐도 알 수 없고, 답에 따라 스텝 구성이 달라지는 것만 묻습니다 (많아야 3개).
- choices는 반드시 2개 이상 넣습니다. 고를 것을 주지 않으면 사람이 답하기 어렵습니다
  (그 밖의 답을 적을 자리는 화면이 알아서 붙여 줍니다).`;

const systemPrompt = ({ allowUserQuestions }) =>
  [
    '당신은 API 워크플로우 설계를 돕는 조수입니다.',
    '',
    '한 번에 답하지 말고, 필요한 것을 먼저 물어 확인한 뒤 답합니다.',
    '매 차례 JSON 하나만 출력합니다 — 설명 문장이나 코드펜스(```)를 덧붙이지 마세요.',
    '',
    '물어볼 때:  {"thought": "무엇을 확인하려는지 한 줄", "ask": [{"tool": "api_detail", "arg": "계좌 폐쇄"}]}',
    '답할 때:    {"answer": { ... }, "reason": "이렇게 고른 이유 한 줄"}',
    '',
    TOOL_GUIDE,
    ...(allowUserQuestions ? ['', USER_QUESTION_GUIDE] : []),
    '',
    `한 차례에 ${MAX_ASKS}개까지 물을 수 있습니다. 목록에 없는 API·작업은 절대 지어내지 마세요.`,
    '이름·라벨·설명은 한국어로 씁니다.'
  ].join('\n');

/** 모델이 JSON만 뱉지 않는 경우가 있어, 가장 바깥 중괄호만 떼어 읽는다. */
export function parseJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('AI 응답을 읽지 못했습니다. 다시 시도하세요.');
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (_error) {
    throw new Error('AI 응답을 읽지 못했습니다. 다시 시도하세요.');
  }
}

/** 사람이 그만둔 것 — 실패가 아니므로 부르는 쪽이 오류로 보이지 않게 가려낸다. */
export const CANCELLED = 'AI_CANCELLED';

/**
 * 브리지 한 번 호출 — model을 주면 그 모델로 돈다(빠르고 싼 모델을 골라 쓰는 자리).
 * requestId를 주면 그 이름으로 도중에 끊을 수 있다 (utils/ai의 cancelAiGenerateText).
 */
export async function askModel({ system, prompt, model, requestId }) {
  const result = await aiGenerateText({ system, prompt, model, requestId });
  if (result?.cancelled) {
    const stopped = new Error('중단했습니다.');
    stopped.code = CANCELLED;
    throw stopped;
  }
  if (result?.error) {
    const hint = /401|토큰|api key/i.test(result.error) ? ' — Preferences > AI에서 AI를 켜고 토큰을 넣으세요.' : '';
    throw new Error(`${result.error}${hint}`);
  }
  if (!result?.text?.trim()) throw new Error('AI가 답하지 않았습니다. 잠시 후 다시 시도하세요.');
  return parseJson(result.text);
}

/** 모델이 부를 수 있는 질의들 — 답은 모두 이 자리(카탈로그·저장된 작업)에서만 나온다. */
export function toolbox({ entries, workflows, envKeys, getWorkflow }) {
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

// 무엇을 확인하는 차례인지 사람 말로 — 진행 자취가 tool 이름의 나열이 되지 않게
const ASK_LABEL = {
  api_detail: 'API가 받는 값과 내놓는 값 확인',
  api_search: '쓸 만한 API 찾기',
  workflow_detail: '기존 작업의 구성 확인',
  workflow_search: '비슷한 작업 찾기',
  env_keys: '환경이 알아서 채우는 변수 확인'
};

function describeAsks(asks) {
  const byTool = new Map();
  for (const { tool, arg } of asks) {
    if (!byTool.has(tool)) byTool.set(tool, []);
    if (arg) byTool.get(tool).push(String(arg));
  }
  return [...byTool].map(([tool, args]) =>
    `${ASK_LABEL[tool] ?? tool}${args.length > 0 ? ` — ${args.join(', ')}` : ''}`);
}

const userQuestions = (reply) =>
  (Array.isArray(reply.askUser) ? reply.askUser : [])
    .filter((q) => q?.question)
    .slice(0, 3)
    .map((q, index) => ({
      id: String(q.id ?? `q${index + 1}`),
      question: String(q.question).trim(),
      choices: (Array.isArray(q.choices) ? q.choices : []).map(String)
    }));

/**
 * 질의 ↔ 답을 몇 차례 주고받은 뒤 답을 받아 온다.
 * allowUserQuestions면 답 대신 사람에게 물을 것을 돌려줄 수 있다 — 부르는 쪽이 화면에
 * 띄워 답을 받고, 그 답을 intro에 붙여 다시 부른다(브리지에 대화가 남지 않으므로).
 */
export async function converse({
  intro,
  tools,
  onProgress,
  requestId,
  allowUserQuestions = false,
  maxRounds = MAX_ROUNDS
}) {
  const system = systemPrompt({ allowUserQuestions });
  const transcript = [];

  for (let round = 1; round <= maxRounds + 1; round += 1) {
    const last = round > maxRounds;
    const closing = last
      ? '## 이번 차례\n더 묻지 말고 answer를 내세요.'
      : `## 이번 차례 (${round}/${maxRounds})\n더 확인할 것이 있으면 ask를, 충분하면 answer를 내세요.`;

    const reply = await askModel({ system, prompt: [intro, ...transcript, closing].join('\n\n'), requestId });

    if (allowUserQuestions && !last) {
      const questions = userQuestions(reply);
      if (questions.length > 0) return { questions, asked: [...transcript] };
    }

    const answer = reply.answer ?? (reply.ask ? null : reply);
    if (answer) return { answer, reason: String(reply.reason ?? '').trim(), asked: [...transcript] };

    const asks = reply.ask.slice(0, MAX_ASKS).filter((a) => a?.tool);
    if (asks.length === 0) continue;

    onProgress?.({ round, lines: describeAsks(asks), thought: String(reply.thought ?? '').trim() });

    transcript.push([`## 차례 ${round}에 물어본 것`, JSON.stringify(asks, null, 0), '## 그 답', ...(await answerAsks(asks, tools))].join('\n'));
  }

  throw new Error('AI가 끝내 답을 내지 못했습니다. 다시 시도하세요.');
}
