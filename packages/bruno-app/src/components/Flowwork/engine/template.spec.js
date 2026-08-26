import { requestFieldSlots, resolveTemplate } from './template';

const ctx = (userInputs = {}, env = {}) => ({ userInputs, env, stepResponses: new Map() });

describe('requestFieldSlots', () => {
  const template = {
    method: 'POST',
    url: { raw: 'http://api/customers?page=1&size=10&sort={{sortKey}}' },
    header: [
      { key: 'X-Channel', value: 'WEB' },
      { key: 'Authorization', value: 'Bearer {{token}}' },
      { key: 'X-Off', value: 'x', disabled: true }
    ],
    body: { mode: 'raw', raw: '{"name": "kim", "address": {"city": "seoul"}, "tags": ["a"]}' }
  };

  it('헤더/쿼리/바디 필드를 템플릿 값과 함께 슬롯으로 나열한다 (중첩 바디는 점 표기, 배열은 값 없이)', () => {
    expect(requestFieldSlots(template)).toEqual([
      { key: 'header:X-Channel', label: '헤더 X-Channel', value: 'WEB' },
      { key: 'query:page', label: '쿼리 page', value: '1' },
      { key: 'query:size', label: '쿼리 size', value: '10' },
      { key: 'body:name', label: '바디 name', value: 'kim' },
      { key: 'body:address.city', label: '바디 address.city', value: 'seoul' },
      { key: 'body:tags', label: '바디 tags' }
    ]);
  });

  it('{{var}}가 든 값과 비활성 헤더는 제외한다', () => {
    const keys = requestFieldSlots(template).map((s) => s.key);
    expect(keys).not.toContain('header:Authorization');
    expect(keys).not.toContain('header:X-Off');
    expect(keys).not.toContain('query:sort');
  });

  it('바디가 JSON이 아니면 바디 슬롯이 없다', () => {
    const slots = requestFieldSlots({
      method: 'POST',
      url: { raw: 'http://api/x' },
      header: [],
      body: { mode: 'raw', raw: '{"id": {{customerId}}}' }
    });
    expect(slots).toEqual([]);
  });
});

describe('resolveTemplate — 필드 바인딩', () => {
  const template = {
    method: 'get',
    url: { raw: 'http://api/customers?page=1&size=10' },
    header: [{ key: 'X-Channel', value: 'WEB' }],
    body: { mode: 'raw', raw: '{"name": "kim", "address": {"city": "seoul"}}' }
  };

  it('바인딩하지 않은 필드는 템플릿 값이 그대로 남는다', () => {
    const request = resolveTemplate(template, { variableBindings: {} }, ctx());
    expect(request.url).toBe('http://api/customers?page=1&size=10');
    expect(request.headers).toEqual({ 'X-Channel': 'WEB' });
    expect(request.body).toEqual({ name: 'kim', address: { city: 'seoul' } });
  });

  it('header:/query:/body: 바인딩이 요청을 덮어쓴다', () => {
    const binding = {
      variableBindings: {
        'header:X-Channel': { kind: 'USER_INPUT', inputKey: 'channel' },
        'query:page': { kind: 'FIXED', value: '3' },
        'body:address.city': { kind: 'USER_INPUT', inputKey: 'city' }
      }
    };
    const request = resolveTemplate(template, binding, ctx({ channel: 'APP', city: 'busan' }));
    expect(request.headers['X-Channel']).toBe('APP');
    expect(request.url).toBe('http://api/customers?page=3&size=10');
    expect(request.body).toEqual({ name: 'kim', address: { city: 'busan' } });
  });

  it('URL에 없던 쿼리 파라미터는 추가되고, 값은 인코딩된다', () => {
    const binding = { variableBindings: { 'query:keyword': { kind: 'FIXED', value: '김 철수' } } };
    const request = resolveTemplate(template, binding, ctx());
    expect(request.url).toBe('http://api/customers?page=1&size=10&keyword=%EA%B9%80%20%EC%B2%A0%EC%88%98');
  });

  it('템플릿 변수 치환과 필드 바인딩이 함께 동작한다', () => {
    const withVar = {
      method: 'POST',
      url: { raw: 'http://api/accounts/{{accountNo}}' },
      header: [],
      body: { mode: 'raw', raw: '{"amount": 0}' }
    };
    const binding = {
      variableBindings: {
        'accountNo': { kind: 'FIXED', value: '110-123' },
        'body:amount': { kind: 'USER_INPUT', inputKey: 'amount' }
      }
    };
    const request = resolveTemplate(withVar, binding, ctx({ amount: 5000 }));
    expect(request.url).toBe('http://api/accounts/110-123');
    expect(request.body).toEqual({ amount: 5000 });
  });
});
