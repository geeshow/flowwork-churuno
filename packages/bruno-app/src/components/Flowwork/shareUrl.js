// 실행 이력 공유 링크 — 해시 라우팅(#/flowwork/executions/<id>)이라 정적 서빙을 그대로 탄다.

export const executionHash = (executionId) => `#/flowwork/executions/${encodeURIComponent(executionId)}`;

export const executionShareUrl = (executionId) =>
  `${window.location.origin}${window.location.pathname}${executionHash(executionId)}`;

// 작업 화면 공유 링크 — 사용 모드(운영) 기준 주소
export const workflowShareUrl = (id) =>
  `${window.location.origin}${window.location.pathname}#/flowwork/run/${encodeURIComponent(id)}`;

// 편집 공간의 작업 화면
const workflowEditUrl = (id) =>
  `${window.location.origin}${window.location.pathname}#/flowwork/edit/run/${encodeURIComponent(id)}`;

// 짜던 것을 두고 잠깐 다른 작업을 들여다볼 때 새 창으로 여는 주소 — 지금 있는
// 공간(운영/편집)을 그대로 따라간다
export const workflowPopupUrl = (id) =>
  window.location.hash.startsWith('#/flowwork/edit') ? workflowEditUrl(id) : workflowShareUrl(id);

// 업무 화면 공유 링크 — 사용 모드(운영) 기준 주소
export const taskShareUrl = (domain, task) =>
  `${window.location.origin}${window.location.pathname}#/flowwork/t/${encodeURIComponent(domain)}/${encodeURIComponent(task)}`;
