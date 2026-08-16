import React from 'react';
import StyledWrapper from './StyledWrapper';

/**
 * 하나의 필터 묶음 — 아무것도 고르지 않으면 전체를 뜻한다.
 *
 * options: [[값, 라벨], …], counts: {값: 개수}
 */
const FilterChips = ({ options, counts, selected, onToggle, onClear }) => (
  <StyledWrapper>
    <button className={`chip ${selected.size === 0 ? 'active' : ''}`} onClick={onClear}>
      전체
    </button>
    {options.map(([value, label]) => {
      const count = counts[value] ?? 0;
      return (
        <button
          key={value}
          className={`chip ${selected.has(value) ? 'active' : ''}`}
          disabled={count === 0 && !selected.has(value)}
          onClick={() => onToggle(value)}
        >
          {label}
          <span className="chip-count">{count}</span>
        </button>
      );
    })}
  </StyledWrapper>
);

export default FilterChips;
