import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconPencil, IconPlus, IconTrash, IconUpload } from '@tabler/icons';
import toast from 'react-hot-toast';

import api from '../api';
import ConfirmButton from '../ConfirmButton';
import FolderScreen from '../FolderScreen';
import HomeGuide from '../HomeGuide';
import NamePrompt from '../NamePrompt';
import TaskMenu from '../TaskMenu';
import TopBar from '../TopBar';
import { taskShareUrl, workflowShareUrl } from '../shareUrl';
import WorkflowEditor from '../editor/WorkflowEditor';
import WorkflowLayout from '../WorkflowLayout';
import WorkflowScreen from '../WorkflowScreen';
import WorkflowTabs, { folderKey, useWorkflowTabs, workflowKey } from '../WorkflowTabs';

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
  // Copy/Paste용 앱 내 클립보드 (브라우저 클립보드는 텍스트만 담는다).
  // { kind: 'task' | 'workflow', ... } — 붙여넣기 쪽에서 무엇을 복사했는지 알아야 한다.
  const [clipboard, setClipboard] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [fileMode, setFileMode] = useState(false);
  const bump = useCallback(() => setRefresh((n) => n + 1), []);
  const activeId = page.kind === 'run' ? page.id : undefined;
  const activeKey
    = page.kind === 'run'
      ? workflowKey(page.id)
      : page.kind === 'task'
        ? folderKey(page.domain, page.task)
        : undefined;
  const openTab = useCallback(
    (tab) => go(tab.kind === 'folder' ? { kind: 'task', domain: tab.domain, task: tab.task } : { kind: 'run', id: tab.id }),
    [go]
  );
  const { tabs, close } = useWorkflowTabs({
    source: 'edit',
    activeKey,
    refreshKey: refresh,
    onSelect: openTab,
    onCloseLast: () => go({ kind: 'home' })
  });

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

  // 변경이 있는 업무(도메인/업무) — 사이드바에서 불릿 대신 U로 표시한다.
  // 업무 자체가 새로 생긴 것(kind: task)도 아직 운영에 없는 변경이다.
  const changedTasks = useMemo(() => {
    const set = new Set();
    for (const f of files) {
      if (!f.domain || !f.task) continue;
      set.add(`${f.domain.normalize('NFC')}/${f.task.normalize('NFC')}`);
    }
    return set;
  }, [files]);

  // 도메인별 변경 여부 — 사이드바 도메인(상위 메뉴)의 변경 점 표시
  const changedDomains = useMemo(() => {
    const set = new Set();
    for (const f of files) if (f.domain) set.add(f.domain.normalize('NFC'));
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
        workspace={st?.base_branch}
        source="edit"
        refreshKey={refresh}
        activeId={activeId}
        activeTask={page.kind === 'task' ? { domain: page.domain, task: page.task } : undefined}
        onOpenTask={(d, t) => go({ kind: 'task', domain: d, task: t })}
        onOpenWorkflow={(id) => go({ kind: 'run', id })}
        onOpenHome={() => go({ kind: 'home' })}
        taskChanged={(domain, task) => changedTasks.has(`${domain}/${task}`)}
        workflowChanged={(id) => statusById.has(id)}
        domainBadge={(domain) =>
          changedDomains.has(domain) ? <span className="domain-dot-changed" title="하위 변경 있음" /> : null}
        taskMenu={(domain, task) => (
          <TaskMenu
            items={taskMenuItems({
              domain,
              task,
              clipboard,
              setClipboard,
              go,
              prompt: setPrompt,
              onError: setError,
              onDone: bump
            })}
          />
        )}
        domainMenu={(domain) => (
          <TaskMenu
            items={domainMenuItems({
              domain,
              clipboard,
              prompt: setPrompt,
              onError: setError,
              onDone: bump
            })}
          />
        )}
        workflowMenu={(workflow) => (
          <TaskMenu
            items={workflowMenuItems({
              workflow,
              setClipboard,
              go,
              prompt: setPrompt,
              onError: setError,
              onDone: bump
            })}
          />
        )}
      >
        <TopBar
          workspace={st?.base_branch}
          crumbs={crumbsFor(page, tabs)}
          changeCount={files.length}
          fileMode={fileMode}
          onToggleFileMode={page.kind === 'run' ? () => setFileMode((on) => !on) : undefined}
          onOpenRelease={() => go({ kind: 'home' })}
        />
        <WorkflowTabs
          tabs={tabs}
          activeKey={activeKey}
          changed={(tab) => (tab.kind === 'folder' ? changedTasks.has(`${tab.domain}/${tab.task}`) : statusById.has(tab.id))}
          onSelect={openTab}
          onClose={close}
        />
        {page.kind === 'task' ? (
          <FolderScreen
            domain={page.domain}
            task={page.task}
            source="edit"
            tab={page.tab ?? 'overview'}
            onTabChange={(tab) => go({ kind: 'task', domain: page.domain, task: page.task, tab })}
            refreshKey={refresh}
            onOpenWorkflow={(id) => go({ kind: 'run', id })}
            onNewWorkflow={() => go({ kind: 'new', domain: page.domain, task: page.task })}
          />
        ) : page.kind === 'run' ? (
          <WorkflowScreen
            id={page.id}
            source="edit"
            tab={page.tab ?? 'run'}
            onTabChange={(tab) => go({ kind: 'run', id: page.id, tab })}
            refreshKey={refresh}
            changed={statusById.has(page.id)}
            fileMode={fileMode}
            onEdit={(id) => go({ kind: 'editWf', id })}
            onDelete={(wf) => (
              <ConfirmButton
                className="link small danger"
                confirmLabel="삭제 확정"
                title="운영 반영 전까지는 변경 목록에서 원복할 수 있습니다"
                onConfirm={() =>
                  api
                    .deleteWorkflow(wf.id)
                    .then(() => {
                      bump();
                      go({ kind: 'home' });
                    })
                    .catch((e) => setError(e.message))}
              >
                <IconTrash size={14} strokeWidth={1.5} />
                삭제
              </ConfirmButton>
            )}
            onSaved={bump}
            onOpenExecution={onOpenExecution}
          />
        ) : (
          <EditHome st={st} files={files} loaded={pending != null} onAction={run} />
        )}
      </WorkflowLayout>
      {prompt ? (
        <NamePrompt
          {...prompt}
          onSubmit={(name) => {
            setPrompt(null);
            prompt.onSubmit(name);
          }}
          onCancel={() => setPrompt(null)}
        />
      ) : null}
    </div>
  );
}

