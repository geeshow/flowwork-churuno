import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { IconChevronRight, IconSearch, IconSend } from '@tabler/icons';

import { bridgePlanFor, harvestValues, matchCommand, suggestCombination, valueForInput } from 'components/Flowwork/ai/command';
import api from 'components/Flowwork/api';
import useOpenBrunoRequest from 'components/Flowwork/useOpenBrunoRequest';
import IconSparkles from 'components/Icons/IconSparkles';
import InlineWorkflow from './InlineWorkflow';
import StyledWrapper from './StyledWrapper';

const PAGE_SIZE = 5;

// 걸린 낱말과 자리를 그대로 보여 준다 — 왜 이 줄이 올라왔는지의 근거
const matchReason = ({ hits, where }) => `걸린 낱말: ${hits.join(', ')} (${where.join('·')})`;

/**
 * AI 명령 박스 — 하고 싶은 업무를 말로 적으면 실행할 API Chain을 정확도 순으로
 * 추려 준다. 화면을 옮기지 않는 것이 요점이다: 작업을 누르면 그 자리에서 입력값을
 * 받아 바로 실행하고(명령에서 인식한 값은 미리 채워진다), flowmap 보기는 처리 절차
 * 그림을 그 자리에 펼친다. 한 작업으로 안 되는 명령은 작업 조합을 제안하고, 그마저
 * 없으면 관련 API를 Bruno로 열어 실행할 수 있게 한다.
 */
