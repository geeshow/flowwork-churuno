import { runWorkflow } from './runWorkflow';

const template = { method: 'POST', url: { raw: 'http://api/close/{{accountNo}}' }, header: [] };

// 호출된 순서·요청을 그대로 모아 두는 프록시 — 반복/병렬 검증에 쓴다
const makeDeps = (overrides = {}) => {
  const calls = [];
  return {
    calls,
    deps: {
      env: {},
      getRequestTemplate: () => template,
      proxy: async ({ step_id, request }) => {
        calls.push({ stepId: step_id, url: request.url });
        return { response: { status: 200, body: { ok: step_id } } };
      },
      ...overrides
    }
  };
};

const apiStep = (id, order, extra = {}) => ({
  id,
  order,
  name: id,
  apiBinding: {
    catalogEntry: { department: 'core', collectionFile: 'core', itemPath: [], name: id },
    variableBindings: { accountNo: { kind: 'FIXED', value: id } }
  },
  ...extra
});

const workflowOf = (steps) => ({ id: 'wf', name: 'wf', baseInputs: [], steps });

describe('runWorkflow — 반복', () => {
  it('목록의 항목마다 스텝을 돌리고, 회차의 항목을 요청에 넣는다', async () => {
    const collected = [];
    const { deps } = makeDeps({
      proxy: async ({ step_id, request }) => {
        collected.push({ stepId: step_id, url: request.url });
        if (step_id === 'list') {
          return { response: { status: 200, body: { data: { accounts: [{ no: 'A1' }, { no: 'A2' }, { no: 'A3' }] } } } };
        }
        return { response: { status: 200, body: { closed: request.url } } };
      }
    });

    const workflow = workflowOf([
      apiStep('list', 1),
      apiStep('close', 2, {
        repeat: { kind: 'LIST', sourceStepId: 'list', itemsPath: '$.data.accounts', maxIterations: 10 },
        apiBinding: {
          catalogEntry: { department: 'core', collectionFile: 'core', itemPath: [], name: 'close' },
          variableBindings: { accountNo: { kind: 'LOOP_ITEM', itemPath: '$.no' } }
        }
      })
    ]);

    const updates = [];
    const result = await runWorkflow(workflow, {}, deps, (u) => updates.push(u));

    expect(result.overallStatus).toBe('SUCCESS');
    expect(collected.filter((c) => c.stepId.startsWith('close'))).toEqual([
      { stepId: 'close#1', url: 'http://api/close/A1' },
      { stepId: 'close#2', url: 'http://api/close/A2' },
      { stepId: 'close#3', url: 'http://api/close/A3' }
    ]);
    // 회차 진행이 화면에 보고된다
    const last = updates.filter((u) => u.stepId === 'close').pop();
    expect(last).toMatchObject({ status: 'SUCCESS', iteration: 3, iterations: 3 });
    expect(last.response).toHaveLength(3);
  });

  it('maxIterations만큼만 돌린다', async () => {
    const { deps } = makeDeps();
    const collected = [];
    deps.proxy = async (payload) => {
      collected.push(payload.step_id);
      return { response: { status: 200, body: { list: [1, 2, 3, 4, 5] } } };
    };

    const workflow = workflowOf([
      apiStep('list', 1),
      apiStep('each', 2, { repeat: { kind: 'LIST', sourceStepId: 'list', itemsPath: '$.list', maxIterations: 2 } })
    ]);

    await runWorkflow(workflow, {}, deps, () => {});
    expect(collected.filter((id) => id.startsWith('each'))).toEqual(['each#1', 'each#2']);
  });

  it('횟수 반복은 그 수만큼 돌린다', async () => {
    const { calls, deps } = makeDeps();
    const workflow = workflowOf([apiStep('ping', 1, { repeat: { kind: 'COUNT', count: 3 } })]);

    await runWorkflow(workflow, {}, deps, () => {});
    expect(calls.map((c) => c.stepId)).toEqual(['ping#1', 'ping#2', 'ping#3']);
  });
});