// 머리띠 브레드크럼 — 지금 열려 있는 화면의 위치를 컬렉션부터 늘어놓는다
function crumbsFor(page, tabs) {
  if (page.kind === 'task') return [page.domain, ...page.task.split('/')];
  if (page.kind === 'run') {
    const tab = tabs.find((t) => t.kind === 'workflow' && t.id === page.id);
    return tab ? [tab.domain, ...tab.task.split('/'), tab.name] : [];
  }
  return ['변경 목록'];
}

// 업무 경로("개설/신규")에서 표시용 이름과 형제·자식 경로를 만든다
const taskLeaf = (task) => task.slice(task.lastIndexOf('/') + 1);
const siblingTask = (task, name) => {
  const cut = task.lastIndexOf('/');
  return cut < 0 ? name : `${task.slice(0, cut)}/${name}`;
};

// 이름을 받아야 하는 동작은 대화상자를 띄운 뒤 이어서 실행한다 (window.prompt는 웹뷰에서 막힌다)
const nameAsker = ({ prompt, onError, onDone }) => ({ title, label, initial, submitLabel, action }) =>
  prompt({
    title,
    label,
    initial,
    submitLabel,
    onSubmit: (name) => action(name).then(onDone).catch((e) => onError(e.message))
  });

// 클립보드에 담긴 것을 이 폴더 안으로 붙여넣는다 (업무 통째로 / 작업 하나).
// 붙여넣기 자리가 도메인 바로 밑이면 task는 새 업무 이름이 된다.
const pasteInto = (clipboard, { domain, task }) => {
  const label = clipboard.kind === 'workflow' ? clipboard.name : taskLeaf(clipboard.task);
  const action = (name) =>
    clipboard.kind === 'workflow'
      ? copyWorkflow(clipboard.id, { domain, task, name })
      : api.copyTask(clipboard.domain, clipboard.task, { domain, task: task ? `${task}/${name}` : name });
  return {
    id: 'paste',
    label: `Paste (${label})`,
    ask: {
      label: clipboard.kind === 'workflow' ? '작업 이름' : '업무 이름',
      initial: label,
      submitLabel: '붙여넣기',
      action
    }
  };
};

