/**
 * 홈의 AI 명령 박스 — 말로 적은 명령을 실행할 작업(API Chain)·API로 잇는다.
 *
 * 낱말과 명령에 적힌 값은 모델이 뽑고(동의어까지, 짧고 싼 호출 한 번), 무엇이
 * 걸렸는지는 ai/relevance가 카탈로그를 직접 훑어 정한다 — 줄마다 근거가 남고,
 * 모델이 없어도 명령을 그대로 쪼갠 낱말로 검색을 이어 간다.
 * 한 작업으로 안 되는 명령은 저장된 작업들을 순서대로 엮는 조합을 제안한다.
 */
import { normalize, section, workflowLine } from './catalog';
import { askModel } from './converse';
import { rankEntries, rankWorkflows } from './relevance';

// 낱말 뽑기·조합 고르기는 판단이 가벼워 가장 빠르고 싼 모델로 충분하다
const KEYWORD_MODEL = 'haiku';

const KEYWORD_SYSTEM = `당신은 명령을 읽는 도구입니다.
사람이 실행하려는 명령에서 ① 작업·API 목록을 뒤질 낱말과 ② 명령에 적힌 구체적인 값을
뽑아 JSON 하나로 답합니다.
{"keywords": ["계좌", "목록", "조회"], "values": [{"name": "앱 사용자 ID", "value": "1234"}]}

- keywords: 3~7개, 한 낱말씩. 조사·어미를 떼고 명사형으로 씁니다.
  적힌 말과 함께, 같은 것을 가리키는 다른 말도 넣습니다 (고객↔사용자, 해지↔폐쇄).
- values: 명령에 적힌 ID·번호·이름·금액 같은 실제 값. name은 그 값이 무엇인지
  (입력값 라벨로 쓸 이름), value는 값 그대로. 없으면 빈 배열로 둡니다.
- 값 자체(1234 같은 것)는 keywords에 넣지 않습니다.
- 설명 문장이나 코드펜스(\`\`\`)를 덧붙이지 마세요.`;

const WORD_RULE = /[\s/,·]+/;

const words = (text) =>
  String(text ?? '')
    .split(WORD_RULE)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);

/** AI 없이 뽑는 낱말 — 낱말 뽑기가 실패해도 검색으로 이어 갈 수 있게 한다. */
export const commandKeywords = (command) => [...new Set(words(command))].slice(0, 7);

// 5개씩 넘겨 보는 목록이라 첫 화면보다 넉넉히 추려 둔다
const WORKFLOW_MATCH_LIMIT = 25;
const API_MATCH_LIMIT = 10;

/**
 * 명령 → 정확도 순으로 추린 작업·API + 명령에서 인식한 값.
 * 인식한 값의 이름(라벨)도 검색 낱말에 얹는다 — "앱 사용자 ID 1234의 계좌 목록"이면
 * 값 이름의 '사용자'가 작업 설명에 걸린다.
 * error는 낱말 뽑기 실패(모델 없음 등) — 결과는 명령을 쪼갠 낱말로 이어 간다.
 */
export async function matchCommand(command, { entries, workflows }) {
  let keywords = commandKeywords(command);
  let values = [];
  let error = null;

  try {
    const reply = await askModel({
      system: KEYWORD_SYSTEM,
      prompt: `## 명령\n${command}\n\n## 할 일\n이 명령과 관련된 작업·API를 찾을 낱말과, 명령에 적힌 값을 뽑으세요.`,
      model: KEYWORD_MODEL
    });
    const picked = (Array.isArray(reply.keywords) ? reply.keywords : [])
      .map((word) => String(word).trim())
      .filter((word) => word.length >= 2);
    if (picked.length > 0) keywords = picked;
    values = (Array.isArray(reply.values) ? reply.values : [])
      .map((entry) => ({ name: String(entry?.name ?? '').trim(), value: String(entry?.value ?? '').trim() }))
      .filter((entry) => entry.name && entry.value);
  } catch (e) {
    error = e.message;
  }

  const searchWords = [...new Set([...keywords, ...values.flatMap((v) => words(v.name))])];

  return {
    keywords,
    values,
    error,
    workflows: rankWorkflows(workflows, searchWords, WORKFLOW_MATCH_LIMIT),
    apis: rankEntries(entries, searchWords, API_MATCH_LIMIT)
  };
}

// ---- 명령의 값 ↔ 작업 입력값 매칭 ------------------------------------------

// "앱사용자 ID"·"앱 사용자 ID"·"app_user_id"·"앱유저아이디"가 같은 것으로 읽히게 —
// 띄어쓰기·구분자를 지우고 흔한 표기(아이디↔id, 유저↔사용자)를 한쪽으로 모은다
export const normalizeLabel = (text) =>
  String(text ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s_\-()]/g, '')
    .replace(/아이디/g, 'id')
    .replace(/유저/g, '사용자');

const sameLabel = (a, b) => a.length >= 2 && b.length >= 2 && (a === b || a.includes(b) || b.includes(a));

/** 명령에서 인식한 값 가운데 이 입력값(라벨·키)에 닿는 것 — 없으면 null. */
export const valueForInput = (input, values) =>
  values.find((v) => {
    const name = normalizeLabel(v.name);
    return sameLabel(name, normalizeLabel(input.label)) || sameLabel(name, normalizeLabel(input.key));
  }) ?? null;

/**
 * 실행 응답에서 다음 실행의 입력 후보가 될 스칼라 필드를 거둔다 — 징검다리 앞
 * 단계가 내놓은 CIF가 뒷 단계의 CIF 입력에 그대로 채워지게 하는 재료다.
 * 같은 키가 여러 번 나오면 나중 응답(뒤 스텝) 것이 남고, 배열은 첫 항목만 본다.
 */
