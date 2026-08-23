import React, { useState } from 'react';
import { cancelAiGenerateText } from 'utils/ai';

import { inputsFromSuggestion, stepsFromPlan } from '../../ai';
import { CANCELLED } from '../../ai/converse';
import { draftNote, draftWorkflow } from '../../ai/wizard';
import AiProgress from '../AiProgress';
import ApiPicker from './ApiPicker';
import DraftView from './DraftView';
import QuestionForm from './QuestionForm';
import StageBar from './StageBar';

const NO_PICK = { apis: [], workflows: [] };

const stageId = (index) => `t${index}`;

/**
 * 단계 이름 — 분석과 판이 번갈아 쌓이므로 각자 몇 번째인지로 이름을 짓는다.
 * 첫 판은 '초안', 그다음부터 '개선 1·2…'.
 */
function stageLabels(timeline) {
  let analyses = 0;
  let drafts = 0;
  return timeline.map((entry) => {
    if (entry.kind === 'analyze') {
      analyses += 1;
      return analyses === 1 ? '분석' : `분석 ${analyses}`;
    }
    drafts += 1;
    return drafts === 1 ? '초안' : `개선 ${drafts - 1}`;
  });
}

/**
 * 새 작업을 처음부터 짜 주는 마법사 — 기본 정보만 적어 두면 나머지를 함께 채운다.
 *
 * 재료 선택 → 분석 → 초안 → 분석 2 → 개선 1 → … 로 이어지고, 지나온 단계는 언제든
 * 눌러 돌아갈 수 있다. 고칠 때마다 분석이 한 칸 더 쌓이는 게 요점이다 — 어떤 요청이
 * 어떤 판을 만들었는지, 그때 무엇을 확인했는지가 단계마다 그대로 남는다.
 *
 * API를 추리는 일에는 모델을 쓰지 않는다(ai/relevance). 모델은 낱말을 뽑을 때와
 * 초안을 짤 때만 돈다.
 */
