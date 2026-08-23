/**
 * 카탈로그·저장된 작업을 프롬프트에 실을 글로 바꾸고, 모델이 돌려준 참조를 실재하는
 * 항목으로 확인하는 자리.
 *
 * 프롬프트를 짜는 쪽(제안·마법사)과 모델의 질의에 답하는 쪽이 같은 표기를 써야
 * 모델이 본 이름 그대로 되물을 수 있어, 표기를 여기 한곳에 모아 둔다.
 */

export const normalize = (text) => String(text ?? '').normalize('NFC').trim().toLowerCase();

export const matches = (haystack, needle) => normalize(haystack).includes(normalize(needle));

export const section = (title, lines) => `## ${title}\n${lines.length ? lines.join('\n') : '(없음)'}`;

export const catalogLine = (entry) =>
  [
    `${entry.department}/${[...entry.itemPath, entry.name].join('/')}`,
    `${entry.method} ${entry.url}`
  ].join(' | ');

export const catalogDetail = (entry) =>
  [
    catalogLine(entry),
    `  변수: ${entry.variables?.join(', ') || '없음'}`,
    `  출력: ${(entry.outputFields ?? []).join(', ') || '없음'}`
  ].join('\n');

export const workflowLine = (workflow) =>
  `${workflow.domain}/${workflow.task}/${workflow.name} (id: ${workflow.id})${
    workflow.description ? ` — ${workflow.description}` : ''
  }`;

export const stepLine = (step, index) => {
  const kind = step.kind ?? (step.workflowBinding ? '업무 연결' : step.delayBinding ? '지연' : 'API');
  const api = step.apiBinding?.catalogEntry?.name;
  return `  ${index + 1}. [${kind}] ${step.name}${api ? ` — ${api}` : ''}${step.parentId ? ' (블록 안)' : ''}`;
};

/** 응답의 API 참조를 카탈로그의 실재하는 항목으로 확인한다 — 못 찾으면 null. */
export function resolveEntry(entries, ref) {
  if (!ref?.name) return null;
  const name = normalize(ref.name);
  const path = normalize([ref.department, ...(ref.itemPath ?? [])].join('/'));
  const byName = entries.filter((e) => normalize(e.name) === name);
  if (byName.length === 1) return byName[0];
  return byName.find((e) => normalize([e.department, ...e.itemPath].join('/')) === path) ?? byName[0] ?? null;
}

export const catalogEntryOf = (entry) => ({
  department: entry.department,
  collectionFile: entry.collectionFile,
  itemPath: entry.itemPath,
  name: entry.name
});