export function harvestValues(responses) {
  const found = new Map();
  const visit = (node, depth) => {
    if (node == null || depth > 4) return;
    if (Array.isArray(node)) {
      visit(node[0], depth + 1);
      return;
    }
    if (typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('_')) continue;
      if (typeof value === 'string' || typeof value === 'number') {
        if (String(value).trim() !== '') found.set(key, String(value));
      } else {
        visit(value, depth + 1);
      }
    }
  };
  for (const body of responses ?? []) visit(body, 0);
  return [...found].map(([name, value]) => ({ name, value }));
}

// ---- 징검다리 작업 — 모자란 입력값을 만들어 주는 앞 단계 -------------------

const leafOf = (field) => String(field).split('.').pop();

const manualInputs = (workflow) => (workflow.inputs ?? []).filter((i) => (i.kind ?? 'MANUAL') === 'MANUAL');

const missingManualInputs = (workflow, values) => manualInputs(workflow).filter((i) => !valueForInput(i, values));

// 카탈로그 참조 → 실재 항목 (부서·경로·이름이 다 맞아야 한다)
const entryForRef = (entries, ref) =>
  entries.find(
    (e) =>
      normalize(e.department) === normalize(ref.department)
      && normalize((e.itemPath ?? []).join('/')) === normalize((ref.itemPath ?? []).join('/'))
      && normalize(e.name) === normalize(ref.name)
  ) ?? null;

// 워크플로우가 내놓는 값들 — 스텝이 부르는 API의 출력 필드 키와 한국어 라벨
const workflowOutputs = (workflow, entries) =>
  (workflow.apiRefs ?? []).flatMap((ref) => {
    const entry = entryForRef(entries, ref);
    if (!entry) return [];
    return [...(entry.outputFields ?? []).map(leafOf), ...Object.values(entry.outputLabels ?? {})];
  });

/**
 * 명령의 값으로는 입력을 다 못 채우는 작업에, 모자란 값을 만들어 줄 징검다리 작업을
 * 찾는다 — "앱 사용자 ID"만 있는데 CIF를 받는 작업이면, 앱 사용자 ID로 실행해 CIF를
 * 내놓는 조회 작업을 앞에 세운다. 후보가 여럿이면 부르는 API가 적은 것(단순 조회일
 * 가능성이 높다)을 고르고, 모자란 값을 하나라도 못 만들면 null이다.
 */
export function bridgePlanFor(target, { workflows, entries, values }) {
  if (values.length === 0) return null;
  const missing = missingManualInputs(target, values);
  if (missing.length === 0) return null;

  const bridges = new Map();
  for (const input of missing) {
    const wanted = [normalizeLabel(input.label), normalizeLabel(input.key)].filter((t) => t.length >= 2);
    const candidates = workflows
      .filter(
        (w) =>
          w.id !== target.id
          && missingManualInputs(w, values).length === 0
          && manualInputs(w).some((i) => valueForInput(i, values))
          && workflowOutputs(w, entries).some((out) => wanted.some((t) => sameLabel(normalizeLabel(out), t)))
      )
      .sort((a, b) => (a.apiRefs?.length ?? 0) - (b.apiRefs?.length ?? 0) || manualInputs(a).length - manualInputs(b).length);
    if (candidates.length === 0) return null;
    const bridge = candidates[0];
    if (!bridges.has(bridge.id)) bridges.set(bridge.id, { workflow: bridge, provides: [] });
    bridges.get(bridge.id).provides.push(input.label || input.key);
  }
  return { missing, bridges: [...bridges.values()] };
}

const COMBO_SYSTEM = `당신은 작업(API Chain) 조합을 짜는 도구입니다.
주어진 목록의 작업만 순서대로 엮어 명령을 이룰 계획을 JSON 하나로 답합니다.
{"plan": [{"id": "wf_a", "why": "왜 이 작업이 필요한지 한 줄"}], "reason": "조합 전체를 한 줄로"}

- plan에는 목록에 있는 작업의 id만, 실행할 순서대로 넣습니다. 목록에 없는 id는 절대 지어내지 마세요.
- 명령을 한 작업으로 이룰 수 있으면 그 하나만 넣습니다.
- 조합해도 이룰 수 없으면 {"plan": [], "reason": "왜 안 되는지 한 줄"}로 답합니다.
- 설명 문장이나 코드펜스(\`\`\`)를 덧붙이지 마세요.`;

/**
 * 명령을 한 작업으로 못 이룰 때 — 저장된 작업들을 순서대로 엮는 조합을 제안한다.
 * 모델이 돌려준 id는 실재하는 작업으로 확인해 걸러낸다.
 */
export async function suggestCombination(command, { workflows, values = [] }) {
  const prompt = [
    section('명령', [command]),
    ...(values.length > 0 ? [section('명령에서 인식한 값', values.map((v) => `${v.name}: ${v.value}`))] : []),
    section('쓸 수 있는 작업', workflows.map(workflowLine)),
    '## 할 일\n이 명령을 이루려면 어떤 작업을 어떤 순서로 실행해야 하는지 제안하세요.'
  ].join('\n\n');

  const reply = await askModel({ system: COMBO_SYSTEM, prompt, model: KEYWORD_MODEL });
  const byId = new Map(workflows.map((workflow) => [workflow.id, workflow]));
  const plan = (Array.isArray(reply.plan) ? reply.plan : []).flatMap((step) => {
    const workflow = byId.get(String(step?.id ?? '').trim());
    return workflow ? [{ workflow, why: String(step?.why ?? '').trim() }] : [];
  });
  return { plan, reason: String(reply.reason ?? '').trim() };
}