export function AiWizard({ workflow, entries, workflows, envKeys, domainColors, getWorkflow, onConfirm }) {
  const [stage, setStage] = useState('idle');
  const [picked, setPicked] = useState(NO_PICK);
  const [purpose, setPurpose] = useState('LOOKUP');
  // 재료만으로는 말할 수 없는 것 — 첫 분석부터 마지막 판까지 늘 함께 간다
  const [requirement, setRequirement] = useState('');
  const [pending, setPending] = useState(null);
  const [requests, setRequests] = useState({});
  const [timeline, setTimeline] = useState([]);
  const [busy, setBusy] = useState(false);
  // 지금 도는 요청의 이름 — 중간에 끊으려면 이 이름으로 부른다
  const [runId, setRunId] = useState(null);

  const labels = stageLabels(timeline);
  const stages = [
    { id: 'apis', label: '재료 선택' },
    ...timeline.map((_, index) => ({ id: stageId(index), label: labels[index] }))
  ];
  const at = stages.findIndex((s) => s.id === stage);

  const reset = () => {
    setStage('idle');
    setPicked(NO_PICK);
    setRequirement('');
    setPending(null);
    setRequests({});
    setTimeline([]);
    setBusy(false);
  };

  // 한 판을 만들 때 스텝 id도 함께 붙여 둔다 — 보고 있는 것과 확정하는 것이 같은 판이어야 한다
  const buildVersion = (draft) => {
    const composed = {
      name: draft.name,
      description: draft.description,
      baseInputs: inputsFromSuggestion(draft.inputs),
      steps: stepsFromPlan(draft.plan, envKeys)
    };
    return {
      draft,
      composed,
      preview: { ...workflow, ...composed, steps: composed.steps.map((s, i) => ({ ...s, order: i + 1 })) }
    };
  };

  /**
   * 초안을 짜거나 고친다. fromIndex는 이어서 고칠 판의 자리 — 거기서 갈라지므로 뒤의
   * 단계는 버린다 (고쳐 나간 자취가 한 줄기로 남는다).
   */
  const analyze = ({ answers = [], fromIndex = null, request = '' }) => {
    const cut = fromIndex === null ? 0 : fromIndex + 1;
    const previous = fromIndex === null ? null : timeline[fromIndex].version.draft;
    const patch = (change) => setTimeline((prev) => prev.map((e, i) => (i === cut ? { ...e, ...change(e) } : e)));

    // 되묻고 답을 받은 것도 그 분석의 한 대목이다 — 분석을 새로 시작하지 않고 자취에 이어 붙인다
    if (answers.length > 0) {
      patch((entry) => ({ questions: [], steps: [...entry.steps, { answers }] }));
    } else {
      setTimeline((prev) => [...prev.slice(0, cut), { kind: 'analyze', request, steps: [], error: null, questions: [] }]);
    }
    setStage(stageId(cut));
    setPending({ answers, fromIndex, request });
    setBusy(true);

    const id = crypto.randomUUID();
    setRunId(id);

    draftWorkflow({
      workflow,
      purpose,
      pickedEntries: entries.filter((e) => picked.apis.includes(e.id)),
      pickedWorkflows: workflows.filter((w) => picked.workflows.includes(w.id)),
      entries,
      workflows,
      envKeys,
      getWorkflow,
      answers,
      previous,
      request,
      requirement,
      requestId: id,
      onProgress: (step) => patch((entry) => ({ steps: [...entry.steps, step] }))
    })
      .then((result) => {
        setBusy(false);
        if (result.questions) {
          patch(() => ({ questions: result.questions }));
          return;
        }
        setTimeline((prev) => [...prev.slice(0, cut + 1), { kind: 'draft', version: buildVersion(result) }]);
        setStage(stageId(cut + 1));
      })
      .catch((e) => {
        setBusy(false);
        // 그만둔 것은 실패가 아니다 — 그 분석은 없던 일로 하고 부탁하던 자리로 돌려보낸다.
        // 적어 둔 요청은 그대로 남아 있으므로 고쳐서 다시 보내면 된다.
        if (e.code === CANCELLED) {
          setTimeline((prev) => prev.slice(0, cut));
          setStage(fromIndex === null ? 'apis' : stageId(fromIndex));
          return;
        }
        patch(() => ({ error: e.message }));
      });
  };

  const stop = () => cancelAiGenerateText(runId);

  const ready = workflow.name.trim().length > 0;
  const nothingPicked = picked.apis.length + picked.workflows.length === 0;
  const shownIndex = stage.startsWith('t') ? Number(stage.slice(1)) : -1;
  const shown = timeline[shownIndex];
  // 이 판을 만든 요청 — 바로 앞 분석에 적어 둔 것
  const askedFor = shown?.kind === 'draft' ? timeline[shownIndex - 1]?.request : '';

  return (
    <section className="panel ai-wizard">
      <div className="panel-head">
        <h3>
          AI로 만들기 <span className="hint">(기본 정보를 읽고 초안을 짭니다)</span>
        </h3>
        {stage !== 'idle' ? (
          <button className="link" onClick={reset} disabled={busy}>
            처음부터
          </button>
        ) : null}
      </div>

      {stage === 'idle' ? (
        <div className="ai-suggest-bar">
          <button className="small" disabled={!ready} onClick={() => setStage('apis')}>
            AI로 초안 만들기
          </button>
          <span className="muted hint">{ready ? '쓸 재료(API·업무)를 고르는 것부터 시작합니다' : '이름을 먼저 입력하세요'}</span>
        </div>
      ) : (
        <StageBar stages={stages} at={at} onGo={setStage} />
      )}

      {stage === 'apis' ? (
        <>
          <ApiPicker
            workflow={workflow}
            entries={entries}
            workflows={workflows}
            envKeys={envKeys}
            picked={picked}
            onChange={setPicked}
            purpose={purpose}
            onPurposeChange={setPurpose}
            requirement={requirement}
            onRequirementChange={setRequirement}
            domainColors={domainColors}
          />
          <div className="ai-suggest-actions">
            <span className="muted hint">
              {nothingPicked
                ? '재료를 하나 이상 고르세요'
                : `${picked.apis.length + picked.workflows.length}개 고름${
                  timeline.length > 0 ? ' · 다시 분석하면 지금까지의 판은 사라집니다' : ''
                }`}
            </span>
            <button className="primary small" disabled={nothingPicked || busy} onClick={() => analyze({})}>
              분석 시작
            </button>
          </div>
        </>
      ) : null}

      {shown?.kind === 'analyze' ? (
        <>
          {shown.request ? (
            <p className="draft-asked">
              <span className="muted hint">고쳐 달라고 한 것</span> {shown.request}
            </p>
          ) : null}
          <AiProgress steps={shown.steps} loading={busy && shownIndex === timeline.length - 1} />
          {busy && shownIndex === timeline.length - 1 ? (
            <div className="ai-suggest-actions">
              <button className="link small" onClick={stop}>
                중단하고 다시 부탁하기
              </button>
            </div>
          ) : null}
          {shown.error ? <div className="error-banner">{shown.error}</div> : null}
          {shown.questions.length > 0 ? (
            <QuestionForm questions={shown.questions} onSubmit={(answers) => analyze({ ...pending, answers })} />
          ) : null}
        </>
      ) : null}

      {shown?.kind === 'draft' ? (
        <DraftView
          version={shown.version}
          askedFor={askedFor}
          entries={entries}
          workflows={workflows}
          envKeys={envKeys}
          picked={picked}
          onPick={setPicked}
          domainColors={domainColors}
          busy={busy}
          request={requests[stage] ?? ''}
          onRequestChange={(text) => setRequests({ ...requests, [stage]: text })}
          onSend={(request) => analyze({ fromIndex: shownIndex, request })}
          onConfirm={() =>
            onConfirm({
              ...shown.version.composed,
              // 어떻게 짜였는지는 초안이 사람 손을 거치고 나면 알 길이 없다 — Docs에 남긴다
              docs: draftNote({
                purpose,
                pickedEntries: entries.filter((e) => picked.apis.includes(e.id)),
                pickedWorkflows: workflows.filter((w) => picked.workflows.includes(w.id)),
                timeline: timeline.slice(0, shownIndex + 1)
              })
            })}
        />
      ) : null}
    </section>
  );
}

export default AiWizard;
