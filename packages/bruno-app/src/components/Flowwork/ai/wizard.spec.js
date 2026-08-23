import { draftNote, localKeywords, withoutDraftNote } from './wizard';

const entry = { department: 'core', itemPath: ['계좌'], name: '계좌 목록 조회 (보안ID)' };

const timeline = [
  {
    kind: 'analyze',
    request: '',
    steps: [
      { round: 1, lines: ['API가 받는 값과 내놓는 값 확인 — 계좌 목록 조회 (보안ID)'], thought: '' },
      { answers: [{ question: '조회 대상 계좌는?', answer: '휴면(DORMANT) 계좌만' }] }
    ]
  },
  { kind: 'draft', version: { draft: { reason: '앱 사용자 ID만 받으면 나머지는 조회로 채울 수 있어서' } } },
  { kind: 'analyze', request: '반복 앞에 2초 대기를 넣어 주세요', steps: [] },
  { kind: 'draft', version: { draft: { reason: '대기를 넣어 호출 간격을 벌렸다' } } }
];

describe('draftNote', () => {
  const note = () => draftNote({ purpose: 'BATCH', pickedEntries: [entry], pickedWorkflows: [], timeline });

  it('무엇을 고르고 무엇을 답했고 무엇을 고쳐 달라 했는지 남긴다', () => {
    expect(note()).toContain('목적: 다건 처리');
    expect(note()).toContain('core/계좌/계좌 목록 조회 (보안ID)');
    expect(note()).toContain('조회 대상 계좌는? → 휴면(DORMANT) 계좌만');
    expect(note()).toContain('1. 반복 앞에 2초 대기를 넣어 주세요');
  });

  it('근거는 마지막 판의 것을 남긴다 — 앞 판은 이미 갈아엎였다', () => {
    expect(note()).toContain('대기를 넣어 호출 간격을 벌렸다');
    expect(note()).not.toContain('앱 사용자 ID만 받으면');
  });

  it('물어본 것도 고친 것도 없으면 그 절은 넣지 않는다', () => {
    const bare = draftNote({
      purpose: 'LOOKUP',
      pickedEntries: [entry],
      pickedWorkflows: [],
      timeline: [{ kind: 'analyze', request: '', steps: [] }, { kind: 'draft', version: { draft: { reason: '' } } }]
    });

    expect(bare).not.toContain('물어보고 답한 것');
    expect(bare).not.toContain('고쳐 달라고 한 것');
    expect(bare).toContain('목적: 조회');
  });
});

describe('withoutDraftNote', () => {
  it('사람이 쓴 문서만 남기고 앞서 붙인 참고 글은 떼어 낸다', () => {
    const docs = `이 작업은 매달 첫 영업일에 돌린다.\n\n${draftNote({
      purpose: 'LOOKUP',
      pickedEntries: [entry],
      pickedWorkflows: [],
      timeline
    })}`;

    expect(withoutDraftNote(docs)).toBe('이 작업은 매달 첫 영업일에 돌린다.');
  });

  it('붙은 적이 없으면 그대로 둔다', () => {
    expect(withoutDraftNote('사람이 쓴 문서')).toBe('사람이 쓴 문서');
    expect(withoutDraftNote(undefined)).toBe('');
  });
});

describe('localKeywords', () => {
  it('위치·이름·설명을 낱말로 쪼개고 겹치는 것은 하나만 남긴다', () => {
    const words = localKeywords({ domain: '계좌', task: '조회/잔액', name: '계좌 잔액 확인', description: '' });

    expect(words).toEqual(['계좌', '조회', '잔액', '확인']);
  });

  it('한 글자는 검색어로 쓰지 않는다', () => {
    expect(localKeywords({ domain: '계좌', task: '', name: '이 값 조회', description: '' })).toEqual(['계좌', '조회']);
  });
});
