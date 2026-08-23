import { JSONPath } from 'jsonpath-plus';

import { conditionSource, evaluateBranchCondition } from './branch';
import { resolveValue } from './resolver';
import { resolveTemplate } from './template';

const isOk = (status) => status !== null && status >= 200 && status < 300;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 반복이 폭주해 API를 두들기지 않도록 하는 상한 — 스텝의 maxIterations도 이 안에서만 쓴다
const ITERATION_LIMIT = 100;

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
 * 스텝 목록(평면)을 블록 구조로 세운다. 반복·분기 블록(kind)이 부모가 되고,
 * parentId가 그 블록을 가리키는 스텝들이 그 안에서 돈다.
 */
export function buildStepTree(steps) {
  const byParent = new Map();
  for (const step of [...steps].sort((a, b) => a.order - b.order)) {
    const key = step.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), step]);
  }
  const build = (parentId) => (byParent.get(parentId) ?? []).map((step) => ({ step, children: build(step.id) }));
  return build(null);
}

export const isBlockStep = (step) => step.kind === 'REPEAT' || step.kind === 'BRANCH';

/**
 * 실제 스텝 순회. 하위 워크플로우 연결 시 자기 자신을 재귀 호출한다.
 * 각 워크플로우는 자신만의 ctx(로컬 step.id 기준)를 가지므로 분기/PREV_RESPONSE
 * 참조가 워크플로우 경계를 넘지 않는다.
 */
async function executeWorkflow(workflow, userInputs, deps, onStepUpdate, runtime) {
  const ctx = {
    userInputs,
    env: deps.env,
    stepResponses: new Map()
  };

  const { failed } = await runNodes(buildStepTree(workflow.steps), workflow, ctx, deps, onStepUpdate, runtime);
  return { overallStatus: failed ? 'FAILED' : 'SUCCESS', stepResponses: ctx.stepResponses };
}

/** 형제 스텝들을 차례로 — 비동기 요청으로 묶인 것들은 함께 출발시킨다. */
async function runNodes(nodes, workflow, ctx, deps, onStepUpdate, runtime) {
  let failed = false;

  for (const group of groupNodes(nodes)) {
    const results = await Promise.all(
      group.map((node) => runNode(node, workflow, ctx, deps, onStepUpdate, runtime))
    );

    // 중간 입력은 묶음이 끝난 뒤 순서대로 받는다 — 폼이 여러 개 겹쳐 뜨지 않게
    for (const [i, { step }] of group.entries()) {
      if (!results[i].ok || results[i].skipped) continue;
      if (!step.midInputs?.length || !deps.collectMidInputs) continue;
      const extra = await deps.collectMidInputs({
        step,
        uid: `${runtime.stepPrefix}${step.id}`,
        response: ctx.stepResponses.get(step.id)
      });
      Object.assign(ctx.userInputs, extra);
    }

    if (results.some((r) => !r.ok)) {
      failed = true;
      if (group.some(({ step }, i) => !results[i].ok && step.stopOnFailure)) return { failed, stop: true };
    }
  }

  return { failed, stop: false };
}

/**
 * "비동기 요청"(parallel)이 붙은 스텝을 앞 묶음에 합친다.
 * 한 묶음은 Promise.all로 함께 출발하므로, 묶음 안의 스텝끼리는 서로의 응답을
 * 참조할 수 없다 — 그런 값은 다음 묶음에서 쓴다.
 */
function groupNodes(nodes) {
  const groups = [];
  for (const node of nodes) {
    if (node.step.parallel && groups.length > 0) groups[groups.length - 1].push(node);
    else groups.push([node]);
  }
  return groups;
}

async function runNode(node, workflow, ctx, deps, onStepUpdate, runtime) {
  const { step } = node;
  const uid = `${runtime.stepPrefix}${step.id}`;

  try {
    if (step.kind === 'BRANCH') return await runBranchBlock(node, workflow, ctx, deps, onStepUpdate, runtime, uid);
    if (step.kind === 'REPEAT') return await runRepeatBlock(node, workflow, ctx, deps, onStepUpdate, runtime, uid);
    return await runStep(step, workflow, ctx, deps, onStepUpdate, runtime, uid);
  } catch (e) {
    onStepUpdate({ stepId: uid, status: 'FAILED', error: e.message });
    return { ok: false };
  }
}

/** 분기 블록 — 조건이 맞을 때만 안에 든 스텝들이 돈다. */
async function runBranchBlock(node, workflow, ctx, deps, onStepUpdate, runtime, uid) {
  if (!evaluateBranchCondition(node.step, ctx)) {
    onStepUpdate({ stepId: uid, status: 'SKIPPED' });
    markSubtree(node.children, onStepUpdate, runtime, 'SKIPPED');
    return { ok: true, skipped: true };
  }

  onStepUpdate({ stepId: uid, status: 'RUNNING' });
  const result = await runNodes(node.children, workflow, ctx, deps, onStepUpdate, runtime);
  onStepUpdate({ stepId: uid, status: result.failed ? 'FAILED' : 'SUCCESS' });
  return { ok: !result.failed };
}