// 작업 복제 — 서버에는 복사 API가 없고, 새 id로 저장하면 그것이 곧 사본이다.
// version은 낙관적 잠금 값이라 새 파일에 실어 보내면 "삭제됨"으로 거절당한다.
async function copyWorkflow(id, { domain, task, name }) {
  const source = await api.getWorkflow(id, 'edit');
  const { version: _ignored, ...copy } = source;
  return api.saveWorkflow({ ...copy, id: crypto.randomUUID(), domain, task, name });
}

// 작업(워크플로우) "..." 메뉴 — 폴더 메뉴와 같은 구성에서 작업에 없는 것만 뺐다
function workflowMenuItems({ workflow, setClipboard, go, prompt, onError, onDone }) {
  const askName = nameAsker({ prompt, onError, onDone });
  const { id, name, domain, task } = workflow;

  return [
    {
      id: 'rename',
      label: 'Rename',
      onClick: () =>
        askName({
          title: `'${name}' 이름 변경`,
          label: '작업 이름',
          initial: name,
          submitLabel: '변경',
          action: async (next) => {
            const wf = await api.getWorkflow(id, 'edit');
            return api.saveWorkflow({ ...wf, name: next });
          }
        })
    },
    {
      id: 'clone',
      label: 'Clone',
      title: '같은 폴더에 사본을 만듭니다',
      onClick: () =>
        askName({
          title: `'${name}' 복제`,
          label: '새 작업 이름',
          initial: `${name} copy`,
          submitLabel: '복제',
          action: (next) => copyWorkflow(id, { domain, task, name: next })
        })
    },
    {
      id: 'copy',
      label: 'Copy',
      onClick: () => setClipboard({ kind: 'workflow', id, name })
    },
    {
      id: 'share',
      label: 'Share',
      title: '이 작업 화면 링크를 복사합니다',
      onClick: () =>
        navigator.clipboard
          .writeText(workflowShareUrl(id))
          .then(() => toast.success('링크를 복사했습니다'))
          .catch(() => onError('링크를 복사하지 못했습니다'))
    },
    {
      id: 'delete',
      label: 'Delete',
      danger: true,
      title: '운영 반영 전까지는 변경 목록에서 원복할 수 있습니다',
      onClick: () =>
        api
          .deleteWorkflow(id)
          .then(() => {
            onDone();
            go({ kind: 'home' });
          })
          .catch((e) => onError(e.message))
    }
  ];
}

// 도메인 "..." 메뉴 — 도메인 바로 아래(최상위) 업무를 만든다.
// 하위 업무는 업무 메뉴의 New Folder로 만든다.
function domainMenuItems({ domain, clipboard, prompt, onError, onDone }) {
  const askName = nameAsker({ prompt, onError, onDone });

  return [
    {
      id: 'newFolder',
      label: 'New Folder',
      onClick: () =>
        askName({
          title: `'${domain}'에 새 업무`,
          label: '업무 이름',
          submitLabel: '만들기',
          action: (name) => api.createTask(domain, name)
        })
    },
    ...(clipboard && clipboard.kind === 'task'
      ? [pasteItem(clipboard, { domain, task: '' }, domain, askName)]
      : [])
  ];
}

