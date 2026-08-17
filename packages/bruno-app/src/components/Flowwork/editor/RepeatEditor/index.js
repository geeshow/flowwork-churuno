import React from 'react';

const LIST_DEFAULT = { kind: 'LIST', sourceStepId: '', itemsPath: '$', maxIterations: 20 };
const COUNT_DEFAULT = { kind: 'COUNT', count: 3 };

/**
 * 반복 설정 — 이 스텝을 목록의 항목마다, 또는 정한 횟수만큼 되돌린다.
 *
 * 목록 반복은 앞 스텝의 응답에서 배열을 꺼내 쓰고, 그 회차의 항목은 변수 바인딩에서
 * "반복 항목"으로 참조한다. 여러 스텝을 묶어 반복하려면 그 묶음을 하나의 업무로 만든 뒤
 * 연결업무 스텝을 반복시킨다.
 */
export function RepeatEditor({ repeat, prevStepIds, onChange }) {
  if (!repeat) {
    return (
      <div>
        <p className="muted">반복 없음 — 한 번만 실행됩니다.</p>
        <div className="repeat-add">
          <button
            className="link"
            disabled={prevStepIds.length === 0}
            onClick={() => onChange(LIST_DEFAULT)}
          >
            + 목록만큼 반복
          </button>
          <button className="link" onClick={() => onChange(COUNT_DEFAULT)}>
            + 횟수만큼 반복
          </button>
          {prevStepIds.length === 0 ? <span className="hint">(목록 반복은 앞 스텝이 있어야 합니다)</span> : null}
        </div>
      </div>
    );
  }

  const set = (patch) => onChange({ ...repeat, ...patch });

  return (
    <div className="repeat-editor">
      <div className="mode-toggle">
        <button
          className={repeat.kind === 'LIST' ? 'active' : ''}
          disabled={prevStepIds.length === 0}
          onClick={() => onChange({ ...LIST_DEFAULT, maxIterations: repeat.maxIterations ?? 20 })}
        >
          목록만큼
        </button>
        <button className={repeat.kind === 'COUNT' ? 'active' : ''} onClick={() => onChange(COUNT_DEFAULT)}>
          횟수만큼
        </button>
      </div>

      {repeat.kind === 'COUNT' ? (
        <div className="repeat-row">
          <label className="field-label">횟수</label>
          <input
            type="number"
            min="1"
            value={repeat.count ?? 1}
            onChange={(e) => set({ count: Number(e.target.value) })}
          />
          <span className="hint">회</span>
        </div>
      ) : (
        <>
          <div className="repeat-row">
            <select value={repeat.sourceStepId} onChange={(e) => set({ sourceStepId: e.target.value })}>
              <option value="" disabled>
                목록을 만드는 스텝…
              </option>
              {prevStepIds.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              className="jsonpath-input"
              placeholder="$.data.accounts"
              value={repeat.itemsPath ?? '$'}
              onChange={(e) => set({ itemsPath: e.target.value })}
            />
          </div>
          <p className="hint">
            그 응답에서 배열을 가리키는 경로입니다. 회차마다 그 항목 하나가 "반복 항목"으로 들어가고, 변수
            바인딩에서 골라 쓸 수 있습니다.
          </p>
          <div className="repeat-row">
            <label className="field-label">최대 횟수</label>
            <input
              type="number"
              min="1"
              max="100"
              value={repeat.maxIterations ?? 20}
              onChange={(e) => set({ maxIterations: Number(e.target.value) })}
            />
            <span className="hint">회까지만 (목록이 더 길어도 여기서 멈춥니다 · 상한 100)</span>
          </div>
        </>
      )}

      <button className="link small" onClick={() => onChange(undefined)}>
        반복 제거
      </button>
    </div>
  );
}

export default RepeatEditor;
