/**
 * flowwork 백엔드(/api/flowwork/*, web-server/flowwork.py) HTTP 클라이언트.
 * 워크플로우가 참조하는 API 카탈로그는 bruno repo main 브랜치의 .bru 기준이다.
 *
 * 데이터 소스: prod(운영 main 트리, 읽기 전용) | edit(공용 편집 worktree).
 * 등록/수정/삭제는 항상 edit 소스로 보내고(서버가 prod 쓰기를 403으로 거부),
 * 편집 저장은 서버가 즉시 자동 기록(커밋+push)한다. 운영 반영/작업 삭제는
 * 작업(파일) 단위로 edit* 메서드를 쓴다.
 *
 * 예외는 문서(Docs)다 — 동작이 아니라 설명이라 prod 소스로도 저장할 수 있고,
 * 서버가 운영에 바로 기록한다 (setWorkflowDocs / setTaskDocs).
 */
import { serverBaseUrl } from '../../../web-ipc/server-api';

// 동일 워크플로우 동시 저장 충돌 (낙관적 잠금) — 조회 이후 다른 사용자가 저장/삭제함
export class VersionConflictError extends Error {
  constructor(message, currentVersion) {
    super(message);
    this.name = 'VersionConflictError';
    this.currentVersion = currentVersion;
  }
}

const request = async (path, options = {}) => {
  const res = await fetch(`${serverBaseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch (_ignored) {
      // non-JSON error body — keep statusText
    }
    if (detail && typeof detail === 'object' && detail.code === 'version_conflict') {
      throw new VersionConflictError(detail.message || '저장 충돌', detail.current_version ?? null);
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return res.json();
};

const get = (path) => request(path);
const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });
const put = (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) });

// source가 edit일 때만 ?source=edit 쿼리를 만든다 (prod는 빈 문자열)
const src = (source) => (source === 'edit' ? '?source=edit' : '');

// 쓰기 기본값은 서버 쪽이 edit이라, 운영에 쓰는 문서 저장은 소스를 명시해야 한다
const writeSrc = (source) => `?source=${source === 'edit' ? 'edit' : 'prod'}`;

// 업무는 하위 업무를 가질 수 있다 — '/'는 계층 구분이므로 마디마다 따로 인코딩한다
const taskPath = (domain, task) =>
  [domain, ...task.split('/')].map(encodeURIComponent).join('/');

const api = {
  listTasks: (source) => get(`/api/flowwork/tasks${src(source)}`).then((r) => r.tasks),

  createTask: (domain, task) => post('/api/flowwork/tasks?source=edit', { domain, task }),

  renameTask: (domain, task, next) => put(`/api/flowwork/tasks/${taskPath(domain, task)}?source=edit`, next),

  copyTask: (domain, task, next) => post(`/api/flowwork/tasks/${taskPath(domain, task)}/copy?source=edit`, next),

  deleteTask: (domain, task) =>
    request(`/api/flowwork/tasks/${taskPath(domain, task)}?source=edit`, { method: 'DELETE' }),

  getTaskDocs: (domain, task, source) =>
    get(`/api/flowwork/tasks/${taskPath(domain, task)}/docs${src(source)}`).then((r) => r.docs),
  // 문서는 운영(prod)에서도 저장할 수 있다 — 서버가 main에 바로 기록한다
  setTaskDocs: (domain, task, docs, source) =>
    put(`/api/flowwork/tasks/${taskPath(domain, task)}/docs${writeSrc(source)}`, { docs }),

  listWorkflows: (source) => get(`/api/flowwork/workflows${src(source)}`).then((r) => r.workflows),
  getWorkflow: (id, source) => get(`/api/flowwork/workflows/${encodeURIComponent(id)}${src(source)}`),
  // 등록/수정/삭제는 편집 worktree에서만 가능 (서버가 prod 쓰기를 403으로 거부)
  saveWorkflow: (wf, { force = false } = {}) =>
    put(`/api/flowwork/workflows/${encodeURIComponent(wf.id)}${src('edit')}${force ? '&force=true' : ''}`, wf),
  // 문서만 저장 — 나머지는 건드리지 않으므로 운영(prod)에서도 열려 있다
  setWorkflowDocs: (id, docs, source) =>
    put(`/api/flowwork/workflows/${encodeURIComponent(id)}/docs${writeSrc(source)}`, { docs }),
  deleteWorkflow: (id) =>
    request(`/api/flowwork/workflows/${encodeURIComponent(id)}${src('edit')}`, { method: 'DELETE' }),

  searchCatalog: (q = '') => get(`/api/flowwork/catalog/search?q=${encodeURIComponent(q)}`),
  getEnvironments: () => get('/api/flowwork/catalog/environments').then((r) => r.values),

  getDomainColors: (source) => get(`/api/flowwork/domains${src(source)}`).then((r) => r.colors),
  setDomainColor: (domain, color) =>
    put(`/api/flowwork/domains/${encodeURIComponent(domain)}${src('edit')}`, { color }),

  listExecutions: () => get('/api/flowwork/executions').then((r) => r.executions),
  getExecution: (id) => get(`/api/flowwork/executions/${encodeURIComponent(id)}`),
  // 실행에 사용된 입력값을 이력에 기록 (서버가 비밀번호 등 리댁션)
  recordExecutionInputs: (id, values, workflowId) =>
    post(`/api/flowwork/executions/${encodeURIComponent(id)}/inputs`, { values, workflow_id: workflowId }),

  // ---- 편집(git) — 변경 목록 · 작업 단위 운영 반영/작업 삭제 ----
  editState: () => get('/api/flowwork/edit/state'),
  // 운영(main)에 아직 반영되지 않은 변경 목록
  editPending: () => get('/api/flowwork/edit/pending'),
  // 선택한 작업(파일)들만 운영에 반영 + push
  editRelease: (paths) => post('/api/flowwork/edit/release', { paths }),
  // 작업 삭제: 선택한 작업(파일)들의 편집 내용을 지우고 운영 버전으로 복원
  editRevert: (paths) => post('/api/flowwork/edit/revert', { paths }),

  // 실행 이력에 남기지 않는 보조 호출 (API_COMBO 옵션 조회 / DEPENDENT_LOOKUP)
  invoke: (req) =>
    post('/api/flowwork/proxy', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body ?? null
    }),

  proxy: ({ execution_id, step_id, workflow_id, request: req }) =>
    post('/api/flowwork/proxy', {
      execution_id,
      step_id,
      workflow_id,
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body ?? null
    })
};

export default api;
