/**
 * 모델이 낸 초안 → 편집기가 다루는 모양(baseInputs·steps)으로 옮기는 자리.
 *
 * 초안은 언제나 초안이다. API·업무 참조는 목록에서 찾아 확인하고(resolveEntry),
 * 찾지 못한 것은 missing으로 표시해 사람이 직접 고르게 넘긴다 — 지어낸 이름이
 * 편집기에 그대로 들어가지 않게.
 */
import { stepId } from '../editor/stepFactory';

import { catalogEntryOf, resolveEntry } from './catalog';

const KINDS = new Set(['API', 'WORKFLOW', 'DELAY', 'REPEAT', 'BRANCH']);

const OPERATORS = new Set(['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'EXISTS', 'NOT_EXISTS', 'CONTAINS']);

/** 응답의 스텝 나무 → 화면에 보여 줄 계획. 실재 여부(entry/workflowId)를 여기서 확정한다. */
export function planNodes(nodes, entries, known) {
  return nodes.flatMap((node) => {
    const kind = KINDS.has(node.kind) ? node.kind : 'API';
    const entry = kind === 'API' ? resolveEntry(entries, node.api) : null;
    const linkedId = kind === 'WORKFLOW' && known.has(node.workflowId) ? node.workflowId : '';
    return [
      {
        ref: String(node.ref ?? ''),
        kind,
        name: String(node.name ?? '').trim() || entry?.name || '스텝',
        why: String(node.why ?? '').trim(),
        entry,
        linkedId,
        // 카탈로그·작업 목록에서 찾지 못한 참조 — 사람이 직접 골라야 한다
        missing: (kind === 'API' && !entry) || (kind === 'WORKFLOW' && !linkedId),
        bindings: node.bindings ?? node.inputs ?? {},
        seconds: node.seconds ?? node.delay?.seconds,
        repeat: node.repeat,
        condition: node.condition,
        children: Array.isArray(node.children) ? planNodes(node.children, entries, known) : []
      }
    ];
  });
}

/** 응답의 입력값 → 화면에 보여 줄 초안. 참조한 API를 여기서 확정한다. */
export function inputNodes(baseInputs, entries) {
  return (Array.isArray(baseInputs) ? baseInputs : []).flatMap((input) => {
    const key = String(input.key ?? '').trim();
    if (!key) return [];
    return [{ ...input, key, label: String(input.label ?? '').trim() || key, entry: resolveEntry(entries, input.api) }];
  });
}

/** 제안된 입력값 → 편집기의 baseInputs. 참조한 API를 찾지 못했으면 직접 입력으로 내린다. */
export function inputsFromSuggestion(inputs) {
  return inputs.map(({ key, label, kind, valueType, dependsOnKey, valueField, displayFields, labelField, entry }) => {
    const base = { key, label };
    if (entry && kind === 'API_COMBO') {
      return { ...base, kind, sourceApiId: entry.id, labelField: labelField || '', valueField: valueField || '' };
    }
    if (entry && kind === 'DEPENDENT_LOOKUP') {
      return {
        ...base,
        kind,
        dependsOnKey: dependsOnKey || '',
        lookupApiId: entry.id,
        displayFields: Array.isArray(displayFields) ? displayFields : [],
        valueField: valueField || ''
      };
    }
    if (entry && kind === 'DEPENDENT_COMBO') {
      return {
        ...base,
        kind,
        dependsOnKey: dependsOnKey || '',
        lookupApiId: entry.id,
        labelField: labelField || '',
        valueField: valueField || ''
      };
    }
    const type = ['string', 'number', 'password'].includes(valueType) ? valueType : 'string';
    return { ...base, kind: 'MANUAL', valueType: type };
  });
}

const flattenPlan = (plan) => plan.flatMap((node) => [node, ...flattenPlan(node.children)]);

function valueSource(source, idByRef) {
  switch (source?.kind) {
    case 'USER_INPUT':
      return source.inputKey ? { kind: 'USER_INPUT', inputKey: source.inputKey } : null;
    case 'ENV':
      return source.envKey ? { kind: 'ENV', envKey: source.envKey } : null;
    case 'FIXED':
      return { kind: 'FIXED', value: source.value ?? '' };
    case 'LOOP_ITEM':
      return { kind: 'LOOP_ITEM', itemPath: source.itemPath || '$' };
    case 'PREV_RESPONSE': {
      const stepId = idByRef.get(source.stepRef);
      return stepId ? { kind: 'PREV_RESPONSE', stepId, jsonPath: source.jsonPath || '$' } : null;
    }
    default:
      return null;
  }
}

/**
 * 계획 → 편집기의 스텝 배열(평면 + parentId). 적용을 누를 때 한 번 부른다.
 * 환경 변수와 이름이 같은 변수는 카탈로그에서 직접 고를 때처럼 환경변수로 미리 이어 둔다.
 */
export function stepsFromPlan(plan, envKeys = []) {
  const idByRef = new Map(flattenPlan(plan).map((node) => [node.ref, stepId()]));
  const fromEnv = new Set(envKeys);

  const build = (nodes, parentId) =>
    nodes.flatMap((node) => {
      const id = idByRef.get(node.ref);
      const base = { id, order: 0, name: node.name, ...(parentId ? { parentId } : {}) };
      const bindings = Object.fromEntries(
        Object.entries(node.bindings)
          .map(([variable, source]) => [variable, valueSource(source, idByRef)])
          .filter(([, source]) => source !== null)
      );

      switch (node.kind) {
        case 'REPEAT': {
          const repeat
            = node.repeat?.kind === 'COUNT'
              ? { kind: 'COUNT', count: Number(node.repeat.count) || 1 }
              : {
                  kind: 'LIST',
                  sourceStepId: idByRef.get(node.repeat?.sourceRef) ?? '',
                  itemsPath: node.repeat?.itemsPath || '$.data',
                  maxIterations: Number(node.repeat?.maxIterations) || 10
                };
          return [{ ...base, kind: 'REPEAT', repeat }, ...build(node.children, id)];
        }
        case 'BRANCH': {
          const source = valueSource(node.condition?.source, idByRef) ?? { kind: 'USER_INPUT', inputKey: '' };
          const operator = OPERATORS.has(node.condition?.operator) ? node.condition.operator : 'EQ';
          return [
            {
              ...base,
              kind: 'BRANCH',
              branchCondition: { source, operator, compareValue: node.condition?.compareValue ?? '' }
            },
            ...build(node.children, id)
          ];
        }
        // 초 수를 delay 안에 넣어 오기도 한다 — 어느 쪽이든 받는다 (놓치면 조용히 1초가 된다)
        case 'DELAY':
          return [{ ...base, delayBinding: { seconds: Number(node.seconds ?? node.delay?.seconds) || 1 } }];
        case 'WORKFLOW':
          return [{ ...base, workflowBinding: { ref: { id: node.linkedId }, inputMappings: bindings } }];
        default:
          return [
            {
              ...base,
              apiBinding: {
                catalogEntry: node.entry
                  ? catalogEntryOf(node.entry)
                  : { department: '', collectionFile: '', itemPath: [], name: '' },
                variableBindings: {
                  ...Object.fromEntries(
                    (node.entry?.variables ?? [])
                      .filter((variable) => fromEnv.has(variable))
                      .map((variable) => [variable, { kind: 'ENV', envKey: variable }])
                  ),
                  ...bindings
                }
              },
              ...(node.entry?.outputFields?.length
                ? { resultView: { mode: 'TABLE', columns: node.entry.outputFields.slice(0, 5) } }
                : {})
            }
          ];
      }
    });

  return build(plan, null);
}
