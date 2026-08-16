/**
 * flowwork 백엔드(/api/flowwork/*, web-server/flowwork.py) HTTP 클라이언트.
 * 워크플로우가 참조하는 API 카탈로그는 bruno repo main 브랜치의 .bru 기준이다.
 *
 * 데이터 소스: prod(운영 main 트리, 읽기 전용) | edit(브랜치별 편집 worktree).
 * 등록/수정/삭제는 항상 edit 소스로 보내고(서버가 prod 쓰기를 403으로 거부),
 * 편집 화면이 setEditBranch로 지정한 브랜치가 edit 요청에 함께 실린다.
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

// 현재 편집 중인 브랜치 (편집 화면이 URL 브랜치로 설정; null = develop).
// 브랜치마다 전용 worktree가 있어 edit 소스 요청에 branch를 함께 보낸다.
let editBranch = null;

export function setEditBranch(branch) {
  editBranch = branch;
}

// source가 edit일 때만 ?source=edit&branch=… 쿼리를 만든다 (prod는 빈 문자열)
const src = (source) => {
  if (source !== 'edit') return '';
  const qs = new URLSearchParams({ source: 'edit' });
  if (editBranch) qs.set('branch', editBranch);
  return `?${qs.toString()}`;
};

const withBranch = (body) => ({ ...body, branch: editBranch });

const api = {
  listWorkflows: (source) => get(`/api/flowwork/workflows${src(source)}`).then((r) => r.workflows),
  getWorkflow: (id, source) => get(`/api/flowwork/workflows/${encodeURIComponent(id)}${src(source)}`),
  // 등록/수정/삭제는 편집 worktree에서만 가능 (서버가 prod 쓰기를 403으로 거부)
  saveWorkflow: (wf, { force = false } = {}) =>
    put(`/api/flowwork/workflows/${encodeURIComponent(wf.id)}${src('edit')}${force ? '&force=true' : ''}`, wf),
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

  // ---- 편집(git) — 브랜치별 worktree의 상태/커밋/머지/충돌 ----
  editState: () => get(`/api/flowwork/edit/state${editBranch ? `?branch=${encodeURIComponent(editBranch)}` : ''}`),
  editStatus: () => get(`/api/flowwork/edit/status${editBranch ? `?branch=${encodeURIComponent(editBranch)}` : ''}`),
  editCreateBranch: (name) => post('/api/flowwork/edit/branches', { name }),
  editStage: (paths) => post('/api/flowwork/edit/stage', withBranch({ paths: paths ?? null })),
  editUnstage: (paths) => post('/api/flowwork/edit/unstage', withBranch({ paths: paths ?? null })),
  editDiscard: (paths) => post('/api/flowwork/edit/discard', withBranch({ paths })),
  editCommit: (message, stageAll = true) =>
    post('/api/flowwork/edit/commit', withBranch({ message, stage_all: stageAll })),
  editPush: () => post('/api/flowwork/edit/push', withBranch({})),
  // 현재 브랜치(worktree)를 develop에 머지 — 완료 시 브랜치/worktree 정리
  editMerge: () => post('/api/flowwork/edit/merge', { branch: editBranch }),
  editConflicts: () => get('/api/flowwork/edit/conflicts'),
  editResolveConflict: (path, content) => post('/api/flowwork/edit/conflicts/resolve', { path, content }),
  editMergeContinue: () => post('/api/flowwork/edit/merge/continue', {}),
  editMergeAbort: () => post('/api/flowwork/edit/merge/abort', {}),
  editPending: () => get('/api/flowwork/edit/pending'),
  // develop → main(운영) 병합 + push
  editRelease: () => post('/api/flowwork/edit/release', {}),

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
