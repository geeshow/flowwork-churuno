// 실행 이력 공유 링크 — 해시 라우팅(#/flowwork/executions/<id>)이라 정적 서빙을 그대로 탄다.

export const executionHash = (executionId) => `#/flowwork/executions/${encodeURIComponent(executionId)}`;

export const executionShareUrl = (executionId) =>
  `${window.location.origin}${window.location.pathname}${executionHash(executionId)}`;

// 작업 화면 공유 링크 — 사용 모드(운영) 기준 주소
export const workflowShareUrl = (id) =>
  `${window.location.origin}${window.location.pathname}#/flowwork/run/${encodeURIComponent(id)}`;

// 업무 화면 공유 링크 — 사용 모드(운영) 기준 주소
export const taskShareUrl = (domain, task) =>
  `${window.location.origin}${window.location.pathname}#/flowwork/t/${encodeURIComponent(domain)}/${encodeURIComponent(task)}`;