const AiCommandBox = () => {
  const [command, setCommand] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(0);
  // 펼쳐진 패널 — { id, view: 'run' | 'flowmap' }, 한 번에 하나만 연다
  const [expanded, setExpanded] = useState(null);
  // 작업 조합 제안 — 낱말로 걸린 작업이 없을 때만 뒤이어 요청한다
  const [combo, setCombo] = useState(null);
  const [comboBusy, setComboBusy] = useState(false);
  // 실행 응답에서 거둔 값 — 징검다리 앞 단계의 결과가 뒷 단계 입력으로 이어진다
  const [produced, setProduced] = useState([]);
  // 답이 느린 AI 호출이 겹칠 때 늦게 온 옛 결과가 새 명령의 화면을 덮지 않게 한다
  const seqRef = useRef(0);
  // 카탈로그·작업 목록은 명령마다 다시 받을 것이 없다 — 첫 분석 때 한 번만 받는다
  const dataRef = useRef(null);
  const openBrunoRequest = useOpenBrunoRequest();

  const loadData = async () => {
    if (!dataRef.current) {
      const [catalog, workflows] = await Promise.all([api.searchCatalog(''), api.listWorkflows('prod')]);
      dataRef.current = { entries: catalog.results ?? [], workflows };
    }
    return dataRef.current;
  };

  const loadCombination = async (seq, text, values, workflows) => {
    setComboBusy(true);
    try {
      const suggestion = await suggestCombination(text, { workflows, values });
      if (seqRef.current === seq) setCombo(suggestion);
    } catch (e) {
      if (seqRef.current === seq) setCombo({ plan: [], reason: '', error: e.message });
    } finally {
      if (seqRef.current === seq) setComboBusy(false);
    }
  };

  const analyze = async (event) => {
    event.preventDefault();
    const text = command.trim();
    if (!text || busy) return;
    const seq = ++seqRef.current;
    setBusy(true);
    try {
      const data = await loadData();
      const matched = await matchCommand(text, data);
      setResult(matched);
      setPage(0);
      setExpanded(null);
      setCombo(null);
      setProduced([]);
      if (matched.workflows.length === 0) {
        loadCombination(seq, text, matched.values, data.workflows);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const openWorkflow = (id) => {
    window.location.hash = `#/flowwork/run/${encodeURIComponent(id)}`;
  };
  const toggleExpanded = (id, view) => {
    setExpanded((current) => (current?.id === id && current.view === view ? null : { id, view }));
  };
  const openApi = async (entry) => {
    const opened = await openBrunoRequest(entry);
    if (!opened) toast.error('Bruno에서 요청을 찾지 못했습니다 — 워크스페이스에 해당 컬렉션이 없습니다.');
  };

  // 성공한 실행의 응답에서 값을 거둬 둔다 — 같은 이름은 최근 실행 것이 남는다
  const rememberProduced = (responses) => {
    const harvested = harvestValues(responses);
    if (harvested.length === 0) return;
    setProduced((prev) => {
      const merged = new Map(prev.map((v) => [v.name, v.value]));
      for (const v of harvested) merged.set(v.name, v.value);
      return [...merged].map(([name, value]) => ({ name, value }));
    });
  };

  // 사람이 명령에 적은 값이 먼저, 실행에서 거둔 값이 그 뒤 — 같은 이름이면 명령이 이긴다
  const commandValues = [...(result?.values ?? []), ...produced];

  const rows = result?.workflows ?? [];
  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const remaining = rows.length - (page + 1) * PAGE_SIZE;

  const inlinePanel = (workflowId) => (
    <li className="inline-panel">
      <div className="inline-panel-head">
        <button className="link-btn" onClick={() => openWorkflow(workflowId)}>
          API Chain 화면에서 열기
        </button>
      </div>
      <InlineWorkflow
        id={workflowId}
        view={expanded.view}
        workflows={dataRef.current?.workflows ?? []}
        commandValues={commandValues}
        onFinished={rememberProduced}
      />
    </li>
  );

  // 검색 결과 행과 조합 제안 행이 같은 상호작용(그 자리 실행 / flowmap 펼침)을 쓴다
  const workflowRow = (workflow, { order, desc, tooltip }) => {
    const isRunOpen = expanded?.id === workflow.id && expanded.view === 'run';
    const isFlowmapOpen = expanded?.id === workflow.id && expanded.view === 'flowmap';
    // 명령의 값으로 입력을 다 못 채우면, 모자란 값을 만들어 줄 앞 단계를 함께 묶어 제안한다
    const bridge = dataRef.current
      ? bridgePlanFor(workflow, {
          workflows: dataRef.current.workflows,
          entries: dataRef.current.entries,
          values: result?.values ?? []
        })
      : null;
    const expandedBridge = bridge?.bridges.some((b) => b.workflow.id === expanded?.id);
    return (
      <React.Fragment key={`${order ?? ''}-${workflow.id}`}>
        <li className="match-row">
          <button
            className="match-open"
            title={`${tooltip} — 눌러 입력값을 적고 바로 실행합니다`}
            onClick={() => toggleExpanded(workflow.id, 'run')}
          >
            <span className="match-title">
              {order ? <span className="combo-order">{order}</span> : null}
              <span className="match-directory">{workflow.domain} / {workflow.task}</span>
              <IconChevronRight size={13} strokeWidth={1.5} />
              <span className="match-name">{workflow.name}</span>
            </span>
            {desc ? <span className="match-desc">{desc}</span> : null}
          </button>
          <button
            className={`flowmap-btn ${isFlowmapOpen ? 'open' : ''}`}
            title="처리 절차를 여기에서 바로 펼쳐 봅니다"
            onClick={() => toggleExpanded(workflow.id, 'flowmap')}
          >
            {isFlowmapOpen ? 'flowmap 닫기' : 'flowmap 보기'}
          </button>
        </li>
        {(isRunOpen || isFlowmapOpen) && inlinePanel(workflow.id)}
        {bridge && (
          <li className="bridge-row">
            <span className="bridge-note">
              이 작업은 <strong>{bridge.missing.map((i) => i.label || i.key).join(', ')}</strong>
              가 필요합니다 — 인식한 값으로 먼저 조회해 이어 실행하세요.
              앞 단계의 결과값은 다음 단계 입력에 자동으로 채워집니다:
              {bridge.missing.some((i) => valueForInput(i, produced)) && (
                <strong className="bridge-ready"> 값 확보됨 ✓</strong>
              )}
            </span>
            <span className="bridge-steps">
              {bridge.bridges.map(({ workflow: bridgeWorkflow, provides }, index) => (
                <button
                  key={bridgeWorkflow.id}
                  className={`bridge-step ${expanded?.id === bridgeWorkflow.id ? 'open' : ''}`}
                  title="눌러 입력값을 적고 바로 실행합니다"
                  onClick={() => toggleExpanded(bridgeWorkflow.id, 'run')}
                >
                  <span className="combo-order">{index + 1}</span>
                  {bridgeWorkflow.name}
                  <span className="bridge-provides">→ {provides.join(', ')}</span>
                </button>
              ))}
              <button
                className={`bridge-step ${expanded?.id === workflow.id ? 'open' : ''}`}
                title="앞 단계에서 얻은 값으로 실행합니다"
                onClick={() => toggleExpanded(workflow.id, 'run')}
              >
                <span className="combo-order">{bridge.bridges.length + 1}</span>
                {workflow.name}
              </button>
            </span>
          </li>
        )}
        {bridge && expandedBridge && expanded?.view && inlinePanel(expanded.id)}
      </React.Fragment>
    );
  };

  return (
    <StyledWrapper data-testid="ai-command-box">
      <form className="command-form" onSubmit={analyze}>
        <span className="command-icon">
          <IconSparkles size={18} strokeWidth={1.5} />
        </span>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="하고 싶은 업무를 말로 적으세요 — 예: 앱 사용자 ID 1234의 계좌 목록을 조회해줘"
          data-testid="ai-command-input"
        />
        <button type="submit" disabled={busy || command.trim().length === 0} data-testid="ai-command-submit">
          <IconSend size={15} strokeWidth={1.5} />
          {busy ? '분석 중…' : '실행'}
        </button>
      </form>

      {busy && <div className="command-status">AI가 명령에 맞는 API Chain을 찾는 중…</div>}

      {!busy && result && (
        <div className="command-result" data-testid="ai-command-result">
          <div className="analysis-note">
            <span className="keyword-note">
              낱말: {result.keywords.join(', ')}
              {result.error ? ' · AI 낱말 뽑기에 실패해 명령을 그대로 낱말로 썼습니다' : ''}
            </span>
            {result.values.length > 0 && (
              <span className="value-chips">
                인식한 값:
                {result.values.map((v) => (
                  <span key={`${v.name}=${v.value}`} className="value-chip" title="작업을 펼치면 이 값이 입력값에 미리 채워집니다">
                    {v.name} = <strong>{v.value}</strong>
                  </span>
                ))}
              </span>
            )}
            {produced.length > 0 && (
              <span className="value-chips">
                실행에서 얻은 값:
                {produced.map((v) => (
                  <span key={`${v.name}=${v.value}`} className="value-chip produced" title="다음 작업을 펼치면 이 값이 입력값에 미리 채워집니다">
                    {v.name} = <strong>{v.value}</strong>
                  </span>
                ))}
              </span>
            )}
          </div>

          {rows.length > 0 ? (
            <ul className="match-list">
              {visible.map(({ workflow, hits, where }) =>
                workflowRow(workflow, { desc: workflow.description, tooltip: matchReason({ hits, where }) }))}
              {remaining > 0 && (
                <li className="match-row more">
                  <button className="match-open" onClick={() => setPage(page + 1)} data-testid="ai-command-more">
                    <IconSearch size={14} strokeWidth={1.5} />
                    다른 워크플로우 찾기 — 다음 {Math.min(PAGE_SIZE, remaining)}개
                  </button>
                </li>
              )}
              {page > 0 && remaining <= 0 && (
                <li className="match-row more">
                  <button className="match-open" onClick={() => setPage(0)}>
                    처음 {Math.min(PAGE_SIZE, rows.length)}개 다시 보기
                  </button>
                </li>
              )}
            </ul>
          ) : comboBusy ? (
            <div className="command-status">한 번에 처리하는 API Chain이 없어 조합을 찾는 중…</div>
          ) : combo?.plan?.length > 0 ? (
            <>
              <div className="fallback-note">
                한 번에 처리하는 API Chain은 없지만, 아래 작업을 차례로 실행하면 됩니다.
                {combo.reason ? <span className="combo-reason"> {combo.reason}</span> : null}
              </div>
              <ul className="match-list">
                {combo.plan.map(({ workflow, why }, index) =>
                  workflowRow(workflow, { order: index + 1, desc: why || workflow.description, tooltip: 'AI가 제안한 조합의 한 단계' }))}
              </ul>
            </>
          ) : (
            <>
              <div className="fallback-note">
                {combo?.error
                  ? `조합 제안에 실패했습니다 (${combo.error})`
                  : combo?.reason
                    ? `API Chain 조합으로도 처리할 수 없습니다 — ${combo.reason}`
                    : '명령에 맞는 API Chain을 찾지 못했습니다'}
                {result.apis.length > 0 ? ' — 관련 API를 열어 바로 실행할 수 있습니다.' : ''}
              </div>
              {result.apis.length > 0 ? (
                <ul className="match-list">
                  {result.apis.map(({ entry, hits, where }) => (
                    <li key={entry.id} className="match-row">
                      <button
                        className="match-open"
                        title={`${matchReason({ hits, where })} — 눌러서 Bruno에서 열기`}
                        onClick={() => openApi(entry)}
                      >
                        <span className="match-title">
                          <span className={`api-method method-${String(entry.method || '').toLowerCase()}`}>{entry.method}</span>
                          <span className="match-directory">{[entry.department, ...entry.itemPath].join(' / ')}</span>
                          <IconChevronRight size={13} strokeWidth={1.5} />
                          <span className="match-name">{entry.name}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="fallback-note muted">관련 API도 없습니다 — 다른 말로 다시 적어 보세요.</div>
              )}
            </>
          )}
        </div>
      )}
    </StyledWrapper>
  );
};

export default AiCommandBox;
