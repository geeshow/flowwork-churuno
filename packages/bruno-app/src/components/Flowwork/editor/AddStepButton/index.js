import React, { useState } from 'react';

const KINDS = [
  { kind: 'API', label: 'API 호출' },
  { kind: 'WORKFLOW', label: '다른 업무 연결' },
  { kind: 'DELAY', label: '지연(대기)' },
  { kind: 'REPEAT', label: '반복 블록', hint: '목록·횟수만큼 안에 든 스텝을 돌린다' },
  { kind: 'BRANCH', label: '분기 블록', hint: '조건이 맞을 때만 안에 든 스텝을 돈다' }
];

/**
 * 스텝 추가 — 무엇을 넣을지 먼저 고른다. 반복·분기를 고르면 블록이 생기고,
 * 그 안에 스텝을 이어 넣는다.
 */
export function AddStepButton({ label = '+ 스텝 추가', onAdd }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="add-step-btn" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }

  return (
    <div className="add-step-choices">
      {KINDS.map((choice) => (
        <button
          key={choice.kind}
          className="add-step-choice"
          title={choice.hint}
          onClick={() => {
            setOpen(false);
            onAdd(choice.kind);
          }}
        >
          {choice.label}
        </button>
      ))}
      <button className="link small" onClick={() => setOpen(false)}>
        취소
      </button>
    </div>
  );
}

export default AddStepButton;
