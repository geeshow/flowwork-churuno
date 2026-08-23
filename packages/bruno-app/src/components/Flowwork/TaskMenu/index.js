import React, { useEffect, useRef, useState } from 'react';
import {
  IconClipboard,
  IconCopy,
  IconDots,
  IconFilePlus,
  IconFolderPlus,
  IconPencil,
  IconShare,
  IconTrash
} from '@tabler/icons';
import IconSparkles from 'components/Icons/IconSparkles';

/**
 * 업무(폴더)의 "..." 메뉴 — Bruno 사이드바 항목 메뉴와 같은 구성.
 *
 * 항목은 호출부(Edit)가 넘긴다. 여기서는 열고 닫기와 위치만 다룬다:
 * 사이드바가 스크롤되므로 메뉴는 화면 좌표(fixed)로 띄운다.
 */
const ICONS = {
  newWorkflow: IconFilePlus,
  newFolder: IconFolderPlus,
  clone: IconCopy,
  copy: IconCopy,
  paste: IconClipboard,
  rename: IconPencil,
  share: IconShare,
  docs: IconSparkles,
  delete: IconTrash
};

const TaskMenu = ({ items }) => {
  const [at, setAt] = useState(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    if (!at) return undefined;
    const close = () => setAt(null);
    // 누른 자리가 이 메뉴 안이 아니면 닫는다. 잡는(capture) 단계에서 들어야 다른 메뉴의
    // "..."을 눌렀을 때도 닫힌다 — 그 단추가 mousedown을 자기 줄에 닿지 않게 막기 때문이다.
    const closeUnlessInside = (event) => {
      if (popupRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return;
      setAt(null);
    };
    // 스크롤하면 메뉴만 남고 항목은 떠나가므로 함께 닫는다
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('mousedown', closeUnlessInside, true);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('mousedown', closeUnlessInside, true);
    };
  }, [at]);

  const open = (event) => {
    event.stopPropagation();
    const rect = triggerRef.current.getBoundingClientRect();
    setAt({ top: rect.bottom + 2, left: rect.right - 168 });
  };

  return (
    <>
      <button
        ref={triggerRef}
        className={`task-menu-trigger ${at ? 'open' : ''}`}
        title="더 보기"
        onClick={open}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <IconDots size={14} strokeWidth={1.5} />
      </button>
      {at && (
        <div
          ref={popupRef}
          className="task-menu-popup"
          style={{ top: at.top, left: at.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {items.map((item) => {
            const Icon = ICONS[item.id];
            return (
              <button
                key={item.id}
                className={`task-menu-item ${item.danger ? 'danger' : ''}`}
                disabled={item.disabled}
                title={item.title}
                onClick={() => {
                  setAt(null);
                  item.onClick();
                }}
              >
                {Icon ? <Icon size={14} strokeWidth={1.5} /> : null}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};

export default TaskMenu;
