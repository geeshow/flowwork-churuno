import { findEntries, producersFor, rankEntries, rankWorkflows } from './relevance';

const entry = (over) => ({
  id: 'e1',
  department: 'core',
  itemPath: ['계좌'],
  name: '계좌 목록 조회',
  method: 'GET',
  url: '{{coreBaseUrl}}/accounts',
  variables: [],
  outputFields: [],
  outputLabels: {},
  ...over
});

const users = entry({
  id: 'users',
  itemPath: ['사용자'],
  name: '사용자 정보 조회 (앱ID)',
  url: '{{coreBaseUrl}}/users/{{app_user_id}}',
  variables: ['authToken', 'coreBaseUrl', 'app_user_id'],
  outputFields: ['sec_user_id', 'name']
});

const accounts = entry({
  id: 'accounts',
  name: '계좌 목록 조회 (보안ID)',
  url: '{{coreBaseUrl}}/accounts?sec_user_id={{sec_user_id}}',
  variables: ['authToken', 'coreBaseUrl', 'sec_user_id'],
  outputFields: ['accountNo', 'balance.amount'],
  outputLabels: { 'accountNo': '계좌번호', 'balance.amount': '잔액' }
});

describe('rankEntries', () => {
  it('이름에 걸린 것이 출력 라벨에만 걸린 것보다 앞선다', () => {
    const terms = entry({
      id: 'terms',
      name: '약정 조회',
      itemPath: ['약정'],
      outputLabels: { accountNo: '계좌번호' }
    });
    const ranked = rankEntries([terms, accounts], ['계좌']);

    expect(ranked.map((r) => r.entry.id)).toEqual(['accounts', 'terms']);
  });

  it('출력 라벨에만 있는 말도 찾는다 — 이름에 없는 "잔액"이 걸린다', () => {
    const ranked = rankEntries([users, accounts], ['잔액']);

    expect(ranked).toHaveLength(1);
    expect(ranked[0].entry.id).toBe('accounts');
    expect(ranked[0].where).toEqual(['출력']);
  });

  it('걸린 낱말을 근거로 남기고, 걸리지 않은 것은 빼놓는다', () => {
    const ranked = rankEntries([users, accounts], ['계좌', '없는말']);

    expect(ranked).toHaveLength(1);
    expect(ranked[0].hits).toEqual(['계좌']);
  });

  it('한 글자 낱말은 아무것도 걸지 않는다 — 어디에나 걸려 순위를 흐린다', () => {
    expect(rankEntries([users, accounts], ['조'])).toEqual([]);
  });
});

describe('rankWorkflows', () => {
  it('이름·분류·설명에서 찾는다', () => {
    const wf = { id: 'w1', domain: '계좌', task: '폐쇄', name: '휴면 계좌 폐쇄', description: '오래 쓰지 않은 계좌를 닫는다' };
    const ranked = rankWorkflows([wf], ['폐쇄']);

    expect(ranked[0].workflow.id).toBe('w1');
    expect(ranked[0].where).toContain('이름');
  });
});

describe('findEntries', () => {
  it('빈 글자로는 아무것도 돌려주지 않는다', () => {
    expect(findEntries([users, accounts], '  ')).toEqual([]);
  });

  it('변수 이름으로도 찾는다', () => {
    expect(findEntries([users, accounts], 'sec_user_id').map((e) => e.id)).toEqual(['accounts']);
  });
});

describe('producersFor', () => {
  it('고른 API가 요구하는 값을 내놓는 API를 찾아낸다', () => {
    const found = producersFor([users, accounts], [accounts], ['authToken', 'coreBaseUrl']);

    expect(found).toHaveLength(1);
    expect(found[0].entry.id).toBe('users');
    expect(found[0].supplies).toEqual([{ variable: 'sec_user_id', forName: accounts.name }]);
  });

  it('환경 변수로 채워지는 값은 공급 관계로 보지 않는다', () => {
    const tokenSource = entry({ id: 'token', name: '토큰 발급', outputFields: ['authToken'] });
    const found = producersFor([tokenSource, accounts], [accounts], ['authToken', 'coreBaseUrl']);

    expect(found).toEqual([]);
  });

  it('자기 자신은 빼놓지만 이미 고른 공급자는 남긴다', () => {
    const found = producersFor([users, accounts], [users, accounts], []);

    expect(found.map((row) => row.entry.id)).toEqual(['users']);
  });

  it('중첩 출력 경로는 마지막 마디로 잇는다', () => {
    const closer = entry({ id: 'closer', name: '계좌 폐쇄', variables: ['cif'] });
    const owner = entry({ id: 'owner', name: '소유자 조회', outputFields: ['owner.cif'] });
    const found = producersFor([owner, closer], [closer], []);

    expect(found[0].entry.id).toBe('owner');
  });
});
