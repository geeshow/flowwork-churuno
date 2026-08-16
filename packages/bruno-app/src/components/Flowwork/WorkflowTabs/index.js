import React from 'react';
import { IconFolder, IconX } from '@tabler/icons';

export { useWorkflowTabs, workflowKey, folderKey } from './useWorkflowTabs';

/**
 * 열려 있는 탭 줄 — Bruno의 요청 탭과 같은 자리, 같은 동작.
 * 이름을 누르면 그 화면으로 옮겨가고, x로 닫는다.
 */
export function WorkflowTabs({ tabs, activeKey, changed, onSelect, onClose }) {
  if (tabs.length === 0) return null;

  return (
    <div className="wf-tabbar">
      <ul>
        {tabs.map((tab) => (
          <li key={tab.key} className={tab.key === activeKey ? 'active' : ''}>
            <button className="wf-tabbar-name" onClick={() => onSelect(tab)} title={`${tab.domain} / ${tab.task}`}>
              {tab.kind === 'folder' ? <IconFolder size={13} strokeWidth={1.5} /> : null}
              {changed?.(tab) ? <span className="wf-tabbar-changed" title="운영 미반영 변경">U</span> : null}
              <span className="wf-tabbar-text">{tab.name}</span>
            </button>
            <button className="wf-tabbar-close" title="닫기" onClick={() => onClose(tab.key)}>
              <IconX size={13} strokeWidth={1.5} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default WorkflowTabs;
