import React from 'react';

import AddStepButton from '../AddStepButton';
import BranchConditionEditor from '../BranchConditionEditor';
import RepeatEditor from '../RepeatEditor';

/**
 * 반복·분기 블록의 머리 — 무엇을 기준으로 도는지(반복), 언제 도는지(분기)를 여기서
 * 정하고, 그 아래 들여쓰기된 스텝들이 이 블록 안에서 돈다.
 */
export function BlockEditor({
  block,
  index,
  total,
  prevSteps,
  inputKeys,
  envKeys,
  repeating,
  onChange,
  onRemove,
  onMove,
  onAddInside
}) {
  const isRepeat = block.kind === 'REPEAT';

  return (
    <div className={`step-editor block ${isRepeat ? 'repeat' : 'branch'}`}>
      <div className="step-editor-head">
        <span className={`step-type-badge ${isRepeat ? 'loop' : 'cond'}`}>{isRepeat ? '반복' : '분기'}</span>
        <span className="step-title">
          <input
            className="block-name"
            value={block.name}
            placeholder={isRepeat ? '계좌마다' : '활성일 때'}
            onChange={(e) => onChange({ ...block, name: e.target.value })}
          />
        </span>
        <div className="step-actions">
          <button className="icon-btn" disabled={index === 0} onClick={() => onMove(-1)} title="위로">
            ↑
          </button>
          <button className="icon-btn" disabled={index === total - 1} onClick={() => onMove(1)} title="아래로">
            ↓
          </button>
          <button className="icon-btn danger" onClick={onRemove} title="블록과 안에 든 스텝 모두 삭제">
            ✕
          </button>
        </div>
      </div>

      <div className="step-section">
        {isRepeat ? (
          <RepeatEditor
            repeat={block.repeat}
            prevStepIds={prevSteps}
            onChange={(repeat) => onChange({ ...block, repeat: repeat ?? { kind: 'COUNT', count: 1 } })}
          />
        ) : (
          <BranchConditionEditor
            condition={block.branchCondition}
            prevStepIds={prevSteps}
            inputKeys={inputKeys}
            envKeys={envKeys}
            repeating={repeating}
            onChange={(branchCondition) => onChange({ ...block, branchCondition })}
          />
        )}
      </div>

      <AddStepButton label={`+ 이 ${isRepeat ? '반복' : '분기'} 안에 스텝 추가`} onAdd={onAddInside} />
    </div>
  );
}

export default BlockEditor;
