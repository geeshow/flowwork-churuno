import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { addFlowworkRequest } from 'providers/ReduxStore/slices/logs';

import api from '../api';
import { makeTemplateResolver, refKey } from '../engine/catalogLookup';
import { runWorkflow } from '../engine/runWorkflow';
import { ApiComboProvider } from '../ApiComboProvider';
import { executionShareUrl } from '../shareUrl';
import { StepCard, stepTypeMeta } from '../StepCard';
import StepInputForm from '../StepInputForm';

// 프록시는 파싱된 body만 주므로 응답 뷰어(formatResponse)가 요구하는
// base64 원문은 여기서 재구성한다. 비-JSON 응답은 {_raw: text}로 감싸져 온다.
const encodeResponseBase64 = (body) => {
  if (body === null || body === undefined) return undefined;
  const text = typeof body._raw === 'string' && Object.keys(body).length === 1
    ? body._raw
    : JSON.stringify(body);
  return Buffer.from(text, 'utf-8').toString('base64');
};

// 스텝 프록시 호출 결과를 Devtools Network 탭 엔트리(collection.timeline의
// request 엔트리와 동일한 형태)로 변환한다.
const toNetworkEntry = (payload, result) => {
  const timestamp = result.timestamp ? Math.round(result.timestamp * 1000) : Date.now();
  // 서버가 리댁션한 요청(result.request)을 우선 사용 — 실행 이력과 동일하게
  // Authorization 등 민감 값이 화면에 남지 않는다.
  const request = result.request ?? payload.request;
  const { response } = result;
  return {
    type: 'request',
    collectionUid: null,
    itemUid: `${payload.execution_id}/${payload.step_id}`,
    timestamp,
    data: {
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        data: request.body
      },
      response: {
        statusCode: response.status,
        headers: response.headers,
        duration: result.elapsed_ms,
        size: response.size_bytes,
        data: response.body,
        dataBuffer: encodeResponseBase64(response.body)
      },
      timestamp
    }
  };
};

