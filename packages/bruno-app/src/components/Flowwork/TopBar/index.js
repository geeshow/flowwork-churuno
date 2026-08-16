import React from 'react';
import { IconFileCode, IconFileOff, IconUpload } from '@tabler/icons';

/**
 * 탭 줄 위의 머리띠 — 지금 어디를 보고 있는지(브레드크럼)와 화면 전체에 걸리는
 * 동작(운영 반영, 파일 모드)을 둔다. Bruno 컬렉션 머리띠와 같은 자리다.
 *
 * 파일 모드는 작업을 열고 있을 때만 뜻이 있다 — 폴더 화면에는 파일이 없다.
 */
export function TopBar({ workspace, crumbs, changeCount, fileMode, onToggleFileMode, onOpenRelease }) {
  return (
    <div className="wf-topbar">
      <nav className="wf-topbar-crumbs">
        {workspace ? <span className="wf-topbar-workspace">{workspace}</span> : null}
        {crumbs.map((crumb, depth) => (
          <React.Fragment key={`${depth}-${crumb}`}>
            <span className="muted">/</span>
            <span className={depth === crumbs.length - 1 ? 'wf-topbar-current' : 'muted'}>{crumb}</span>
          </React.Fragment>
        ))}
      </nav>

      <div className="wf-topbar-actions">
        {onToggleFileMode ? (
          <button className="small" onClick={onToggleFileMode} title="작업을 저장된 파일 그대로 편집합니다">
            {fileMode ? <IconFileOff size={14} strokeWidth={1.5} /> : <IconFileCode size={14} strokeWidth={1.5} />}
            {fileMode ? 'Switch to Code Mode' : 'Switch to File Mode'}
          </button>
        ) : null}
        {onOpenRelease ? (
          <button className="primary small" onClick={onOpenRelease} title="운영에 반영할 변경 목록을 엽니다">
            <IconUpload size={14} strokeWidth={1.5} />
            main push
            {changeCount ? <span className="wf-topbar-count">{changeCount}</span> : null}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default TopBar;