/**
 * 반복 블록 — 목록의 항목마다(또는 정해진 횟수만큼) 안에 든 스텝들을 돌린다.
 * 회차가 끝나면 안쪽 스텝의 응답은 회차별 배열로 남아, 뒤 스텝이 배열로 참조한다.
 */
async function runRepeatBlock(node, workflow, ctx, deps, onStepUpdate, runtime, uid) {
  const items = repeatItems(node.step.repeat, ctx);
  onStepUpdate({ stepId: uid, status: 'RUNNING', iteration: 0, iterations: items.length });

  const collected = new Map();
  let failures = 0;
  let processed = 0;

  for (const [index, item] of items.entries()) {
    processed = index + 1;
    onStepUpdate({ stepId: uid, status: 'RUNNING', iteration: processed, iterations: items.length });

    // 반복 항목은 그 회차 동안만 보이는 값이라 ctx를 얇게 덮어쓴다.
    // trace는 회차를 실행 이력에 남기기 위한 꼬리표다 (화면 상태는 스텝 단위로 모은다).
    const loopCtx = { ...ctx, loopItem: item };
    const result = await runNodes(node.children, workflow, loopCtx, deps, onStepUpdate, {
      ...runtime,
      trace: `#${processed}`
    });

    for (const child of flatten(node.children)) {
      const body = loopCtx.stepResponses.get(child.step.id);
      if (body !== undefined) collected.set(child.step.id, [...(collected.get(child.step.id) ?? []), body]);
    }

    if (result.failed) {
      failures += 1;
      if (result.stop) break;
    }
  }

  for (const [id, responses] of collected) ctx.stepResponses.set(id, responses);
  const ok = failures === 0;
  onStepUpdate({
    stepId: uid,
    status: ok ? 'SUCCESS' : 'FAILED',
    iteration: processed,
    iterations: items.length,
    failures
  });
  return { ok };
}

const flatten = (nodes) => nodes.flatMap((node) => [node, ...flatten(node.children)]);

const markSubtree = (nodes, onStepUpdate, runtime, status) => {
  for (const node of flatten(nodes)) {
    onStepUpdate({ stepId: `${runtime.stepPrefix}${node.step.id}`, status });
  }
};

/** 반복 항목을 보는 조건은 회차마다 달라지므로 스텝 단위로 미리 따질 수 없다. */
const conditionPerIteration = (step) =>
  !!step.repeat && !!step.branchCondition && conditionSource(step.branchCondition).kind === 'LOOP_ITEM';

/**
 * 낱개 스텝 — 조건을 보고, (블록이 아닌 스텝 자체에 붙은) 반복이면 회차마다 돌린다.
 * 스텝에 직접 붙은 반복·조건은 블록이 생기기 전 형식이라 그대로 읽어 실행한다.
 */
async function runStep(step, workflow, ctx, deps, onStepUpdate, runtime, uid) {
  if (!conditionPerIteration(step) && !evaluateBranchCondition(step, ctx)) {
    onStepUpdate({ stepId: uid, status: 'SKIPPED' });
    return { ok: true, skipped: true };
  }

  return step.repeat
    ? runRepeatedStep(step, workflow, ctx, deps, onStepUpdate, runtime, uid)
    : runSingle(step, workflow, ctx, deps, onStepUpdate, runtime, uid);
}

async function runSingle(step, workflow, ctx, deps, onStepUpdate, runtime, uid) {
  onStepUpdate({ stepId: uid, status: 'RUNNING' });
  const { ok, request, response } = await performStep(step, workflow, ctx, deps, onStepUpdate, runtime, uid);
  ctx.stepResponses.set(step.id, response);
  onStepUpdate({ stepId: uid, status: ok ? 'SUCCESS' : 'FAILED', request, response });
  return { ok };
}

