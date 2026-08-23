/**
 * 낱말로 API·작업을 추려 내는 자리 — 여기에는 모델이 끼지 않는다.
 *
 * 모델은 낱말만 뽑고(짧고 싼 호출 한 번), 무엇이 걸렸는지는 이 파일이 카탈로그를
 * 직접 훑어 정한다. 그래야 왜 그 API가 올라왔는지 줄마다 근거를 붙일 수 있고,
 * 같은 입력이면 같은 결과가 나온다.
 *
 * 이름·경로만 보지 않는 게 요점이다. 출력 필드의 한국어 라벨(outputLabels)이 곧
 * 그 API의 도움말이라, "잔액"으로 찾으면 이름에 잔액이 없는 계좌 조회가 걸린다.
 */
import { matches, normalize } from './catalog';

// 어디에 걸렸는지에 따라 무게가 다르다 — 이름에 든 낱말이 URL에 든 낱말보다 세다
const entryFields = (entry) => [
  { where: '이름', weight: 3, text: entry.name },
  { where: '분류', weight: 3, text: [entry.department, ...entry.itemPath].join(' ') },
  { where: '출력', weight: 2, text: Object.values(entry.outputLabels ?? {}).join(' ') },
  { where: '변수', weight: 1, text: (entry.variables ?? []).join(' ') },
  { where: '주소', weight: 1, text: entry.url }
];

const workflowFields = (workflow) => [
  { where: '이름', weight: 3, text: workflow.name },
  { where: '분류', weight: 3, text: `${workflow.domain} ${workflow.task}` },
  { where: '설명', weight: 2, text: workflow.description ?? '' }
];

/** 낱말이 어느 자리에 몇 개나 걸렸는지 — 점수와 함께 근거로 쓸 자리 이름을 남긴다. */
function score(fields, keywords) {
  const hits = [];
  const where = new Set();
  let total = 0;

  for (const keyword of keywords) {
    const word = normalize(keyword);
    if (word.length < 2) continue;
    const found = fields.filter((field) => matches(field.text, word));
    if (found.length === 0) continue;
    hits.push(keyword);
    // 한 낱말이 여러 자리에 걸려도 가장 센 자리로만 센다 — 같은 말이 이름과 URL에
    // 겹쳐 있다는 이유로 점수가 두 배가 되면 순위가 흐트러진다
    const best = found.reduce((a, b) => (a.weight >= b.weight ? a : b));
    total += best.weight;
    where.add(best.where);
  }

  return { score: total, hits, where: [...where] };
}

// 점수가 같은 것끼리는 업무와 같은 부서가 앞선다 — API가 수천 개면 "계좌" 한
// 낱말에 수백 개가 같은 점수로 걸리는데, 그중 다른 부서 것이 먼저 나오면
// 상한에 잘려 정작 쓸 것이 목록에 없다
const ranked = (items, toFields, keywords, limit, prefer) =>
  items
    .map((item) => ({ item, ...score(toFields(item), keywords) }))
    .filter((row) => row.score > 0)
    .sort((a, b) =>
      b.score - a.score
      || prefer(b.item) - prefer(a.item)
      || a.hits.length - b.hits.length)
    .slice(0, limit);

const sameDepartment = (department) =>
  department ? (entry) => (normalize(entry.department) === normalize(department) ? 1 : 0) : () => 0;

/** 낱말에 걸린 API — 점수 높은 것부터, 같은 점수면 `department`와 같은 부서부터. */
export const rankEntries = (entries, keywords, limit = 20, { department } = {}) =>
  ranked(entries, entryFields, keywords, limit, sameDepartment(department))
    .map(({ item, ...rest }) => ({ entry: item, ...rest }));

/** 낱말에 걸린 기존 작업 — 통째로 불러 쓸 후보. */
export const rankWorkflows = (workflows, keywords, limit = 8) =>
  ranked(workflows, workflowFields, keywords, limit, () => 0).map(({ item, ...rest }) => ({ workflow: item, ...rest }));

/** 검색창에 친 글로 찾기 — 순위 없이, 걸리는 것만. */
export const findEntries = (entries, text, limit = 20) =>
  text.trim().length === 0
    ? []
    : entries.filter((entry) => entryFields(entry).some((field) => matches(field.text, text))).slice(0, limit);

export const findWorkflows = (workflows, text, limit = 10) =>
  text.trim().length === 0
    ? []
    : workflows.filter((wf) => workflowFields(wf).some((field) => matches(field.text, text))).slice(0, limit);

// 출력 필드는 'owner.cif'처럼 중첩 경로로 오지만, 변수 이름은 마지막 마디만 쓴다
const leafOf = (field) => String(field).split('.').pop();

/**
 * 고른 API가 요구하는 변수를 만들어 내는 API — 값이 어디서 오는지의 뼈대다.
 *
 * `계좌 목록 조회(sec_user_id)`를 골랐다면 그 값을 내놓는 `사용자 정보 조회`가 함께
 * 필요하다는 것이, 이름이 닮았는지와 무관하게 여기서 나온다. 환경 변수로 채워지는
 * 값(authToken 같은)은 사람이 챙길 일이 아니므로 뺀다.
 *
 * 이미 고른 API도 공급자로 남긴다 — 고르는 순간 목록에서 사라지면 잘못 골랐을 때
 * 되돌릴 자리가 없고, 값을 누가 대는지도 그림에서 지워진다.
 */
// 변수 하나에 공급자가 이보다 많으면 잘라 낸다. `id`·`name`처럼 흔한 출력 필드는
// API 수천 개가 내놓으므로, 다 적으면 계획 프롬프트가 그 목록으로 가득 찬다.
const MAX_PRODUCERS_PER_VARIABLE = 5;

// 고른 API와 같은 부서, 그다음 같은 첫 폴더의 공급자가 먼저다 — 같은 값이라도
// 가까운 곳에서 내놓는 API가 실제로 함께 쓰이는 것일 가능성이 높다
const closenessTo = (target) => (source) =>
  (normalize(source.department) === normalize(target.department) ? 2 : 0)
  + (source.itemPath?.[0] && normalize(source.itemPath[0]) === normalize(target.itemPath?.[0]) ? 1 : 0);

export function producersFor(entries, picked, envKeys = []) {
  const fromEnv = new Set(envKeys);
  const producedBy = new Map();

  for (const entry of entries) {
    for (const field of entry.outputFields ?? []) {
      const leaf = leafOf(field);
      if (!producedBy.has(leaf)) producedBy.set(leaf, []);
      producedBy.get(leaf).push(entry);
    }
  }

  const out = new Map();
  for (const target of picked) {
    const closeness = closenessTo(target);
    for (const variable of target.variables ?? []) {
      if (fromEnv.has(variable)) continue;
      const sources = (producedBy.get(variable) ?? [])
        .filter((source) => source.id !== target.id)
        .sort((a, b) => closeness(b) - closeness(a))
        .slice(0, MAX_PRODUCERS_PER_VARIABLE);
      for (const source of sources) {
        if (!out.has(source.id)) out.set(source.id, { entry: source, supplies: [] });
        out.get(source.id).supplies.push({ variable, forName: target.name });
      }
    }
  }

  return [...out.values()];
}
