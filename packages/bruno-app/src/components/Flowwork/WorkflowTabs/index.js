import React from 'react';
import { IconFolder, IconX } from '@tabler/icons';

export { useWorkflowTabs, workflowKey, folderKey } from './useWorkflowTabs';

/**
 * 열려 있는 탭 줄 — Bruno의 요청 탭(components/RequestTabs)과 같은 자리, 같은 모양,
 * 같은 동작. 이름을 누르면 그 화면으로 옮겨가고, 탭 위에 올리면 오른쪽 끝에서 닫기가
 * 떠오른다. 운영 미반영 변경이 있는 탭은 Bruno의 draft 점처럼 그 자리에 U를 띄운다.
 */
export function WorkflowTabs({ tabs, activeKey, changed, onSelect, onClose }) {
  if (tabs.length === 0) return null;

  return (
    <div className="wf-tabbar">
      <ul>
        {tabs.map((tab) => (
          <li key={tab.key} className={tab.key === activeKey ? 'active' : ''}>
            <div className="tab-container">
              <button className="tab-label" onClick={() => onSelect(tab)} title={`${tab.domain} / ${tab.task}`}>
                {tab.kind === 'folder' ? <IconFolder size={13} strokeWidth={1.5} /> : null}
                <span className="tab-name">{tab.name}</span>
              </button>
              <div className={`tab-close ${changed?.(tab) ? 'has-changes' : ''}`}>
                <span className="tab-changed" title="운영 미반영 변경">
                  U
                </span>
                <button className="tab-close-icon" title="닫기" onClick={() => onClose(tab.key)}>
                  <IconX size={13} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default WorkflowTabs;