/** 스텝 자체에 붙은 반복(옛 형식) — 회차별 응답을 배열로 모은다. */
async function runRepeatedStep(step, workflow, ctx, deps, onStepUpdate, runtime, uid) {
  const items = repeatItems(step.repeat, ctx);
  onStepUpdate({ stepId: uid, status: 'RUNNING', iteration: 0, iterations: items.length });

  const perIteration = conditionPerIteration(step);
  const responses = [];
  let failures = 0;
  let skipped = 0;
  let processed = 0;
  let lastRequest;

  for (const [index, item] of items.entries()) {
    const loopCtx = { ...ctx, loopItem: item };
    processed = index + 1;
    const progress = { stepId: uid, status: 'RUNNING', iteration: processed, iterations: items.length };

    // 반복 안의 분기 — 조건에 맞지 않는 회차만 건너뛴다
    if (perIteration && !evaluateBranchCondition(step, loopCtx)) {
      skipped += 1;
      onStepUpdate({ ...progress, skipped, request: lastRequest, response: responses });
      continue;
    }

    const { ok, request, response } = await performStep(
      step, workflow, loopCtx, deps, onStepUpdate, { ...runtime, trace: `#${processed}` }, uid
    );
    responses.push(response);
    lastRequest = request;
    onStepUpdate({ ...progress, skipped, request: lastRequest, response: responses });
    if (!ok) {
      failures += 1;
      if (step.stopOnFailure) break;
    }
  }

  ctx.stepResponses.set(step.id, responses);
  const ok = failures === 0;
  onStepUpdate({
    stepId: uid,
    status: ok ? 'SUCCESS' : 'FAILED',
    iteration: processed,
    iterations: items.length,
    failures,
    skipped,
    request: lastRequest,
    response: responses
  });
  return { ok };
}

/** 이번 반복이 돌 항목들 — 목록이면 그 항목, 횟수면 그 수만큼의 빈 자리. */
function repeatItems(repeat, ctx) {
  const cap = Math.min(Number(repeat.maxIterations) || ITERATION_LIMIT, ITERATION_LIMIT);

  if (repeat.kind === 'COUNT') {
    const count = Math.max(0, Math.floor(Number(repeat.count) || 0));
    return Array.from({ length: Math.min(count, cap) }, () => null);
  }

  const body = ctx.stepResponses.get(repeat.sourceStepId);
  if (body === undefined) {
    throw new Error('반복할 목록을 만드는 스텝의 응답이 없습니다.');
  }
  const found = JSONPath({ path: repeat.itemsPath || '$', json: body, wrap: false });
  if (found === undefined || found === null) return [];
  return (Array.isArray(found) ? found : [found]).slice(0, cap);
}

/** 스텝 한 번 실행 — 종류에 따라 갈라지고, 기록·표시는 부르는 쪽이 한다. */
function performStep(step, workflow, ctx, deps, onStepUpdate, runtime, uid) {
  if (step.delayBinding) return runDelayStep(step);
  if (step.workflowBinding) return runWorkflowStep(step, ctx, deps, onStepUpdate, runtime, uid);
  return runApiStep(step, workflow, ctx, deps, runtime, uid);
}

/** 지연 스텝 — 정해진 시간만큼 쉬었다가 다음으로 넘어간다. */
async function runDelayStep(step) {
  const seconds = Math.max(0, Number(step.delayBinding.seconds) || 0);
  await sleep(seconds * 1000);
  return { ok: true, response: { waitedSeconds: seconds } };
}

/** API 호출 스텝. */
async function runApiStep(step, workflow, ctx, deps, runtime, uid) {
  if (!step.apiBinding) throw new Error('처리 API가 설정되지 않았습니다.');
  const template = deps.getRequestTemplate(step);
  const request = resolveTemplate(template, step.apiBinding, ctx);

  const result = await deps.proxy({
    execution_id: runtime.executionId,
    step_id: `${uid}${runtime.trace ?? ''}`,
    workflow_id: workflow.id,
    request
  });

  return { ok: isOk(result.response.status), request, response: result.response.body };
}

/** 다른 업무(워크플로우) 연결 스텝 — 하위 워크플로우를 재귀 실행. */
async function runWorkflowStep(step, ctx, deps, onStepUpdate, runtime, uid) {
  const wb = step.workflowBinding;
  if (!deps.getWorkflow) throw new Error('API Chain 연결이 지원되지 않습니다 (getWorkflow 미설정).');
  if (runtime.callStack.has(wb.ref.id)) {
    throw new Error(`API Chain 순환 참조: ${wb.ref.id}`);
  }

  // 부모 컨텍스트 → 하위 워크플로우 입력값 매핑
  const subInputs = {};
  for (const [key, source] of Object.entries(wb.inputMappings)) {
    subInputs[key] = resolveValue(source, ctx);
  }

  const subWorkflow = await deps.getWorkflow(wb.ref.id);
  const subResult = await executeWorkflow(subWorkflow, subInputs, deps, onStepUpdate, {
    executionId: runtime.executionId,
    stepPrefix: `${uid}${runtime.trace ?? ''}/`,
    callStack: new Set([...runtime.callStack, subWorkflow.id])
  });

  return {
    ok: subResult.overallStatus === 'SUCCESS',
    response: {
      status: subResult.overallStatus,
      steps: Object.fromEntries(subResult.stepResponses)
    }
  };
}
