import React, { useState } from 'react';

/**
 * 이름을 받는 작은 대화상자.
 *
 * 웹뷰에서는 window.prompt가 차단되어 항상 취소로 처리되므로 직접 그린다
 * (ConfirmButton이 window.confirm을 대신하는 것과 같은 이유).
 */
const NamePrompt = ({ title, label, initial = '', submitLabel = '확인', onSubmit, onCancel }) => {
  const [value, setValue] = useState(initial);
  const trimmed = value.trim();

  const submit = (event) => {
    event.preventDefault();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <div className="name-prompt-backdrop" onMouseDown={onCancel}>
      <form className="name-prompt" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <h4>{title}</h4>
        <label>
          <span className="hint">{label}</span>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onCancel()}
          />
        </label>
        <div className="name-prompt-actions">
          <button type="button" className="small" onClick={onCancel}>
            취소
          </button>
          <button type="submit" className="primary small" disabled={!trimmed}>
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NamePrompt;
