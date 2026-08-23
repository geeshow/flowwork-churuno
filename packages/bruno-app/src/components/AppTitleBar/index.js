import React from 'react';
import { IconCheck, IconChevronDown, IconLock, IconPin, IconPinned, IconPlus, IconDownload, IconSettings } from '@tabler/icons';
import FlowworkLogo from 'components/Icons/FlowworkLogo';
import ApiChainIcon from 'components/Icons/ApiChainIcon';
import { forwardRef, useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';

import { savePreferences, setActiveApp, showManageWorkspacePage, toggleSidebarCollapse } from 'providers/ReduxStore/slices/app';
import { setLocalStorageValue, SIDEBAR_COLLAPSED_KEY } from 'utils/common/localStorage';
import { closeConsole, openConsole } from 'providers/ReduxStore/slices/logs';
import { switchWorkspace } from 'providers/ReduxStore/slices/workspaces/actions';
import { sortWorkspaces, toggleWorkspacePin } from 'utils/workspaces';

import Bruno from 'components/Bruno';
import MenuDropdown from 'ui/MenuDropdown';
import ActionIcon from 'ui/ActionIcon';
import IconSidebarToggle from 'components/Icons/IconSidebarToggle';
import CreateWorkspace from 'components/WorkspaceSidebar/CreateWorkspace';
import ImportWorkspace from 'components/WorkspaceSidebar/ImportWorkspace';

import IconBottombarToggle from 'components/Icons/IconBottombarToggle/index';
import StyledWrapper from './StyledWrapper';
import ResponseLayoutToggle from 'components/ResponsePane/ResponseLayoutToggle';
import { isMacOS, isWindowsOS, isLinuxOS, isWebMode } from 'utils/common/platform';
import classNames from 'classnames';

const getOsClass = () => {
  if (isMacOS()) return 'os-mac';
  if (isWindowsOS()) return 'os-windows';
  if (isLinuxOS()) return 'os-linux';
  return 'os-other';
};

// Helper to get display name for workspace
export const getWorkspaceDisplayName = (name) => {
  if (!name) return 'Untitled Workspace';
  return name;
};

const AppTitleBar = () => {
  const dispatch = useDispatch();
  const osClass = getOsClass();

  // Get workspace info
  const { workspaces, activeWorkspaceUid } = useSelector((state) => state.workspaces);
  const preferences = useSelector((state) => state.app.preferences);
  const sidebarCollapsed = useSelector((state) => state.app.sidebarCollapsed);
  const activeApp = useSelector((state) => state.app.activeApp);
  const isConsoleOpen = useSelector((state) => state.logs.isConsoleOpen);
  const activeWorkspace = workspaces.find((w) => w.uid === activeWorkspaceUid);

  // Sort workspaces according to preferences
  const sortedWorkspaces = useMemo(() => {
    return sortWorkspaces(workspaces, preferences);
  }, [workspaces, preferences]);

  const [createWorkspaceModalOpen, setCreateWorkspaceModalOpen] = useState(false);
  const [importWorkspaceModalOpen, setImportWorkspaceModalOpen] = useState(false);

  const WorkspaceName = forwardRef((props, ref) => {
    return (
      <div ref={ref} className="workspace-name-container" {...props}>
        <span data-testid="workspace-name" className={classNames('workspace-name', { 'italic text-muted': !activeWorkspace?.name })}>{getWorkspaceDisplayName(activeWorkspace?.name)}</span>
        <IconChevronDown size={14} stroke={1.5} className="chevron-icon" />
      </div>
    );
  });

  // 제품명은 제품 소개 홈으로 간다 (activeApp 'home' — 웹에서는 #/home 해시로 미러링)
  const handleBrandClick = () => dispatch(setActiveApp('home'));

  const handleWorkspaceSwitch = (workspaceUid) => {
    if (workspaceUid === activeWorkspaceUid) return;

    dispatch(switchWorkspace(workspaceUid));
    toast.success(`Switched to ${getWorkspaceDisplayName(workspaces.find((w) => w.uid === workspaceUid)?.name)}`);
  };

  const handleCreateWorkspace = useCallback(() => {
    setCreateWorkspaceModalOpen(true);
  }, []);

  const handleManageWorkspaces = () => {
    dispatch(showManageWorkspacePage());
  };

  const handleImportWorkspace = () => {
    setImportWorkspaceModalOpen(true);
  };

  const handlePinWorkspace = useCallback((workspaceUid, e) => {
    e.preventDefault();
    e.stopPropagation();
    const newPreferences = toggleWorkspacePin(workspaceUid, preferences);
    dispatch(savePreferences(newPreferences));
  }, [dispatch, preferences]);

  const handleToggleSidebar = () => {
    dispatch(toggleSidebarCollapse());
    setLocalStorageValue(SIDEBAR_COLLAPSED_KEY, !sidebarCollapsed);
  };

  const handleToggleDevtools = () => {
    if (isConsoleOpen) {
      dispatch(closeConsole());
    } else {
      dispatch(openConsole());
    }
  };

  // Build workspace menu items
  const workspaceMenuItems = useMemo(() => {
    const items = sortedWorkspaces.map((workspace) => {
      const isActive = workspace.uid === activeWorkspaceUid;
      const isPinned = preferences?.workspaces?.pinnedWorkspaceUids?.includes(workspace.uid);
      // 웹 모드의 default 워크스페이스 = main 브랜치. 직접 수정 금지라 전환을 막는다.
      const isReadOnlyMain = isWebMode() && workspace.type === 'default';

      return {
        id: workspace.uid,
        label: getWorkspaceDisplayName(workspace.name),
        onClick: () => handleWorkspaceSwitch(workspace.uid),
        disabled: isReadOnlyMain,
        className: `workspace-item ${isActive ? 'active' : ''}`,
        rightSection: (
          <div className="workspace-actions">
            {isReadOnlyMain && <IconLock size={14} stroke={1.5} />}
            {workspace.type !== 'default' && (
              <ActionIcon
                className={`pin-btn ${isPinned ? 'pinned' : ''}`}
                onClick={(e) => handlePinWorkspace(workspace.uid, e)}
                label={isPinned ? 'Unpin workspace' : 'Pin workspace'}
                size="sm"
              >
                {isPinned ? <IconPinned size={14} stroke={1.5} /> : <IconPin size={14} stroke={1.5} />}
              </ActionIcon>
            )}
            {isActive && <IconCheck size={16} stroke={1.5} className="check-icon" />}
          </div>
        )
      };
    });

    // Add label and action items
    items.push(
      { type: 'label', label: 'Workspaces' },
      {
        id: 'create-workspace',
        leftSection: IconPlus,
        label: 'Create workspace',
        onClick: handleCreateWorkspace
      },
      {
        id: 'import-workspace',
        leftSection: IconDownload,
        label: 'Import workspace',
        onClick: handleImportWorkspace
      },
      {
        id: 'manage-workspaces',
        leftSection: IconSettings,
        label: 'Manage workspaces',
        onClick: handleManageWorkspaces
      }
    );

    return items;
  }, [sortedWorkspaces, activeWorkspaceUid, preferences, handlePinWorkspace, handleCreateWorkspace]);

  return (
    <StyledWrapper className={`app-titlebar ${osClass}`}>
      {createWorkspaceModalOpen && (
        <CreateWorkspace onClose={() => setCreateWorkspaceModalOpen(false)} />
      )}
      {importWorkspaceModalOpen && (
        <ImportWorkspace onClose={() => setImportWorkspaceModalOpen(false)} />
      )}

      <div className="titlebar-content">
        <div className="titlebar-left">
          <button
            className={`product-brand ${activeApp === 'home' ? 'active' : ''}`}
            onClick={handleBrandClick}
            data-testid="product-brand"
          >
            <FlowworkLogo size={16} stroke={1.5} />
            <span className="product-name">Flowwork</span>
          </button>
        </div>

        {/* Center section: API Chain / Bruno app switcher */}
        <div className="titlebar-center">
          <button
            className={`app-switch ${activeApp === 'flowwork' ? 'active' : ''}`}
            onClick={() => dispatch(setActiveApp('flowwork'))}
            data-testid="app-switch-flowwork"
          >
            <ApiChainIcon size={16} />
            <span className="flowwork-text">API Chain</span>
          </button>
          <button
            className={`app-switch ${activeApp === 'bruno' ? 'active' : ''}`}
            onClick={() => dispatch(setActiveApp('bruno'))}
            data-testid="app-switch-bruno"
          >
            <Bruno width={18} />
            <span className="bruno-text">Bruno</span>
          </button>
        </div>

        {/* Right section: Action buttons */}
        <div className="titlebar-right">
          {/* Workspace Dropdown — 워크스페이스는 Bruno 기능이라 Bruno 앱에서만 보인다 */}
          {activeApp === 'bruno' && (
            <MenuDropdown
              data-testid="workspace-menu"
              items={workspaceMenuItems}
              placement="bottom-end"
              selectedItemId={activeWorkspaceUid}
            >
              <WorkspaceName />
            </MenuDropdown>
          )}

          <div className="titlebar-actions">
            {/* Toggle sidebar */}
            <ActionIcon
              onClick={handleToggleSidebar}
              label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
              size="lg"
              data-testid="toggle-sidebar-button"
            >
              <IconSidebarToggle collapsed={sidebarCollapsed} size={16} strokeWidth={1.5} />
            </ActionIcon>

            {/* Toggle devtools */}
            <ActionIcon
              onClick={handleToggleDevtools}
              label={isConsoleOpen ? 'Hide devtools' : 'Show devtools'}
              size="lg"
              data-testid="toggle-devtools-button"
            >
              <IconBottombarToggle collapsed={!isConsoleOpen} size={16} strokeWidth={1.5} />
            </ActionIcon>

            {/* 응답 패널 레이아웃은 Bruno 요청 화면 전용 */}
            {activeApp === 'bruno' && <ResponseLayoutToggle />}
          </div>
        </div>
      </div>
    </StyledWrapper>
  );
};

export default AppTitleBar;
