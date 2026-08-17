/** 스텝 id — 워크플로우 안에서만 유일하면 되고, 파일에 그대로 남는다. */
export const stepId = () => `step_${Math.random().toString(36).slice(2, 8)}`;

/** 종류를 고른 직후의 빈 스텝 — 나머지는 편집기에서 채운다. */
export function newStep(kind, parentId) {
  const base = {
    id: stepId(),
    order: 0,
    name: '', // API/업무를 선택하면 그 이름으로 자동 설정
    ...(parentId ? { parentId } : {})
  };
  switch (kind) {
    case 'REPEAT':
      return { ...base, kind: 'REPEAT', name: '반복', repeat: { kind: 'COUNT', count: 3 } };
    case 'BRANCH':
      return {
        ...base,
        kind: 'BRANCH',
        name: '분기',
        branchCondition: { source: { kind: 'USER_INPUT', inputKey: '' }, operator: 'EQ', compareValue: '' }
      };
    case 'DELAY':
      return { ...base, name: '대기', delayBinding: { seconds: 3 } };
    case 'WORKFLOW':
      return { ...base, workflowBinding: { ref: { id: '' }, inputMappings: {} } };
    default:
      return {
        ...base,
        apiBinding: {
          catalogEntry: { department: '', collectionFile: '', itemPath: [], name: '' },
          variableBindings: {}
        }
      };
  }
}
