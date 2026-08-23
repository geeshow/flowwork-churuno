import React, { useMemo, useState } from 'react';

import { findEntries, findWorkflows, producersFor } from '../../../ai/relevance';
import { colorForDomain } from '../../../domainPalette';
import PickRow, { entryPath, workflowPath } from '../PickRow';

/**
 * API를 직접 찾아 더하는 자리 — 처음 고를 때도, 초안을 고치다 하나가 더 필요해졌을 때도
 * 같은 것을 쓴다.
 *
 * 검색과 함께 "값 공급 API"를 늘 곁들인다. 고른 API가 요구하는 값을 내놓는 API는
 * 이름이 닮지 않아 검색으로는 걸리지 않지만, 그것 없이는 작업이 돌지 않는다.
 */
export function ApiFinder({ entries, workflows, envKeys, picked, onChange, domainColors }) {
  const [query, setQuery] = useState('');

  const pickedEntries = useMemo(() => entries.filter((e) => picked.apis.includes(e.id)), [entries, picked.apis]);
  const supplies = useMemo(() => producersFor(entries, pickedEntries, envKeys), [entries, pickedEntries, envKeys]);

  const found = query.trim()
    ? { apis: findEntries(entries, query), workflows: findWorkflows(workflows, query) }
    : null;

  const toggle = (kind, id) => {
    const list = picked[kind];
    onChange({ ...picked, [kind]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
  };

  const apiRow = (entry, tags, subtitle, removable = false) => (
    <PickRow
      key={entry.id}
      checked={picked.apis.includes(entry.id)}
      onToggle={() => toggle('apis', entry.id)}
      title={entryPath(entry)}
      subtitle={subtitle}
      kindLabel="API"
      tags={tags}
      removable={removable}
    />
  );

  return (
    <>
      {supplies.length > 0 ? (
        <>
          <h4>값 공급 API ({supplies.length})</h4>
          <p className="muted hint">고른 API가 요구하는 값을 내놓습니다 — 함께 고르면 앞 스텝으로 세웁니다.</p>
          <ul className="ai-suggest-list">
            {supplies.map(({ entry, supplies: gives }) =>
              apiRow(entry, [...new Set(gives.map((g) => g.variable))], `${gives[0].forName}에 필요`, true))}
          </ul>
        </>
      ) : null}

      <h4>API/기존 업무 검색</h4>
      <input
        className="pick-search"
        value={query}
        placeholder="이름, 출력 항목, 변수, 주소, 업무 설명으로 검색"
        onChange={(e) => setQuery(e.target.value)}
      />
      {found ? (
        found.apis.length + found.workflows.length === 0 ? (
          <p className="muted">걸리는 것이 없습니다.</p>
        ) : (
          <ul className="ai-suggest-list">
            {found.apis.map((entry) => apiRow(entry, [], ''))}
            {found.workflows.map((wf) => (
              <PickRow
                key={wf.id}
                checked={picked.workflows.includes(wf.id)}
                onToggle={() => toggle('workflows', wf.id)}
                title={workflowPath(wf)}
                subtitle={wf.description}
                kindLabel="업무"
                kindColor={colorForDomain(wf.domain.normalize('NFC'), domainColors)}
                tags={[]}
              />
            ))}
          </ul>
        )
      ) : null}
    </>
  );
}

export default ApiFinder;
