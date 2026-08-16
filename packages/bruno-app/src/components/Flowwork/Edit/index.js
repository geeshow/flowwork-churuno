import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import api, { setEditBranch } from '../api';
import { colorForDomain } from '../domainPalette';
import WorkflowEditor from '../editor/WorkflowEditor';
import WorkflowLayout from '../WorkflowLayout';
import WorkflowRunner from '../WorkflowRunner';
import EditBar from './EditBar';
import MergeView from './MergeView';

export const FILE_STATE_META = {
  unstaged: { label: '수정됨', cls: 'st-unstaged' },
  staged: { label: '스테이지', cls: 'st-staged' },
  committed: { label: '커밋됨', cls: 'st-committed' },
  pushed: { label: '푸시됨', cls: 'st-pushed' }
};

// 상태 우선순위 (업무 단위 집계 시 가장 앞선 것 표시)
const STATE_PRIORITY = ['unstaged', 'staged', 'committed', 'pushed'];

const CHANGE_LABEL = { A: '추가', M: '수정', D: '삭제' };

/**
 * 편집 모드 — flowwork 원본의 워크플로우 편집 반영 단계.
 *
 * - 브랜치마다 전용 worktree를 두어 여러 브랜치를 동시에 편집한다 (branch=null은 develop)
 * - develop 뷰는 읽기 전용, 등록/수정은 feature 브랜치(수정 모드)에서만
 * - 저장은 그 브랜치 worktree에 쓰인다 — 커밋 전 변경은 브랜치별로 독립 보존
 * - 파일 상태: develop 대비 수정됨(unstaged) → 스테이지 → 커밋됨 → 푸시됨
 * - develop 머지(충돌 시 해결 화면, 완료 시 브랜치 정리) → develop → main 운영 반영
 */