// 붙여넣기 항목 — 담긴 것과 붙일 자리는 pasteInto가 정하고, 여기선 대화상자만 붙인다
function pasteItem(clipboard, target, targetLabel, askName) {
  const { id, label, ask } = pasteInto(clipboard, target);
  return {
    id,
    label,
    onClick: () => askName({ title: `'${targetLabel}'에 붙여넣기`, ...ask })
  };
}

// 업무(폴더) "..." 메뉴 구성 — Bruno 사이드바 항목 메뉴와 같은 순서.
// New Folder와 Paste는 이 업무의 하위 업무를 만든다.
function taskMenuItems({ domain, task, clipboard, setClipboard, go, prompt, onError, onDone }) {
  const askName = nameAsker({ prompt, onError, onDone });
  const leaf = taskLeaf(task);

  return [
    {
      id: 'newWorkflow',
      label: 'New Workflow',
      onClick: () => go({ kind: 'new', domain, task })
    },
    {
      id: 'newFolder',
      label: 'New Folder',
      title: '이 업무 안에 하위 업무를 만듭니다',
      onClick: () =>
        askName({
          title: `'${leaf}' 안에 하위 업무`,
          label: '업무 이름',
          submitLabel: '만들기',
          action: (name) => api.createTask(domain, `${task}/${name}`)
        })
    },
    {
      id: 'clone',
      label: 'Clone',
      title: '업무와 그 안의 워크플로우·하위 업무를 통째로 복제합니다',
      onClick: () =>
        askName({
          title: `'${leaf}' 복제`,
          label: '새 업무 이름',
          initial: `${leaf} copy`,
          submitLabel: '복제',
          action: (name) => api.copyTask(domain, task, { domain, task: siblingTask(task, name) })
        })
    },
    {
      id: 'copy',
      label: 'Copy',
      onClick: () => setClipboard({ kind: 'task', domain, task })
    },
    // Copy 해 둔 것이 있을 때만 붙인다 (Bruno도 같은 방식)
    ...(clipboard ? [pasteItem(clipboard, { domain, task }, leaf, askName)] : []),
    {
      id: 'rename',
      label: 'Rename',
      onClick: () =>
        askName({
          title: `'${leaf}' 이름 변경`,
          label: '업무 이름',
          initial: leaf,
          submitLabel: '변경',
          action: (name) => api.renameTask(domain, task, { domain, task: siblingTask(task, name) })
        })
    },
    {
      id: 'share',
      label: 'Share',
      title: '이 업무 화면 링크를 복사합니다',
      onClick: () =>
        navigator.clipboard
          .writeText(taskShareUrl(domain, task))
          .then(() => toast.success('링크를 복사했습니다'))
          .catch(() => onError('링크를 복사하지 못했습니다'))
    },
    {
      id: 'delete',
      label: 'Delete',
      danger: true,
      title: '워크플로우가 없는 업무만 삭제할 수 있습니다',
      onClick: () =>
        api
          .deleteTask(domain, task)
          .then(onDone)
          .catch((e) => onError(e.message))
    }
  ];
}

// 변경 종류(추가/수정/삭제) 배지 — 변경 목록처럼 종류를 구분해야 하는 곳에서 쓴다
function ChangeBadge({ change }) {
  if (!change) return null;
  return <span className={`change-badge change-${change.toLowerCase()}`}>{CHANGE_LABEL[change] ?? change}</span>;
}

// 워크플로우 카드·상세의 표시 — 여기서는 종류보다 "운영과 다르다"는 사실만 알면 된다
function ChangedBadge() {
  return <span className="changed-badge">변경됨</span>;
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

export default EditPage;
