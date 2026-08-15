import React, { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { IconArrowLeft, IconPlus, IconLock, IconDots, IconCategory, IconLogin } from '@tabler/icons';
import toast from 'react-hot-toast';

import { showHomePage } from 'providers/ReduxStore/slices/app';
import { switchWorkspace } from 'providers/ReduxStore/slices/workspaces/actions';

import CreateWorkspace from 'components/WorkspaceSidebar/CreateWorkspace';
import RenameWorkspace from './RenameWorkspace';
import DeleteWorkspace from './DeleteWorkspace';
import CloneWorkspace from './CloneWorkspace';
import StyledWrapper from './StyledWrapper';
import MenuDropdown from 'ui/MenuDropdown/index';
import Button from 'ui/Button';

const ManageWorkspace = () => {
  const dispatch = useDispatch();
  const { workspaces, activeWorkspaceUid } = useSelector((state) => state.workspaces);

  const [createWorkspaceModalOpen, setCreateWorkspaceModalOpen] = useState(false);
  const [renameWorkspaceModal, setRenameWorkspaceModal] = useState({ open: false, workspace: null });
  const [deleteWorkspaceModal, setDeleteWorkspaceModal] = useState({ open: false, workspace: null });
  const [cloneWorkspaceModal, setCloneWorkspaceModal] = useState({ open: false, workspace: null });

  // 워크스페이스 = git 브랜치. parent(분기 기준 브랜치)로 트리를 만들어
  // 어느 워크스페이스에서 갈라져 나왔는지 보여준다. 빈 브랜치로 만든 워크스페이스는
  // 부모가 없으므로 main과 같은 최상위에 놓인다.
  const workspaceRows = useMemo(() => {
    const persisted = workspaces.filter((w) => !w.isCreating);
    const byBranch = new Map(persisted.filter((w) => w.branch).map((w) => [w.branch, w]));
    const childrenOf = new Map();
    const roots = [];
    for (const workspace of persisted) {
      const parent = workspace.parent ? byBranch.get(workspace.parent) : null;
      if (parent && parent.uid !== workspace.uid) {
        if (!childrenOf.has(parent.uid)) childrenOf.set(parent.uid, []);
        childrenOf.get(parent.uid).push(workspace);
      } else {
        roots.push(workspace);
      }
    }
    const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
    roots.sort((a, b) => (a.type === 'default' ? -1 : b.type === 'default' ? 1 : byName(a, b)));
    for (const children of childrenOf.values()) children.sort(byName);

    const rows = [];
    const visited = new Set();
    const walk = (workspace, depth) => {
      if (visited.has(workspace.uid)) return;
      visited.add(workspace.uid);
      rows.push({ workspace, depth });
      for (const child of childrenOf.get(workspace.uid) || []) walk(child, depth + 1);
    };
    roots.forEach((root) => walk(root, 0));
    // 부모 정보가 순환하는 등 트리에 닿지 못한 워크스페이스도 목록에서 빠지지 않게 한다
    for (const workspace of persisted) walk(workspace, 0);
    return rows;
  }, [workspaces]);

  const handleBack = () => {
    dispatch(showHomePage());
  };

  const handleOpenWorkspace = (workspace) => {
    // main(default)은 직접 수정하면 안 되므로 열 수 없다 — Duplicate로 작업 브랜치를 만들어 쓴다
    if (workspace.type === 'default') {
      toast.error('main is read-only — duplicate it into a workspace branch instead');
      return;
    }
    dispatch(switchWorkspace(workspace.uid));
    dispatch(showHomePage());
    toast.success(`Switched to ${workspace.name}`);
  };

  const handleRenameClick = (workspace) => {
    setRenameWorkspaceModal({ open: true, workspace });
  };

  const handleCloseClick = (workspace) => {
    if (workspace.type === 'default') {
      toast.error('Cannot remove the default workspace');
      return;
    }
    setDeleteWorkspaceModal({ open: true, workspace });
  };

  const handleCloneClick = (workspace) => {
    setCloneWorkspaceModal({ open: true, workspace });
  };

  const handleCreateWorkspace = () => {
    setCreateWorkspaceModalOpen(true);
  };

  return (
    <StyledWrapper>
      {createWorkspaceModalOpen && (
        <CreateWorkspace onClose={() => setCreateWorkspaceModalOpen(false)} />
      )}

      {renameWorkspaceModal.open && renameWorkspaceModal.workspace && (
        <RenameWorkspace
          workspace={renameWorkspaceModal.workspace}
          onClose={() => setRenameWorkspaceModal({ open: false, workspace: null })}
        />
      )}

      {deleteWorkspaceModal.open && deleteWorkspaceModal.workspace && (
        <DeleteWorkspace
          workspace={deleteWorkspaceModal.workspace}
          onClose={() => setDeleteWorkspaceModal({ open: false, workspace: null })}
        />
      )}

      {cloneWorkspaceModal.open && cloneWorkspaceModal.workspace && (
        <CloneWorkspace
          workspace={cloneWorkspaceModal.workspace}
          onClose={() => setCloneWorkspaceModal({ open: false, workspace: null })}
        />
      )}

      <div className="manage-workspace-header">
        <div className="header-left">
          <div className="back-button" onClick={handleBack}>
            <IconArrowLeft size={18} strokeWidth={1.5} />
          </div>
          <span className="header-title">Manage Workspace</span>
        </div>
        <Button size="sm" onClick={handleCreateWorkspace} icon={<IconPlus size={14} strokeWidth={2} />}>
          Create Workspace
        </Button>
      </div>

      <div className="workspace-list">
        {workspaceRows.length === 0 ? (
          <div className="empty-state">
            <span>No workspaces found</span>
          </div>
        ) : (
          workspaceRows.map(({ workspace, depth }) => {
            const isDefault = workspace.type === 'default';
            const isActive = workspace.uid === activeWorkspaceUid;

            return (
              <div key={workspace.uid} className="workspace-item" style={{ marginLeft: depth * 26 }}>
                {depth > 0 && <span className="tree-connector">└</span>}
                <div className="workspace-info">
                  <div className="workspace-name-row">
                    <span className={`workspace-icon ${isDefault ? 'default' : 'regular'}`}>
                      {isDefault ? (
                        <IconLock size={14} strokeWidth={1.5} />
                      ) : (
                        <IconCategory size={14} strokeWidth={1.5} />
                      )}
                    </span>
                    <span className="workspace-name">{workspace.name}</span>
                    {workspace.branch && <code className="workspace-branch">{workspace.branch}</code>}
                    {isDefault && <span className="default-badge">Default</span>}
                  </div>
                  {workspace.branchUrl ? (
                    <div className="workspace-path">
                      <a href={workspace.branchUrl} target="_blank" rel="noreferrer">{workspace.branchUrl}</a>
                    </div>
                  ) : workspace.pathname ? (
                    <div className="workspace-path">{workspace.pathname}</div>
                  ) : null}
                </div>

                <div className="workspace-actions">
                  {!isDefault && (
                    <button
                      className="action-btn"
                      onClick={() => handleOpenWorkspace(workspace)}
                    >
                      <IconLogin size={14} strokeWidth={1.5} />
                      <span>Open</span>
                    </button>
                  )}
                  <MenuDropdown
                    placement="bottom-end"
                    items={[
                      { id: 'duplicate', label: 'Duplicate', onClick: () => handleCloneClick(workspace) },
                      ...(isDefault
                        ? []
                        : [
                            { id: 'rename', label: 'Rename', onClick: () => handleRenameClick(workspace) },
                            { id: 'remove', label: 'Remove', onClick: () => handleCloseClick(workspace) }
                          ])
                    ]}
                  >
                    <button className="more-actions-btn">
                      <IconDots size={14} strokeWidth={1.5} />
                    </button>
                  </MenuDropdown>
                </div>
              </div>
            );
          })
        )}
      </div>
    </StyledWrapper>
  );
};

export default ManageWorkspace;
