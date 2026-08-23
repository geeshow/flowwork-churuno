import { toolbox } from './converse';

jest.mock('utils/ai', () => ({ aiGenerateText: jest.fn() }));

const entry = (over) => ({
  id: over.name,
  department: 'core',
  itemPath: [],
  method: 'GET',
  url: '{{coreBaseUrl}}/x',
  variables: [],
  outputFields: [],
  outputLabels: {},
  ...over
});

describe('toolbox.api_search', () => {
  it('카탈로그 순서가 아니라 점수 순으로 답한다 — 이름에 걸린 것이 주소에만 걸린 것보다 앞선다', () => {
    const byUrl = entry({ name: '목록', url: '{{coreBaseUrl}}/balance' });
    const byName = entry({ name: '잔액 조회', url: '{{coreBaseUrl}}/accounts' });
    const tools = toolbox({ entries: [byUrl, byName], workflows: [], envKeys: [], getWorkflow: () => null });

    const lines = tools.api_search('잔액 balance');

    expect(lines[0]).toContain('잔액 조회');
    expect(lines).toHaveLength(2);
  });

  it('낱말로 안 걸리는 글은 통째로 부분 일치로 찾는다', () => {
    const odd = entry({ name: 'a/b' });
    const tools = toolbox({ entries: [odd, entry({ name: '다른' })], workflows: [], envKeys: [], getWorkflow: () => null });

    expect(tools.api_search('a/b')).toHaveLength(1);
  });

  it('답은 25줄을 넘지 않는다', () => {
    const many = Array.from({ length: 40 }, (_, i) => entry({ name: `계좌 ${i}` }));
    const tools = toolbox({ entries: many, workflows: [], envKeys: [], getWorkflow: () => null });

    expect(tools.api_search('계좌')).toHaveLength(25);
  });
});
