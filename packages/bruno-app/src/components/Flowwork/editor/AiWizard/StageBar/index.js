import React from 'react';

/**
 * 어디까지 왔는지, 그리고 어디로 되돌아갈 수 있는지.
 * 단계는 지나온 것만 늘어서므로(개선 판은 만들어져야 생긴다) 지금 자리 말고는 다 누를 수 있다.
 */
export function StageBar({ stages, at, onGo }) {
  return (
    <ol className="ai-wizard-stages">
      {stages.map((stage, index) => (
        <li key={stage.id} className={index === at ? 'active' : index < at ? 'done' : ''}>
          <button disabled={index === at} onClick={() => onGo(stage.id)}>
            {stage.label}
          </button>
        </li>
      ))}
    </ol>
  );
}

export default StageBar;