// source="edit"이면 워크플로우 목록/하위 워크플로우를 편집 worktree 기준으로 읽는다
// (커밋 전 임시 저장 내용으로 동작 확인). 카탈로그/환경변수는 main 기준 공통.
export function WorkflowRunner({ workflow, onOpenExecution, source = 'prod' }) {
  const dispatch = useDispatch();
  const [catalog, setCatalog] = useState([]);
  const [env, setEnv] = useState({});
  const [summaries, setSummaries] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const [values, setValues] = useState({});
  const [states, setStates] = useState(new Map());
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  // 중간 입력: 실행이 스텝 뒤에서 멈춰 폼을 띄우고, 제출 시 Promise를 resolve해 재개한다.
  const [midPrompt, setMidPrompt] = useState(null);
  const [midValues, setMidValues] = useState({});
  // 실행에 사용된 입력값(기본 + 중간) 누적 — 실행 후 이력에 기록
  const runInputsRef = useRef({});

  useEffect(() => {
    let alive = true;
    Promise.all([api.searchCatalog(''), api.getEnvironments(), api.listWorkflows(source)])
      .then(([cat, envs, wfs]) => {
        if (!alive) return;
        setCatalog(cat.results);
        setEnv(envs);
        setSummaries(wfs);
        setLoaded(true);
      })
      .catch((e) => alive && setLoadError(e.message));
    return () => {
      alive = false;
    };
  }, [source]);

  // 기본 입력값(워크플로우 레벨)이 곧 실행 엔진의 userInputs가 된다
  const allInputs = workflow.baseInputs;

  const orderedSteps = useMemo(() => [...workflow.steps].sort((a, b) => a.order - b.order), [workflow]);

  async function handleRun() {
    setRunning(true);
    setResult(null);
    setStates(new Map());
    setMidPrompt(null);
    runInputsRef.current = { ...values }; // 기본 입력값 스냅샷 (중간 입력은 제출 시 병합)

    const wfCache = new Map();
    const deps = {
      getRequestTemplate: makeTemplateResolver(catalog),
      proxy: async (payload) => {
        const result = await api.proxy(payload);
        dispatch(addFlowworkRequest(toNetworkEntry(payload, result)));
        return result;
      },
      env,
      // 다른 업무 연결 스텝: 내부 id로 하위 워크플로우 로드 (세션 내 캐시)
      getWorkflow: async (id) => {
        const cached = wfCache.get(id);
        if (cached) return cached;
        const wf = await api.getWorkflow(id, source);
        wfCache.set(id, wf);
        return wf;
      },
      // 중간 입력: 폼을 띄우고 사용자가 "계속"을 누를 때까지 대기
      collectMidInputs: ({ step, uid, response }) =>
        new Promise((resolve) => {
          setMidValues({});
          setMidPrompt({ uid, step, response, resolve });
        })
    };

    const onStepUpdate = (s) => setStates((prev) => new Map(prev).set(s.stepId, s));

    try {
      const res = await runWorkflow(workflow, values, deps, onStepUpdate);
      // 실행에 쓰인 입력값(기본+중간)을 이력에 기록 (서버가 비밀번호 등 리댁션)
      await api.recordExecutionInputs(res.executionId, runInputsRef.current, workflow.id).catch(() => {});
      setResult(res);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setRunning(false);
    }
  }

  function submitMid() {
    if (!midPrompt) return;
    Object.assign(runInputsRef.current, midValues); // 중간 입력도 이력 기록 대상
    midPrompt.resolve({ ...midValues });
    setMidPrompt(null);
    setMidValues({});
  }

  // 중간 입력 폼(스텝 카드 하단에 렌더) — 모든 항목이 채워져야 "계속" 활성화
  const midComplete
    = !!midPrompt
      && midPrompt.step.midInputs.every((d) => {
        const v = midValues[d.key];
        return v != null && v !== '';
      });

  const renderMidForm = () => {
    if (!midPrompt) return null;
    return (
      <div className="midinput-form">
        <div className="midinput-title">중간 입력 — 다음 스텝 전에 추가 정보를 입력하세요</div>
        <StepInputForm
          inputs={midPrompt.step.midInputs}
          values={midValues}
          env={env}
          stepResponse={midPrompt.response}
          onChange={(key, value) => setMidValues((v) => ({ ...v, [key]: value }))}
        />
        <div className="input-run-row">
          <button className="primary" onClick={submitMid} disabled={!midComplete}>
            계속 →
          </button>
        </div>
      </div>
    );
  };

  if (!loaded) {
    return loadError ? <div className="error-banner">{loadError}</div> : <p className="muted">API 카탈로그 불러오는 중…</p>;
  }

  return (
    <ApiComboProvider entries={catalog} env={env}>
      <div className="runner">
        <header className="runner-head">
          <div>
            <span className="badge">{workflow.domain}</span>
            <span className="badge">{workflow.task}</span>
            <h2>{workflow.name}</h2>
            {workflow.description ? <p className="muted">{workflow.description}</p> : null}
          </div>
        </header>

        {loadError ? <div className="error-banner">{loadError}</div> : null}

        <section className="panel">
          <h3>입력값</h3>
          <StepInputForm
            inputs={allInputs}
            values={values}
            env={env}
            onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
          />
          <div className="input-run-row">
            <button className="primary" onClick={handleRun} disabled={running || !!loadError}>
              {running ? '실행 중…' : '실행'}
            </button>
          </div>
        </section>

        <section className="panel">
          <h3>스텝</h3>
          <div className="step-list">
            {orderedSteps.map((step) => {
              const { typeLabel, category } = stepTypeMeta(step, (id) => {
                const w = summaries.find((s) => s.id === id);
                return w ? { domain: w.domain, task: w.task, name: w.name } : undefined;
              });
              // 결과 표 헤더에 쓸 필드 설명 — 스텝이 참조하는 카탈로그 항목의 outputLabels
              const entry = step.apiBinding
                ? catalog.find((e) => refKey(e) === refKey(step.apiBinding.catalogEntry))
                : undefined;
              return (
                <StepCard
                  key={step.id}
                  step={step}
                  state={states.get(step.id)}
                  resultView={step.resultView}
                  typeLabel={typeLabel}
                  category={category}
                  outputLabels={entry?.outputLabels}
                  footer={midPrompt?.uid === step.id ? renderMidForm() : null}
                />
              );
            })}
          </div>
        </section>

        {midPrompt && !orderedSteps.some((s) => s.id === midPrompt.uid) ? (
          <section className="panel midinput-panel">{renderMidForm()}</section>
        ) : null}

        {result ? (
          <div className={`result-banner ${result.overallStatus.toLowerCase()}`}>
            <div className="result-banner-head">
              <span>
                실행 완료 — <strong>{result.overallStatus}</strong>
              </span>
              <button className="link" onClick={() => onOpenExecution(result.executionId)}>
                워크플로우 이력에서 열기 →
              </button>
            </div>
            <div className="share-row">
              <code>{executionShareUrl(result.executionId)}</code>
              <button
                className="link"
                onClick={() => navigator.clipboard?.writeText(executionShareUrl(result.executionId))}
              >
                공유 링크 복사
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </ApiComboProvider>
  );
}

export default WorkflowRunner;
