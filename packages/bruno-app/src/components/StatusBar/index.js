import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { IconSettings, IconTool, IconSearch, IconPalette, IconBrandGithub } from '@tabler/icons';
import Mousetrap from 'mousetrap';
import { getKeyBindingsForActionAllOS } from 'providers/Hotkeys/keyMappings';
import ToolHint from 'components/ToolHint';
import Notifications from 'components/Notifications';
import ThemeDropdown from './ThemeDropdown';
import { openConsole } from 'providers/ReduxStore/slices/logs';
import { showPreferencesPage } from 'providers/ReduxStore/slices/app';
import { useApp } from 'providers/App';
import StyledWrapper from './StyledWrapper';

const StatusBar = () => {
  const dispatch = useDispatch();
  const logs = useSelector((state) => state.logs.logs);
  const { version } = useApp();

  const errorCount = logs.filter((log) => log.type === 'error').length;

  const handleConsoleClick = () => {
    dispatch(openConsole());
  };

  const handlePreferencesClick = () => {
    dispatch(showPreferencesPage());
  };

  const openGlobalSearch = () => {
    const bindings = getKeyBindingsForActionAllOS('globalSearch') || [];
    bindings.forEach((binding) => {
      Mousetrap.trigger(binding);
    });
  };

  return (
    <StyledWrapper>
      <div className="status-bar">
        <div className="status-bar-section">
          <div className="status-bar-group">
            <ToolHint text="Preferences" toolhintId="Preferences" place="top-start" offset={10}>
              <button
                className="status-bar-button preferences-button"
                data-trigger="preferences"
                onClick={handlePreferencesClick}
                tabIndex={0}
                aria-label="Open Preferences"
              >
                <IconSettings size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </ToolHint>

            <ThemeDropdown>
              <button
                className="status-bar-button"
                data-trigger="theme"
                tabIndex={0}
                aria-label="Change Theme"
              >
                <IconPalette size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </ThemeDropdown>

            <ToolHint text="Notifications" toolhintId="Notifications" place="top" offset={10}>
              <div className="status-bar-button">
                <Notifications />
              </div>
            </ToolHint>

            <ToolHint text="GitHub Repository" toolhintId="GitHub" place="top" offset={10}>
              <button
                className="status-bar-button"
                onClick={() => {
                  window?.ipcRenderer?.openExternal('https://github.com/usebruno/bruno');
                }}
                tabIndex={0}
                aria-label="Open GitHub Repository"
              >
                <IconBrandGithub size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </ToolHint>
          </div>
        </div>

        <div className="status-bar-section">
          <div className="flex items-center gap-3">
            <button
              className="status-bar-button"
              data-trigger="search"
              onClick={openGlobalSearch}
              tabIndex={0}
              aria-label="Global Search"
            >
              <div className="console-button-content">
                <IconSearch size={16} strokeWidth={1.5} aria-hidden="true" />
                <span className="console-label">Search</span>
              </div>
            </button>

            <button
              className={`status-bar-button ${errorCount > 0 ? 'has-errors' : ''}`}
              data-trigger="dev-tools"
              onClick={handleConsoleClick}
              tabIndex={0}
              aria-label={`Open Dev Tools${errorCount > 0 ? ` (${errorCount} errors)` : ''}`}
            >
              <div className="console-button-content">
                <IconTool size={16} strokeWidth={1.5} aria-hidden="true" />
                <span className="console-label">Dev Tools</span>
                {errorCount > 0 && (
                  <span className="error-count-inline">{errorCount}</span>
                )}
              </div>
            </button>

            <div className="status-bar-divider"></div>

            <div className="status-bar-version">
              v{version}
            </div>
          </div>
        </div>
      </div>
    </StyledWrapper>
  );
};

export default StatusBar;
