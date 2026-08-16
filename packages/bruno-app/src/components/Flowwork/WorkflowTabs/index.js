import React from 'react';
import { IconX } from '@tabler/icons';

export { useWorkflowTabs } from './useWorkflowTabs';

/**
 * 열려 있는 작업 탭 줄 — Bruno의 요청 탭과 같은 자리, 같은 동작.
 * 이름을 누르면 그 작업으로 옮겨가고, x로 닫는다.
 */
export function WorkflowTabs({ tabs, activeId, changed, onSelect, onClose }) {
  if (tabs.length === 0) return null;

  return (
    <div className="wf-tabbar">
      <ul>
        {tabs.map((tab) => (
          <li key={tab.id} className={tab.id === activeId ? 'active' : ''}>
            <button className="wf-tabbar-name" onClick={() => onSelect(tab.id)} title={`${tab.domain} / ${tab.task}`}>
              {changed?.(tab.id) ? <span className="wf-tabbar-changed" title="운영 미반영 변경">U</span> : null}
              <span className="wf-tabbar-text">{tab.name}</span>
            </button>
            <button className="wf-tabbar-close" title="닫기" onClick={() => onClose(tab.id)}>
              <IconX size={13} strokeWidth={1.5} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default WorkflowTabs;