export function EditPage({ branch, page, go, onExit, onOpenExecution }) {
  // 이 렌더 트리의 모든 edit 소스 API 호출에 브랜치를 실어 보낸다
  setEditBranch(branch);

  const [st, setSt] = useState(null);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const bump = useCallback(() => setRefresh((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setEditBranch(branch); // effect 시점에도 확정 (다른 화면에서 돌아온 경우)
    Promise.all([api.editState(), api.editStatus()])
      .then(([s, f]) => {
        if (!alive) return;
        setSt(s);
        setFiles(f.files);
        setError(null);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [refresh, branch]);

  const isFeature = branch != null;
  const canEdit = isFeature && !!st && !error;

  const statusById = useMemo(() => {
    const map = new Map();
    for (const f of files) if (f.kind === 'workflow' && f.id) map.set(f.id, f);
    return map;
  }, [files]);

  // 업무(도메인/업무)별 집계 상태 — 사이드바 업무 배지 (가장 앞선 상태 + 건수)
  const taskStates = useMemo(() => {
    const map = new Map();
    for (const f of files) {
      if (f.kind !== 'workflow' || !f.domain || !f.task) continue;
      const key = `${f.domain.normalize('NFC')}/${f.task.normalize('NFC')}`;
      const cur = map.get(key);
      if (!cur) map.set(key, { state: f.state, count: 1 });
      else {
        cur.count += 1;
        if (STATE_PRIORITY.indexOf(f.state) < STATE_PRIORITY.indexOf(cur.state)) cur.state = f.state;
      }
    }
    return map;
  }, [files]);

  // 도메인별 변경 여부 — 사이드바 도메인(상위 메뉴)의 변경 점 표시
  const changedDomains = useMemo(() => {
    const set = new Set();
    for (const f of files) if (f.kind === 'workflow' && f.domain) set.add(f.domain.normalize('NFC'));
    return set;
  }, [files]);

  async function run(op, done) {
    setError(null);
    setNotice(null);
    try {
      await op();
      if (done) setNotice(done);
      bump();
    } catch (e) {
      setError(e.message);
    }
  }

  const editBar = (inMergeView) => (
    <EditBar
      st={st}
      files={files}
      urlBranch={branch}
      onSwitchBranch={(b) => go(b, { kind: 'home' })}
      onOpenMerge={() => go(null, { kind: 'merge' })}
      onAction={run}
      inMergeView={inMergeView}
      onExit={onExit}
    />
  );

  if (page.kind === 'merge') {
    return (
      <div className="edit-shell">
        {editBar(true)}
        {error ? <div className="error-banner">{error}</div> : null}
        <MergeView
          onDone={() => {
            bump();
            go(null, { kind: 'home' });
          }}
        />
      </div>
    );
  }

  // 편집기(등록/수정)는 레이아웃 없이 전체 폭 사용
  if (page.kind === 'new' || page.kind === 'editWf') {
    if (!isFeature) {
      return (
        <div className="edit-shell">
          {editBar(false)}
          <div className="detail-empty">
            <p className="muted">
              워크플로우 등록/수정은 수정 모드(feature 브랜치)에서만 할 수 있습니다. 상단에서 feature 브랜치를
              만들거나 선택하세요.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="edit-shell">
        {editBar(false)}
        {error ? <div className="error-banner">{error}</div> : null}
        <div className="flowwork-content">
          <WorkflowEditor
            mode={page.kind === 'editWf' ? 'edit' : 'new'}
            id={page.kind === 'editWf' ? page.id : undefined}
            initialDomain={page.kind === 'new' ? page.domain : undefined}
            initialTask={page.kind === 'new' ? page.task : undefined}
            onSaved={(wf) => {
              bump();
              toast.success('워크플로우가 저장되었습니다 (커밋 전 임시 저장)');
              go(branch, { kind: 'run', id: wf.id });
            }}
            onCancel={() => go(branch, { kind: 'home' })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="edit-shell">
      {editBar(false)}
      {error ? <div className="error-banner">{error}</div> : null}
      {notice ? <div className="notice-banner">{notice}</div> : null}
      <WorkflowLayout
        title="편집"
        source="edit"
        refreshKey={`${refresh}:${branch ?? ''}`}
        activeId={page.kind === 'run' ? page.id : undefined}
        activeTask={page.kind === 'task' ? { domain: page.domain, task: page.task } : undefined}
        onOpenTask={(d, t) => go(branch, { kind: 'task', domain: d, task: t })}
        onOpenHome={() => go(branch, { kind: 'home' })}
        action={
          canEdit ? (
            <button className="small" onClick={() => go(branch, { kind: 'new' })}>
              + 새로
            </button>
          ) : undefined
        }
        taskBadge={(domain, task) => {
          const ts = taskStates.get(`${domain}/${task}`);
          if (!ts) return null;
          const meta = FILE_STATE_META[ts.state];
          return (
            <span className={`state-badge sm ${meta.cls}`}>
              {meta.label}
              {ts.count > 1 ? ` ${ts.count}` : ''}
            </span>
          );
        }}
        domainBadge={(domain) =>
          changedDomains.has(domain) ? <span className="domain-dot-changed" title="하위 변경 있음" /> : null}
      >
        {page.kind === 'task' ? (
          <EditTaskDetail
            domain={page.domain}
            task={page.task}
            canEdit={canEdit}
            statusById={statusById}
            refreshKey={`${refresh}:${branch ?? ''}`}
            onRun={(id) => go(branch, { kind: 'run', id })}
            onEdit={(id) => go(branch, { kind: 'editWf', id })}
            onNew={() => go(branch, { kind: 'new', domain: page.domain, task: page.task })}
            onDeleted={bump}
          />
        ) : page.kind === 'run' ? (
          <EditRunDetail
            id={page.id}
            canEdit={canEdit}
            statusById={statusById}
            refreshKey={`${refresh}:${branch ?? ''}`}
            onEdit={(id) => go(branch, { kind: 'editWf', id })}
            onBack={(d, t) => go(branch, { kind: 'task', domain: d, task: t })}
            onOpenExecution={onOpenExecution}
          />
        ) : (
          <EditHome st={st} files={files} isFeature={isFeature} onAction={run} refreshKey={refresh} />
        )}
      </WorkflowLayout>
    </div>
  );
}

// 변경 파일 한 줄 표시 (워크플로우면 이름/위치, 그 외 파일은 경로)
function FileLabel({ file }) {
  if (file.kind === 'workflow') {
    return (
      <>
        <strong>{file.name}</strong>
        <span className="muted"> — {file.domain} / {file.task}</span>
      </>
    );
  }
  if (file.name) {
    return <strong>{file.name}</strong>;
  }
  return <code>{file.path}</code>;
}

// ---------------------------------------------------------------------------
// 홈: 변경 파일 패널 + 운영(main) 미반영 목록 + 운영 반영
// ---------------------------------------------------------------------------
function EditHome({ st, files, isFeature, onAction, refreshKey }) {
  const [pending, setPending] = useState(null);
  const [pendingErr, setPendingErr] = useState(null);
  const [releasing, setReleasing] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .editPending()
      .then((r) => alive && setPending(r.files))
      .catch((e) => alive && setPendingErr(e.message));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  return (
    <section className="edit-home">
      {isFeature ? (
        <div className="panel">
          <h3>
            변경 사항 <span className="hint">({st?.base_branch} 대비 · {files.length}건)</span>
          </h3>
          {files.length === 0 ? (
            <p className="muted">변경이 없습니다. 왼쪽 메뉴에서 워크플로우를 수정하거나 새로 만드세요.</p>
          ) : (
            <div className="edit-file-list">
              {files.map((f) => (
                <div key={f.path} className="edit-file-row">
                  <span className={`change-badge change-${f.change.toLowerCase()}`}>
                    {CHANGE_LABEL[f.change] ?? f.change}
                  </span>
                  <span className="edit-file-name">
                    <FileLabel file={f} />
                  </span>
                  <span className={`state-badge ${FILE_STATE_META[f.state].cls}`}>{FILE_STATE_META[f.state].label}</span>
                  <span className="edit-file-actions">
                    {f.state === 'unstaged' ? (
                      <>
                        <button className="link" onClick={() => void onAction(() => api.editStage([f.path]))}>
                          스테이지
                        </button>
                        <button
                          className="link danger"
                          onClick={() => {
                            if (confirm(`'${f.name ?? f.path}' 변경을 되돌릴까요? 임시 저장이 사라집니다.`)) {
                              void onAction(() => api.editDiscard([f.path]));
                            }
                          }}
                        >
                          되돌리기
                        </button>
                      </>
                    ) : f.state === 'staged' ? (
                      <button className="link" onClick={() => void onAction(() => api.editUnstage([f.path]))}>
                        스테이지 해제
                      </button>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="panel">
          <h3>수정 모드</h3>
          <p className="muted">
            현재 {st?.base_branch} 브랜치(읽기 전용)를 보고 있습니다. 워크플로우를 등록/수정하려면 상단에서 feature
            브랜치를 만들어 수정 모드로 들어가세요. 브랜치마다 전용 작업 공간(worktree)이 있어 여러 명이 서로 다른
            브랜치를 동시에 편집할 수 있습니다.
          </p>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h3>
            운영 미반영{' '}
            <span className="hint">
              ({st?.prod_branch ?? 'main'} 대비 {st?.base_branch ?? 'develop'}의 변경)
            </span>
          </h3>
          {pending && pending.length > 0 && !isFeature && !st?.in_merge ? (
            <button
              className="primary small"
              disabled={releasing}
              onClick={() => {
                if (!confirm(`${st?.base_branch}의 변경 ${pending.length}건을 운영(${st?.prod_branch})에 반영할까요?`)) {
                  return;
                }
                setReleasing(true);
                void onAction(() => api.editRelease(), `운영에 반영했습니다 (${st?.prod_branch} 병합 + push)`).finally(
                  () => setReleasing(false)
                );
              }}
            >
              {releasing ? '반영 중…' : `운영 반영 (${st?.base_branch} → ${st?.prod_branch})`}
            </button>
          ) : null}
        </div>
        {pendingErr ? <div className="error-banner">{pendingErr}</div> : null}
        {!pending ? (
          <p className="muted">불러오는 중…</p>
        ) : pending.length === 0 ? (
          <p className="muted">모든 변경이 운영({st?.prod_branch})에 반영되어 있습니다.</p>
        ) : (
          <div className="edit-file-list">
            {pending.map((f) => (
              <div key={f.path} className="edit-file-row">
                <span className={`change-badge change-${f.change.toLowerCase()}`}>
                  {CHANGE_LABEL[f.change] ?? f.change}
                </span>
                <span className="edit-file-name">
                  <FileLabel file={f} />
                </span>
                <span className="muted small-text">{f.path}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 업무 상세 (편집): 워크플로우 카드 + 상태 배지 + 실행/수정/삭제
// ---------------------------------------------------------------------------
function EditTaskDetail({ domain, task, canEdit, statusById, refreshKey, onRun, onEdit, onNew, onDeleted }) {
  const [rows, setRows] = useState(null);
  const [colors, setColors] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.listWorkflows('edit'), api.getDomainColors('edit')])
      .then(([r, c]) => {
        if (!alive) return;
        setRows(r);
        setColors(c);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!rows) return <p className="muted">불러오는 중…</p>;

  const color = colorForDomain(domain.normalize('NFC'), colors);
  const items = rows.filter(
    (w) => w.domain.normalize('NFC') === domain.normalize('NFC') && w.task.normalize('NFC') === task.normalize('NFC')
  );

  return (
    <section>
      <div className="task-detail-head">
        <div className="crumb">
          <span className="task-bullet lg" style={{ background: color }} />
          <span className="muted">{domain}</span>
          <span className="muted">/</span>
          <h2>{task}</h2>
        </div>
        {canEdit ? (
          <button className="primary small" onClick={onNew}>
            + 새 워크플로우
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="detail-empty">
          <p className="muted">
            이 업무에는 워크플로우가 없습니다.
            {canEdit ? ' "새 워크플로우"로 추가하세요.' : ' 수정 모드에서 추가할 수 있습니다.'}
          </p>
        </div>
      ) : (
        <div className="wf-card-grid">
          {items.map((w) => {
            const stEntry = statusById.get(w.id);
            return (
              <div key={w.id} className="wf-card wf-card-main" style={{ borderLeftColor: color }}>
                <button className="wf-card-open" onClick={() => onRun(w.id)}>
                  <span className="wf-card-title">
                    <span className="task-bullet" style={{ background: color }} />
                    {w.name}
                    {stEntry ? (
                      <span className={`state-badge ${FILE_STATE_META[stEntry.state].cls}`}>
                        {FILE_STATE_META[stEntry.state].label}
                      </span>
                    ) : null}
                  </span>
                  {w.description ? <span className="muted">{w.description}</span> : null}
                </button>
                {canEdit ? (
                  <div className="wf-card-actions">
                    <button className="link small" onClick={() => onEdit(w.id)}>
                      수정
                    </button>
                    <button
                      className="link small danger"
                      onClick={() => {
                        if (confirm(`'${w.name}' 워크플로우를 삭제할까요? (커밋 전까지는 되돌릴 수 있습니다)`)) {
                          api
                            .deleteWorkflow(w.id)
                            .then(onDeleted)
                            .catch((e) => setError(e.message));
                        }
                      }}
                    >
                      삭제
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 실행 상세 (편집): 브랜치 worktree 기준 실행 — 커밋 전 임시 저장 내용으로 동작 확인
// ---------------------------------------------------------------------------
function EditRunDetail({ id, canEdit, statusById, refreshKey, onEdit, onBack, onOpenExecution }) {
  const [wf, setWf] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setWf(null);
    setError(null);
    api
      .getWorkflow(id, 'edit')
      .then((w) => alive && setWf(w))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id, refreshKey]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!wf) return <p className="muted">불러오는 중…</p>;

  const stEntry = statusById.get(wf.id);
  return (
    <>
      <div className="run-topbar">
        <button className="link" onClick={() => onBack(wf.domain, wf.task)}>
          ← {wf.domain} / {wf.task}
        </button>
        <div className="run-actions">
          {stEntry ? (
            <span className={`state-badge ${FILE_STATE_META[stEntry.state].cls}`}>
              {FILE_STATE_META[stEntry.state].label}
            </span>
          ) : null}
          {canEdit ? (
            <button className="link" onClick={() => onEdit(id)}>
              수정 →
            </button>
          ) : null}
        </div>
      </div>
      <WorkflowRunner workflow={wf} source="edit" onOpenExecution={onOpenExecution} />
    </>
  );
}

export default EditPage;
