import { inputsFromSuggestion, stepsFromPlan } from './index';

const entry = {
  id: 'abc123',
  department: 'core',
  collectionFile: 'core',
  itemPath: ['계좌'],
  name: '계좌 목록 조회 (보안ID)',
  variables: ['authToken', 'coreBaseUrl', 'sec_user_id'],
  outputFields: ['accountNo', 'status', 'owner.cif']
};

const node = (over) => ({
  ref: 's1',
  kind: 'API',
  name: '스텝',
  why: '',
  entry: null,
  linkedId: '',
  missing: false,
  bindings: {},
  children: [],
  ...over
});

describe('stepsFromPlan', () => {
  it('블록 안에 든 스텝은 parentId로 그 블록을 가리킨다', () => {
    const steps = stepsFromPlan([
      node({ ref: 's1', entry }),
      node({
        ref: 's2',
        kind: 'REPEAT',
        repeat: { kind: 'LIST', sourceRef: 's1', itemsPath: '$.data', maxIterations: 5 },
        children: [node({ ref: 's3', entry, bindings: { sec_user_id: { kind: 'LOOP_ITEM', itemPath: '$.owner.cif' } } })]
      })
    ]);

    expect(steps).toHaveLength(3);
    expect(steps[1].kind).toBe('REPEAT');
    expect(steps[1].repeat.sourceStepId).toBe(steps[0].id);
    expect(steps[2].parentId).toBe(steps[1].id);
    expect(steps[2].apiBinding.variableBindings.sec_user_id).toEqual({ kind: 'LOOP_ITEM', itemPath: '$.owner.cif' });
  });

  it('앞 스텝 참조(ref)는 그 스텝의 id로 바뀐다', () => {
    const steps = stepsFromPlan([
      node({ ref: 'a', entry }),
      node({ ref: 'b', entry, bindings: { sec_user_id: { kind: 'PREV_RESPONSE', stepRef: 'a', jsonPath: '$.data.id' } } })
    ]);

    expect(steps[1].apiBinding.variableBindings.sec_user_id).toEqual({
      kind: 'PREV_RESPONSE',
      stepId: steps[0].id,
      jsonPath: '$.data.id'
    });
  });

  it('가리키는 스텝이 없는 참조는 바인딩에서 빠진다', () => {
    const steps = stepsFromPlan([
      node({ entry, bindings: { sec_user_id: { kind: 'PREV_RESPONSE', stepRef: '없음', jsonPath: '$' } } })
    ]);

    expect(steps[0].apiBinding.variableBindings).toEqual({});
  });

  it('환경 변수와 이름이 같은 변수는 환경변수로 미리 이어 둔다', () => {
    const steps = stepsFromPlan([node({ entry })], new Set(['authToken', 'coreBaseUrl']));

    expect(steps[0].apiBinding.variableBindings).toEqual({
      authToken: { kind: 'ENV', envKey: 'authToken' },
      coreBaseUrl: { kind: 'ENV', envKey: 'coreBaseUrl' }
    });
  });

  it('카탈로그에서 찾지 못한 API는 빈 채로 두어 직접 고르게 한다', () => {
    const steps = stepsFromPlan([node({ entry: null, missing: true })]);

    expect(steps[0].apiBinding.catalogEntry.name).toBe('');
    expect(steps[0].resultView).toBeUndefined();
  });

  it('분기 블록의 조건은 연산자까지 그대로 옮기고, 모르는 연산자는 EQ로 둔다', () => {
    const [branch] = stepsFromPlan([
      node({
        kind: 'BRANCH',
        condition: { source: { kind: 'USER_INPUT', inputKey: 'status' }, operator: '???', compareValue: 'ACTIVE' }
      })
    ]);

    expect(branch.branchCondition).toEqual({
      source: { kind: 'USER_INPUT', inputKey: 'status' },
      operator: 'EQ',
      compareValue: 'ACTIVE'
    });
  });

  it('지연 스텝은 초만 남는다', () => {
    const [delay] = stepsFromPlan([node({ kind: 'DELAY', seconds: 2 })]);

    expect(delay.delayBinding).toEqual({ seconds: 2 });
    expect(delay.apiBinding).toBeUndefined();
  });

  it('초 수를 delay 안에 넣어 와도 그대로 받는다', () => {
    const [delay] = stepsFromPlan([node({ kind: 'DELAY', seconds: undefined, delay: { seconds: 5 } })]);

    expect(delay.delayBinding).toEqual({ seconds: 5 });
  });
});

describe('inputsFromSuggestion', () => {
  it('참조한 API를 찾았으면 그 id로 의존 조회를 만든다', () => {
    const [input] = inputsFromSuggestion([
      {
        key: 'sec_user_id',
        label: '보안 사용자 ID',
        kind: 'DEPENDENT_LOOKUP',
        dependsOnKey: 'app_user_id',
        valueField: 'sec_user_id',
        displayFields: ['name'],
        entry
      }
    ]);

    expect(input).toEqual({
      key: 'sec_user_id',
      label: '보안 사용자 ID',
      kind: 'DEPENDENT_LOOKUP',
      dependsOnKey: 'app_user_id',
      lookupApiId: 'abc123',
      displayFields: ['name'],
      valueField: 'sec_user_id'
    });
  });

  it('API를 찾지 못한 콤보는 직접 입력으로 내린다', () => {
    const [input] = inputsFromSuggestion([{ key: 'x', label: 'X', kind: 'API_COMBO', entry: null }]);

    expect(input).toEqual({ key: 'x', label: 'X', kind: 'MANUAL', valueType: 'string' });
  });

  it('모르는 타입은 문자열로 둔다', () => {
    const [input] = inputsFromSuggestion([{ key: 'amount', label: '금액', kind: 'MANUAL', valueType: 'money' }]);

    expect(input.valueType).toBe('string');
  });
});
