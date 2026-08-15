import { evaluateBranchCondition } from './branch';
import { resolveValue } from './resolver';
import { resolveTemplate } from './template';

const isOk = (status) => status !== null && status >= 200 && status < 300;

/**
 * 워크플로우 실행 진입점. 실행 로직은 전부 여기(프론트)에 있고,
 * 서버는 개별 API 호출 proxy만 담당한다.
 *
 * deps = {
 *   getRequestTemplate(step),          // 카탈로그 조회 또는 inlineRequest
 *   proxy({execution_id, step_id, workflow_id, request}),
 *   env,                               // 환경변수 맵
 *   getWorkflow(id),                   // 다른 업무 연결 스텝용 로더
 *   collectMidInputs({step, uid, response}) // 중간 입력 폼 대기 (Promise)
 * }
 */
export async function runWorkflow(workflow, userInputs, deps, onStepUpdate) {
  const executionId = crypto.randomUUID();
  const result = await executeWorkflow(workflow, userInputs, deps, onStepUpdate, {
    executionId,
    stepPrefix: '',
    callStack: new Set([workflow.id])
  });
  return { executionId, overallStatus: result.overallStatus };
}

/**
 * 실제 스텝 순회 루프. 하위 워크플로우 연결 시 자기 자신을 재귀 호출한다.
 * 각 워크플로우는 자신만의 ctx(로컬 step.id 기준)를 가지므로 분기/PREV_RESPONSE
 * 참조가 워크플로우 경계를 넘지 않는다.
 */
async function executeWorkflow(workflow, userInputs, deps, onStepUpdate, runtime) {
  const ctx = {
    userInputs,
    env: deps.env,
    stepResponses: new Map()
  };
  let hadFailure = false;

  const orderedSteps = [...workflow.steps].sort((a, b) => a.order - b.order);

  for (const step of orderedSteps) {
    const uid = `${runtime.stepPrefix}${step.id}`;

    if (!evaluateBranchCondition(step, ctx)) {
      onStepUpdate({ stepId: uid, status: 'SKIPPED' });
      continue;
    }

    onStepUpdate({ stepId: uid, status: 'RUNNING' });

    try {
      const ok = step.workflowBinding
        ? await runWorkflowStep(step, ctx, deps, onStepUpdate, runtime, uid)
        : await runApiStep(step, workflow, ctx, deps, onStepUpdate, runtime, uid);

      if (!ok) {
        hadFailure = true;
        if (step.stopOnFailure) break;
      } else if (step.midInputs && step.midInputs.length > 0 && deps.collectMidInputs) {
        // 중간 입력: 폼이 제출될 때까지 대기 후 값 병합 (이후 스텝이 USER_INPUT으로 참조)
        const extra = await deps.collectMidInputs({
          step,
          uid,
          response: ctx.stepResponses.get(step.id)
        });
        Object.assign(ctx.userInputs, extra);
      }
    } catch (e) {
      hadFailure = true;
      onStepUpdate({ stepId: uid, status: 'FAILED', error: e.message });
      if (step.stopOnFailure) break;
    }
  }

  return { overallStatus: hadFailure ? 'FAILED' : 'SUCCESS', stepResponses: ctx.stepResponses };
}

/** API 호출 스텝. */
async function runApiStep(step, workflow, ctx, deps, onStepUpdate, runtime, uid) {
  if (!step.apiBinding) throw new Error('처리 API가 설정되지 않았습니다.');
  const template = deps.getRequestTemplate(step);
  const request = resolveTemplate(template, step.apiBinding, ctx);

  const result = await deps.proxy({
    execution_id: runtime.executionId,
    step_id: uid,
    workflow_id: workflow.id,
    request
  });

  ctx.stepResponses.set(step.id, result.response.body);
  const ok = isOk(result.response.status);
  onStepUpdate({ stepId: uid, status: ok ? 'SUCCESS' : 'FAILED', request, response: result.response.body });
  return ok;
}

/** 다른 업무(워크플로우) 연결 스텝 — 하위 워크플로우를 재귀 실행. */
async function runWorkflowStep(step, ctx, deps, onStepUpdate, runtime, uid) {
  const wb = step.workflowBinding;
  if (!deps.getWorkflow) throw new Error('워크플로우 연결이 지원되지 않습니다 (getWorkflow 미설정).');
  if (runtime.callStack.has(wb.ref.id)) {
    throw new Error(`워크플로우 순환 참조: ${wb.ref.id}`);
  }

  // 부모 컨텍스트 → 하위 워크플로우 입력값 매핑
  const subInputs = {};
  for (const [key, source] of Object.entries(wb.inputMappings)) {
    subInputs[key] = resolveValue(source, ctx);
  }

  const subWorkflow = await deps.getWorkflow(wb.ref.id);
  const subResult = await executeWorkflow(subWorkflow, subInputs, deps, onStepUpdate, {
    executionId: runtime.executionId,
    stepPrefix: `${uid}/`,
    callStack: new Set([...runtime.callStack, subWorkflow.id])
  });

  const response = {
    status: subResult.overallStatus,
    steps: Object.fromEntries(subResult.stepResponses)
  };
  ctx.stepResponses.set(step.id, response);

  const ok = subResult.overallStatus === 'SUCCESS';
  onStepUpdate({ stepId: uid, status: ok ? 'SUCCESS' : 'FAILED', response });
  return ok;
}
