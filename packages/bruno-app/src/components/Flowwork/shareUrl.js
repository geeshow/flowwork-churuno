// 실행 이력 공유 링크 — 해시 라우팅(#/flowwork/executions/<id>)이라 정적 서빙을 그대로 탄다.

export const executionHash = (executionId) => `#/flowwork/executions/${encodeURIComponent(executionId)}`;

export const executionShareUrl = (executionId) =>
  `${window.location.origin}${window.location.pathname}${executionHash(executionId)}`;
