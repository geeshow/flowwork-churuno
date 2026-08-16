import React, { useState } from 'react';

import api from '../../api';

/**
 * 브랜치/작업 바 — 편집 모드 상단에 고정.
 *
 * develop(읽기 전용) ↔ feature 브랜치(수정 모드) 전환, feature 브랜치 생성,
 * 커밋/푸시/develop 머지를 현재 브랜치의 worktree에서 수행한다.
 * 머지 충돌이 나면 충돌 해결 화면으로 이동한다.
 */
export function EditBar({ st, files, urlBranch, onSwitchBranch, onOpenMerge, onAction, inMergeView = false, onExit }) {
  const [newBranch, setNewBranch] = useState('');
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const exitBtn = (
    <button className="small" onClick={onExit} title="편집을 끝내고 사용 모드로">
      편집 종료
    </button>
  );

  if (!st) {
    return (
      <div className="edit-bar">
        <span className="muted">편집 상태 불러오는 중…</span>
        <div className="edit-bar-right">{exitBtn}</div>
      </div>
    );
  }

  const isFeature = urlBranch != null;
  const uncommitted = files.filter((f) => f.state === 'unstaged' || f.state === 'staged').length;
  const unmergedCommits = files.filter((f) => f.state === 'committed' || f.state === 'pushed').length;

  const wrap = (op, done) => async () => {
    setBusy(true);
    try {
      await onAction(op, done);
    } finally {
      setBusy(false);
    }
  };

  const doMerge = wrap(async () => {
    const r = await api.editMerge();
    if (r.status === 'conflict') onOpenMerge();
    else onSwitchBranch(null); // 완료 시 브랜치가 정리되므로 develop 뷰로
  });

  return (
    <div className="edit-bar">
      <div className="edit-bar-left">
        <span className={`branch-chip ${isFeature ? 'feature' : 'base'}`}>
          {st.branch}
          {isFeature ? ' (수정 모드)' : ' (읽기 전용)'}
        </span>
        <select
          value={urlBranch ?? st.base_branch}
          disabled={busy}
          onChange={(e) => {
            const v = e.target.value;
            onSwitchBranch(v === st.base_branch ? null : v);
          }}
          title="브랜치 전환 (브랜치마다 전용 worktree)"
        >
          <option value={st.base_branch}>{st.base_branch}</option>
          {st.feature_branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
          {urlBranch && !st.feature_branches.includes(urlBranch) && urlBranch !== st.base_branch ? (
            <option value={urlBranch}>{urlBranch}</option>
          ) : null}
        </select>

        {!isFeature ? (
          <span className="edit-newbranch">
            <input
              placeholder="새 feature 브랜치 이름"
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
            />
            <button
              className="primary small"
              disabled={busy || !newBranch.trim()}
              onClick={wrap(async () => {
                const r = await api.editCreateBranch(newBranch.trim());
                setNewBranch('');
                onSwitchBranch(r.branch); // 수정 모드 진입
              })}
            >
              수정 모드 시작
            </button>
          </span>
        ) : null}
      </div>

      <div className="edit-bar-right">
        {st.in_merge ? (
          <>
            <span className="merge-warn">⚠ {st.base_branch} 머지 충돌 해결 필요</span>
            {!inMergeView ? (
              <button className="primary small" onClick={onOpenMerge}>
                충돌 해결 →
              </button>
            ) : null}
          </>
        ) : null}
        {isFeature ? (
          <>
            <span className="muted">
              변경 {uncommitted}건 · 커밋됨 {unmergedCommits}건
            </span>
            {commitOpen ? (
              <span className="edit-commit-form">
                <input placeholder="커밋 메시지" value={commitMsg} autoFocus onChange={(e) => setCommitMsg(e.target.value)} />
                <button
                  className="primary small"
                  disabled={busy || !commitMsg.trim()}
                  onClick={wrap(async () => {
                    await api.editCommit(commitMsg.trim(), true);
                    setCommitMsg('');
                    setCommitOpen(false);
                  }, '커밋했습니다')}
                >
                  커밋
                </button>
                <button className="link" onClick={() => setCommitOpen(false)}>
                  취소
                </button>
              </span>
            ) : (
              <button
                className="small"
                disabled={busy || uncommitted === 0}
                onClick={() => setCommitOpen(true)}
                title="변경 전체를 스테이지하고 커밋"
              >
                커밋…
              </button>
            )}
            <button className="small" disabled={busy} onClick={wrap(() => api.editPush(), '푸시했습니다')}>
              푸시
            </button>
            <button
              className="primary small"
              disabled={busy || st.in_merge || uncommitted > 0 || unmergedCommits === 0}
              title={
                st.in_merge
                  ? '진행 중인 머지를 먼저 완료/중단하세요'
                  : uncommitted > 0
                    ? '커밋되지 않은 변경이 있습니다'
                    : `${st.base_branch}에 머지`
              }
              onClick={doMerge}
            >
              {st.base_branch}에 머지
            </button>
          </>
        ) : null}
        {exitBtn}
      </div>
    </div>
  );
}

export default EditBar;