describe('runWorkflow — 블록(반복·분기)', () => {
  it('반복 블록은 목록마다 안에 든 스텝들을 순서대로 돌린다', async () => {
    const collected = [];
    const { deps } = makeDeps({
      proxy: async ({ step_id, request }) => {
        collected.push(step_id);
        if (step_id === 'list') {
          return { response: { status: 200, body: { data: [{ no: 'A1' }, { no: 'A2' }] } } };
        }
        return { response: { status: 200, body: { url: request.url } } };
      }
    });

    const workflow = workflowOf([
      apiStep('list', 1),
      { id: 'loop', order: 2, kind: 'REPEAT', name: '계좌마다', repeat: { kind: 'LIST', sourceStepId: 'list', itemsPath: '$.data' } },
      apiStep('first', 3, { parentId: 'loop' }),
      apiStep('second', 4, { parentId: 'loop' })
    ]);

    const updates = [];
    const result = await runWorkflow(workflow, {}, deps, (u) => updates.push(u));

    expect(result.overallStatus).toBe('SUCCESS');
    // 회차마다 안쪽 스텝이 차례로 (실행 이력에는 회차 꼬리표가 붙는다)
    expect(collected).toEqual(['list', 'first#1', 'second#1', 'first#2', 'second#2']);
    expect(updates.filter((u) => u.stepId === 'loop').pop()).toMatchObject({
      status: 'SUCCESS',
      iteration: 2,
      iterations: 2
    });
  });

  it('분기 블록은 조건이 맞지 않으면 안에 든 스텝을 통째로 건너뛴다', async () => {
    const { calls, deps } = makeDeps();
    const workflow = workflowOf([
      apiStep('always', 1),
      {
        id: 'onlyVip',
        order: 2,
        kind: 'BRANCH',
        name: 'VIP일 때',
        branchCondition: { source: { kind: 'USER_INPUT', inputKey: 'grade' }, operator: 'EQ', compareValue: 'VIP' }
      },
      apiStep('perk', 3, { parentId: 'onlyVip' })
    ]);

    const updates = [];
    await runWorkflow(workflow, { grade: 'BASIC' }, deps, (u) => updates.push(u));

    expect(calls.map((c) => c.stepId)).toEqual(['always']);
    expect(updates.find((u) => u.stepId === 'onlyVip')).toMatchObject({ status: 'SKIPPED' });
    expect(updates.find((u) => u.stepId === 'perk')).toMatchObject({ status: 'SKIPPED' });
  });

  it('반복 블록 안의 분기 블록은 회차마다 따진다', async () => {
    const collected = [];
    const { deps } = makeDeps({
      proxy: async ({ step_id }) => {
        collected.push(step_id);
        if (step_id === 'list') {
          return {
            response: {
              status: 200,
              body: { data: [{ no: 'A1', status: 'ACTIVE' }, { no: 'A2', status: 'CLOSED' }] }
            }
          };
        }
        return { response: { status: 200, body: {} } };
      }
    });

    const workflow = workflowOf([
      apiStep('list', 1),
      { id: 'loop', order: 2, kind: 'REPEAT', name: '계좌마다', repeat: { kind: 'LIST', sourceStepId: 'list', itemsPath: '$.data' } },
      {
        id: 'ifActive',
        order: 3,
        kind: 'BRANCH',
        name: '활성일 때',
        parentId: 'loop',
        branchCondition: { source: { kind: 'LOOP_ITEM', itemPath: '$.status' }, operator: 'EQ', compareValue: 'ACTIVE' }
      },
      apiStep('close', 4, { parentId: 'ifActive' })
    ]);

    await runWorkflow(workflow, {}, deps, () => {});
    // ACTIVE인 첫 회차에서만 안쪽 스텝이 돈다
    expect(collected).toEqual(['list', 'close#1']);
  });

  it('반복 블록이 끝나면 안쪽 스텝의 응답은 회차별 배열로 남는다', async () => {
    const { deps } = makeDeps({
      proxy: async ({ step_id }) => {
        if (step_id === 'list') return { response: { status: 200, body: { data: [1, 2] } } };
        if (step_id.startsWith('inner')) return { response: { status: 200, body: { seq: step_id } } };
        return { response: { status: 200, body: {} } };
      }
    });

    const workflow = workflowOf([
      apiStep('list', 1),
      { id: 'loop', order: 2, kind: 'REPEAT', name: '반복', repeat: { kind: 'LIST', sourceStepId: 'list', itemsPath: '$.data' } },
      apiStep('inner', 3, { parentId: 'loop' }),
      apiStep('after', 4, {
        apiBinding: {
          catalogEntry: { department: 'core', collectionFile: 'core', itemPath: [], name: 'after' },
          variableBindings: { accountNo: { kind: 'PREV_RESPONSE', stepId: 'inner', jsonPath: '$[1].seq' } }
        }
      })
    ]);

    const updates = [];
    await runWorkflow(workflow, {}, deps, (u) => updates.push(u));

    // 뒤 스텝이 배열의 두 번째 회차 응답을 집어 쓴다
    const after = updates.filter((u) => u.stepId === 'after').pop();
    expect(after.request.url).toBe('http://api/close/inner#2');
  });
});

describe('runWorkflow — 병렬', () => {
  it('"앞 스텝과 동시에" 표시가 붙은 스텝은 함께 출발한다', async () => {
    const events = [];
    const deps = {
      env: {},
      getRequestTemplate: () => template,
      proxy: async ({ step_id }) => {
        events.push(`start:${step_id}`);
        await new Promise((resolve) => setTimeout(resolve, step_id === 'a' ? 20 : 0));
        events.push(`end:${step_id}`);
        return { response: { status: 200, body: {} } };
      }
    };

    const workflow = workflowOf([apiStep('a', 1), apiStep('b', 2, { parallel: true }), apiStep('c', 3)]);
    await runWorkflow(workflow, {}, deps, () => {});

    // a와 b는 서로 끝나기를 기다리지 않고, c는 그 묶음이 끝난 뒤에 시작한다
    expect(events.slice(0, 2)).toEqual(['start:a', 'start:b']);
    expect(events.indexOf('start:c')).toBeGreaterThan(events.indexOf('end:a'));
  });
});

