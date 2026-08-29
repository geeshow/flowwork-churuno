import React, { useEffect, useState } from 'react';

import { valueForInput } from 'components/Flowwork/ai/command';
import api from 'components/Flowwork/api';
import WorkflowRunner from 'components/Flowwork/WorkflowRunner';
import Flowmap from 'components/Flowwork/WorkflowScreen/Flowmap';
import FlowworkStyles from 'components/Flowwork/StyledWrapper';

// 명령에서 인식한 값 → 이 작업의 입력값 초깃값. 라벨이나 키가 닿는 것만 채운다.
const prefillFor = (workflow, commandValues) => {
  const filled = {};
  for (const input of workflow.baseInputs ?? []) {
    const match = valueForInput(input, commandValues);
    if (match) filled[input.key] = match.value;
  }
  return filled;
};

/**
 * 홈 검색 결과에서 화면 이동 없이 펼쳐 쓰는 워크플로우 패널.
 * view가 'run'이면 입력값을 받아 그 자리에서 실행(WorkflowRunner)하고,
 * 'flowmap'이면 처리 절차 그림을 보여준다. 두 화면의 스타일(.panel, .flowmap* 등)은
 * Flowwork 공용 StyledWrapper에 있어 그 래퍼로 감싼다.
 */
const InlineWorkflow = ({ id, view, workflows, commandValues = [], onFinished }) => {
  const [workflow, setWorkflow] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setWorkflow(null);
    setError(null);
    api
      .getWorkflow(id, 'prod')
      .then((wf) => alive && setWorkflow(wf))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id]);

  // 실행 이력 상세는 전용 화면이 있다 — 그 링크만은 화면을 옮긴다
  const openExecution = (executionId) => {
    window.location.hash = `#/flowwork/executions/${encodeURIComponent(executionId)}`;
  };

  return (
    <FlowworkStyles>
      {error ? (
        <div className="error-banner">{error}</div>
      ) : !workflow ? (
        <p className="muted">불러오는 중…</p>
      ) : view === 'flowmap' ? (
        <Flowmap workflow={workflow} workflows={workflows} />
      ) : (
        <WorkflowRunner
          workflow={workflow}
          onOpenExecution={openExecution}
          initialValues={prefillFor(workflow, commandValues)}
          onFinished={onFinished}
        />
      )}
    </FlowworkStyles>
  );
};

export default InlineWorkflow;
