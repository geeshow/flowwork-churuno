import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconTrash, IconUpload } from '@tabler/icons';
import toast from 'react-hot-toast';

import api from '../api';
import ConfirmButton from '../ConfirmButton';
import { colorForDomain } from '../domainPalette';
import HomeGuide from '../HomeGuide';
import WorkflowEditor from '../editor/WorkflowEditor';
import WorkflowLayout from '../WorkflowLayout';
import WorkflowRunner from '../WorkflowRunner';

const CHANGE_LABEL = { A: '추가', M: '수정', D: '삭제' };

/**
 * 편집 모드 — "변경"과 "운영 반영" 두 개념만 노출한다.
 *
 * - 공용 편집 공간에서 수정/추가/삭제하면 저장 즉시 자동 기록된다
 *   (내부의 브랜치/커밋/푸시는 서버가 처리 — 사용자에게 묻지 않는다)
 * - 홈의 변경 목록(운영 대비)에서 작업 단위로 확인하고,
 *   원하는 작업만 골라 운영 반영하거나 운영 버전으로 되돌린다
 */
export function EditPage({ page, go, onExit, onOpenExecution }) {
  const [st, setSt] = useState(null);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const bump = useCallback(() => setRefresh((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    Promise.all([api.editState(), api.editPending()])
      .then(([s, p]) => {
        if (!alive) return;
        setSt(s);
        setPending(p.files);
        setError(null);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [refresh]);

  const files = pending ?? [];

  const statusById = useMemo(() => {
    const map = new Map();
    for (const f of files) if (f.kind === 'workflow' && f.id) map.set(f.id, f);
    return map;
  }, [files]);

  // 업무(도메인/업무)별 변경 건수 — 사이드바 업무 배지
  const taskChanges = useMemo(() => {
    const map = new Map();
    for (const f of files) {
      if (f.kind !== 'workflow' || !f.domain || !f.task) continue;
      const key = `${f.domain.normalize('NFC')}/${f.task.normalize('NFC')}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [files]);

  // 도메인별 변경 여부 — 사이드바 도메인(상위 메뉴)의 변경 점 표시
  const changedDomains = useMemo(() => {
    const set = new Set();
    for (const f of files) if (f.kind === 'workflow' && f.domain) set.add(f.domain.normalize('NFC'));
    return set;
  }, [files]);

  // done: 완료 안내 문구 — 문자열 또는 (op 결과) => 문자열
  async function run(op, done) {
    setError(null);
    setNotice(null);
    try {
      const result = await op();
      if (done) setNotice(typeof done === 'function' ? done(result) : done);
      bump();
    } catch (e) {
      setError(e.message);
    }
  }

  const editBar = (
    <div className="edit-bar">
      <div className="edit-bar-left">
        <span className="branch-chip feature">편집 모드</span>
        <span className="muted">저장하면 바로 기록되고, 운영 반영 전까지 이 화면에만 보입니다.</span>
      </div>
      <div className="edit-bar-right">
        <span className="muted">운영 미반영 {files.length}건</span>
        <button className="small" onClick={onExit} title="편집을 끝내고 사용 모드로">
          편집 종료
        </button>
      </div>
    </div>
  );

  // 편집기(등록/수정)는 레이아웃 없이 전체 폭 사용
  if (page.kind === 'new' || page.kind === 'editWf') {
    return (
      <div className="edit-shell">
        {editBar}
        {error ? <div className="error-banner">{error}</div> : null}
        <div className="flowwork-content">
          <WorkflowEditor
            mode={page.kind === 'editWf' ? 'edit' : 'new'}
            id={page.kind === 'editWf' ? page.id : undefined}
            initialDomain={page.kind === 'new' ? page.domain : undefined}
            initialTask={page.kind === 'new' ? page.task : undefined}
            onSaved={(wf) => {
              bump();
              toast.success('저장되었습니다 — 운영 반영 전까지 편집 공간에만 보입니다');
              go({ kind: 'run', id: wf.id });
            }}
            onCancel={() => go({ kind: 'home' })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="edit-shell">
      {editBar}
      {error ? <div className="error-banner">{error}</div> : null}
      {notice ? <div className="notice-banner">{notice}</div> : null}
      <WorkflowLayout
        title="편집"
        source="edit"
        refreshKey={refresh}
        activeId={page.kind === 'run' ? page.id : undefined}
        activeTask={page.kind === 'task' ? { domain: page.domain, task: page.task } : undefined}
        onOpenTask={(d, t) => go({ kind: 'task', domain: d, task: t })}
        onOpenHome={() => go({ kind: 'home' })}
        action={(
          <button className="small" onClick={() => go({ kind: 'new' })}>
            + 새로
          </button>
        )}
        taskBadge={(domain, task) => {
          const count = taskChanges.get(`${domain}/${task}`);
          if (!count) return null;
          return <span className="state-badge sm st-changed">변경{count > 1 ? ` ${count}` : ''}</span>;
        }}
        domainBadge={(domain) =>
          changedDomains.has(domain) ? <span className="domain-dot-changed" title="하위 변경 있음" /> : null}
      >
        {page.kind === 'task' ? (
          <EditTaskDetail
            domain={page.domain}
            task={page.task}
            statusById={statusById}
            refreshKey={refresh}
            onRun={(id) => go({ kind: 'run', id })}
            onEdit={(id) => go({ kind: 'editWf', id })}
            onNew={() => go({ kind: 'new', domain: page.domain, task: page.task })}
            onDeleted={bump}
          />
        ) : page.kind === 'run' ? (
          <EditRunDetail
            id={page.id}
            statusById={statusById}
            refreshKey={refresh}
            onEdit={(id) => go({ kind: 'editWf', id })}
            onBack={(d, t) => go({ kind: 'task', domain: d, task: t })}
            onOpenExecution={onOpenExecution}
          />
        ) : (
          <EditHome st={st} files={files} loaded={pending != null} onAction={run} />
        )}
      </WorkflowLayout>
    </div>
  );
}

// 변경 종류(추가/수정/삭제) 배지
function ChangeBadge({ change }) {
  if (!change) return null;
  return <span className={`change-badge change-${change.toLowerCase()}`}>{CHANGE_LABEL[change] ?? change}</span>;
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
// 홈: 변경 목록(운영 대비) — 작업 단위 운영 반영 / 작업 삭제
// ---------------------------------------------------------------------------
function EditHome({ st, files, loaded, onAction }) {
  const [busy, setBusy] = useState(false);

  const act = (op, done) => {
    setBusy(true);
    void onAction(op, done).finally(() => setBusy(false));
  };

  return (
    <section className="edit-home">
      <div className="panel work-panel">
        <div className="panel-head">
          <h3>
            변경 목록 <span className="hint">(운영 {st?.prod_branch ?? 'main'} 대비 · {files.length}건)</span>
          </h3>
          {files.length > 1 ? (
            <ConfirmButton
              className="primary small"
              disabled={busy}
              confirmLabel={`${files.length}건 모두 운영 반영 — 확정`}
              onConfirm={() =>
                act(() => api.editRelease(files.map((f) => f.path)), '모든 변경을 운영에 반영했습니다')}
            >
              <IconUpload size={14} strokeWidth={1.5} />
              전체 운영 반영
            </ConfirmButton>
          ) : null}
        </div>
        {!loaded ? (
          <p className="muted">불러오는 중…</p>
        ) : files.length === 0 ? (
          <p className="muted">
            운영에 반영할 변경이 없습니다. 왼쪽 메뉴에서 워크플로우를 수정하거나 새로 만드세요 — 저장하면 여기에
            나타납니다.
          </p>
        ) : (
          <div className="edit-file-list">
            {files.map((f) => (
              <div key={f.path} className="edit-file-row">
                <ChangeBadge change={f.change} />
                <span className="edit-file-name">
                  <FileLabel file={f} />
                </span>
                <span className="edit-file-actions">
                  <ConfirmButton
                    className="link"
                    disabled={busy}
                    confirmLabel="운영 반영 — 확정"
                    onConfirm={() =>
                      act(() => api.editRelease([f.path]), `'${f.name ?? f.path}'을(를) 운영에 반영했습니다`)}
                  >
                    <IconUpload size={14} strokeWidth={1.5} />
                    운영 반영
                  </ConfirmButton>
                  <ConfirmButton
                    className="link danger"
                    disabled={busy}
                    confirmLabel="작업 내용 삭제 — 확정"
                    title="편집한 작업 내용이 삭제되고 운영 버전으로 복원됩니다 (복구 불가)"
                    onConfirm={() =>
                      act(() => api.editRevert([f.path]), `'${f.name ?? f.path}' 작업 내용을 삭제하고 운영 버전으로 복원했습니다`)}
                  >
                    <IconTrash size={14} strokeWidth={1.5} />
                    작업 삭제
                  </ConfirmButton>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <HomeGuide />
    </section>
  );
}

// ---------------------------------------------------------------------------
// 업무 상세 (편집): 워크플로우 카드 + 변경 배지 + 실행/수정/삭제
// ---------------------------------------------------------------------------
function EditTaskDetail({ domain, task, statusById, refreshKey, onRun, onEdit, onNew, onDeleted }) {
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
        <button className="primary small" onClick={onNew}>
          + 새 워크플로우
        </button>
      </div>

      {items.length === 0 ? (
        <div className="detail-empty">
          <p className="muted">이 업무에는 워크플로우가 없습니다. "새 워크플로우"로 추가하세요.</p>
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
                    <ChangeBadge change={stEntry?.change} />
                  </span>
                  {w.description ? <span className="muted">{w.description}</span> : null}
                </button>
                <div className="wf-card-actions">
                  <button className="link small" onClick={() => onEdit(w.id)}>
                    수정
                  </button>
                  <ConfirmButton
                    className="link small danger"
                    confirmLabel="삭제 확정"
                    title="운영 반영 전까지는 변경 목록에서 원복할 수 있습니다"
                    onConfirm={() =>
                      api
                        .deleteWorkflow(w.id)
                        .then(onDeleted)
                        .catch((e) => setError(e.message))}
                  >
                    삭제
                  </ConfirmButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 실행 상세 (편집): 편집 공간 기준 실행 — 운영 반영 전 내용으로 동작 확인
// ---------------------------------------------------------------------------
function EditRunDetail({ id, statusById, refreshKey, onEdit, onBack, onOpenExecution }) {
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
          <ChangeBadge change={stEntry?.change} />
          <button className="link" onClick={() => onEdit(id)}>
            수정 →
          </button>
        </div>
      </div>
      <WorkflowRunner workflow={wf} source="edit" onOpenExecution={onOpenExecution} />
    </>
  );
}

export default EditPage;
