import React from 'react';

export const entryPath = (entry) => `${entry.department} > ${[...entry.itemPath, entry.name].join(' > ')}`;

export const workflowPath = (workflow) => `${workflow.domain} > ${workflow.task} > ${workflow.name}`;

/**
 * 고를 수 있는 API·업무 한 줄 — 무엇인지와, 왜 여기 올라왔는지를 함께 보여 준다.
 * 업무 줄에는 그 도메인의 색을 입힌다 (kindColor) — 사이드바에서 보던 색이라
 * 목록이 섞여 있어도 어느 도메인의 것인지 글을 읽기 전에 알아본다.
 *
 * 고른 뒤에도 목록에 남는 자리에서는 체크 상자 대신 빼기 단추를 단다 — 체크를 푸는
 * 것과 재료에서 빼는 것이 같은 일임을 상자만 보고는 알기 어렵다.
 */
export function PickRow({ checked, onToggle, title, subtitle, kindLabel, kindColor, tags, removable = false }) {
  return (
    <li>
      <label className={`pick-row${checked && removable ? ' picked' : ''}`}>
        {checked && removable ? (
          <button className="icon-btn danger" onClick={onToggle} title="재료에서 빼기">
            ✕
          </button>
        ) : (
          <input type="checkbox" checked={checked} onChange={onToggle} />
        )}
        {kindLabel ? (
          <span className="ai-tag kind" style={kindColor ? { borderColor: kindColor, color: kindColor } : undefined}>
            {kindLabel}
          </span>
        ) : null}
        <span className="pick-title">{title}</span>
        {tags.map((tag) => (
          <span key={tag} className="ai-tag">
            {tag}
          </span>
        ))}
        {subtitle ? <span className="muted hint">{subtitle}</span> : null}
      </label>
    </li>
  );
}

export default PickRow;