describe('runWorkflow — 지연', () => {
  it('정해진 시간만큼 쉬고 다음 스텝으로 넘어간다', async () => {
    const { calls, deps } = makeDeps();
    const workflow = workflowOf([
      apiStep('first', 1),
      { id: 'wait', order: 2, name: '대기', delayBinding: { seconds: 0.01 } },
      apiStep('second', 3)
    ]);

    const updates = [];
    const started = Date.now();
    const result = await runWorkflow(workflow, {}, deps, (u) => updates.push(u));

    expect(result.overallStatus).toBe('SUCCESS');
    expect(Date.now() - started).toBeGreaterThanOrEqual(10);
    expect(calls.map((c) => c.stepId)).toEqual(['first', 'second']); // 지연은 API를 부르지 않는다
    expect(updates.filter((u) => u.stepId === 'wait').pop()).toMatchObject({
      status: 'SUCCESS',
      response: { waitedSeconds: 0.01 }
    });
  });
});

describe('runWorkflow — 분기', () => {
  it('입력값 조건이 맞지 않으면 그 스텝을 건너뛴다', async () => {
    const { calls, deps } = makeDeps();
    const workflow = workflowOf([
      apiStep('always', 1),
      apiStep('onlyForVip', 2, {
        branchCondition: { source: { kind: 'USER_INPUT', inputKey: 'grade' }, operator: 'EQ', compareValue: 'VIP' }
      })
    ]);

    const updates = [];
    await runWorkflow(workflow, { grade: 'BASIC' }, deps, (u) => updates.push(u));

    expect(calls.map((c) => c.stepId)).toEqual(['always']);
    expect(updates.find((u) => u.stepId === 'onlyForVip')).toMatchObject({ status: 'SKIPPED' });
  });

  it('반복 안의 조건은 회차마다 따져 맞지 않는 회차만 건너뛴다', async () => {
    const collected = [];
    const { deps } = makeDeps({
      proxy: async ({ step_id, request }) => {
        collected.push({ stepId: step_id, url: request.url });
        if (step_id === 'list') {
          return {
            response: {
              status: 200,
              body: { data: [{ no: 'A1', status: 'ACTIVE' }, { no: 'A2', status: 'CLOSED' }, { no: 'A3', status: 'ACTIVE' }] }
            }
          };
        }
        return { response: { status: 200, body: { ok: true } } };
      }
    });

    const workflow = workflowOf([
      apiStep('list', 1),
      apiStep('each', 2, {
        repeat: { kind: 'LIST', sourceStepId: 'list', itemsPath: '$.data' },
        branchCondition: { source: { kind: 'LOOP_ITEM', itemPath: '$.status' }, operator: 'EQ', compareValue: 'ACTIVE' },
        apiBinding: {
          catalogEntry: { department: 'core', collectionFile: 'core', itemPath: [], name: 'each' },
          variableBindings: { accountNo: { kind: 'LOOP_ITEM', itemPath: '$.no' } }
        }
      })
    ]);

    const updates = [];
    const result = await runWorkflow(workflow, {}, deps, (u) => updates.push(u));

    expect(result.overallStatus).toBe('SUCCESS');
    // CLOSED인 두 번째 회차만 호출되지 않는다
    expect(collected.filter((c) => c.stepId.startsWith('each'))).toEqual([
      { stepId: 'each#1', url: 'http://api/close/A1' },
      { stepId: 'each#3', url: 'http://api/close/A3' }
    ]);
    const last = updates.filter((u) => u.stepId === 'each').pop();
    expect(last).toMatchObject({ status: 'SUCCESS', iteration: 3, iterations: 3, skipped: 1 });
    expect(last.response).toHaveLength(2); // 실제로 돈 회차의 응답만 남는다
  });

  it('예전 형식(sourceStepId/jsonPath)의 조건도 그대로 읽는다', async () => {
    const { deps } = makeDeps();
    const collected = [];
    deps.proxy = async (payload) => {
      collected.push(payload.step_id);
      return { response: { status: 200, body: { data: { status: 'ACTIVE' } } } };
    };

    const workflow = workflowOf([
      apiStep('lookup', 1),
      apiStep('cancel', 2, {
        branchCondition: { sourceStepId: 'lookup', jsonPath: '$.data.status', operator: 'EQ', compareValue: 'ACTIVE' }
      })
    ]);

    await runWorkflow(workflow, {}, deps, () => {});
    expect(collected).toEqual(['lookup', 'cancel']);
  });
});
