import React, { useState } from 'react';

import { isValidHex, PRESET_COLORS } from '../domainPalette';

/**
 * 도메인 색을 고르는 작은 대화상자 — 색은 작업이 아니라 도메인의 것이라
 * 사이드바의 도메인 메뉴에서 연다. ([[NamePrompt]]와 같은 자리·같은 모양)
 */
const ColorPrompt = ({ title, initial, onSubmit, onCancel }) => {
  const [color, setColor] = useState(isValidHex(initial) ? initial : PRESET_COLORS[0]);

  return (
    <div className="name-prompt-backdrop" onMouseDown={onCancel}>
      <form
        className="name-prompt"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(color);
        }}
      >
        <h4>{title}</h4>
        <div className="color-picker">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`color-swatch ${color.toLowerCase() === preset.toLowerCase() ? 'active' : ''}`}
              style={{ background: preset }}
              title={preset}
              onClick={() => setColor(preset)}
            />
          ))}
          <label className="color-custom" title="직접 선택">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            <span className="color-custom-face" style={{ background: color }} />
          </label>
        </div>
        <div className="name-prompt-actions">
          <button type="button" className="small" onClick={onCancel}>
            취소
          </button>
          <button type="submit" className="primary small">
            색 저장
          </button>
        </div>
      </form>
    </div>
  );
};

export default ColorPrompt;
