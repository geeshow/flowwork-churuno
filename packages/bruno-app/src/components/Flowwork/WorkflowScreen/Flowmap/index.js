import React, { useMemo } from 'react';

import { stepTypeMeta } from '../../StepCard';

const NODE_W = 190;
const NODE_H = 76;
// 노드 사이 간격은 그 사이에 얹히는 값 이름이 들어갈 만큼 벌린다
const COL_GAP = 150;
const PAD = 20;
const SOURCE_GAP = 28;
const LABEL_MAX = 22;

const shorten = (text) => (text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX - 1)}…` : text);

/** 같은 두 노드를 잇는 값들은 한 줄로 묶는다 — 변수마다 선을 그으면 그림이 읽히지 않는다 */
function collectEdges(steps) {
  const merged = new Map();
  const add = (from, to, label, kind) => {
    const key = `${kind}:${from}→${to}`;
    const edge = merged.get(key) ?? { from, to, kind, labels: [] };
    if (label) edge.labels.push(label);
    merged.set(key, edge);
  };

  for (const step of steps) {
    for (const [variable, source] of Object.entries(step.apiBinding?.variableBindings ?? {})) {
      if (source?.kind === 'USER_INPUT') add('inputs', step.id, `{{${variable}}}`, 'data');
      else if (source?.kind === 'ENV') add('env', step.id, `{{${variable}}}`, 'data');
      else if (source?.kind === 'PREV_RESPONSE' && source.stepId) {
        add(source.stepId, step.id, `${variable} ← ${source.jsonPath}`, 'data');
      }
    }
    if (step.branchCondition?.sourceStepId) {
      add(step.branchCondition.sourceStepId, step.id, `조건 ${step.branchCondition.jsonPath ?? ''}`, 'branch');
    }
  }
  return [...merged.values()];
}

/**
 * 워크플로우의 입력과 출력이 어디서 어디로 흐르는지 그래프로 보여준다.
 *
 * 스텝은 실행 순서대로 가로로 놓고(가는 화살표), 값이 오가는 관계는 아래로 흐르는
 * 곡선으로 잇는다 — 순서선과 데이터선이 같은 자리에서 겹치지 않게 하기 위해서다.
 */
export function Flowmap({ workflow, workflows }) {
  const steps = useMemo(() => [...workflow.steps].sort((a, b) => a.order - b.order), [workflow]);

  const { nodes, edges, width, height } = useMemo(() => {
    const dataEdges = collectEdges(steps);
    const used = new Set(dataEdges.map((e) => e.from));

    const nodeList = [];
    // 값의 출처(기본 입력값·환경변수)는 왼쪽 첫 칸에 세로로 쌓는다
    if (workflow.baseInputs.length > 0) {
      nodeList.push({
        id: 'inputs',
        kind: 'source',
        x: PAD,
        y: PAD,
        title: '기본 입력값',
        subtitle: workflow.baseInputs.map((i) => i.key).join(', ')
      });
    }
    if (used.has('env')) {
      nodeList.push({
        id: 'env',
        kind: 'source',
        x: PAD,
        y: PAD + (nodeList.length > 0 ? NODE_H + SOURCE_GAP : 0),
        title: '환경변수',
        subtitle: '실행 환경에서 주입'
      });
    }

    const firstColumn = nodeList.length > 0 ? 1 : 0;
    steps.forEach((step, i) => {
      const { typeLabel, category } = stepTypeMeta(step, (id) => workflows.find((w) => w.id === id));
      nodeList.push({
        id: step.id,
        kind: 'step',
        x: PAD + (firstColumn + i) * (NODE_W + COL_GAP),
        y: PAD,
        order: step.order,
        title: step.name || `스텝 ${step.order}`,
        subtitle: category,
        badge: typeLabel,
        branch: !!step.branchCondition
      });
    });

    const byId = new Map(nodeList.map((n) => [n.id, n]));
    // 곡선이 서로 겹치지 않도록 아래로 한 칸씩 내려 그린다
    const laid = dataEdges
      .filter((e) => byId.has(e.from) && byId.has(e.to))
      .map((edge, i) => ({ ...edge, depth: 34 + i * 20 }));

    const sequence = steps
      .slice(1)
      .map((step, i) => ({ from: steps[i].id, to: step.id, kind: 'seq', labels: [], depth: 0 }));

    const deepest = laid.reduce((max, e) => Math.max(max, e.depth), 0);
    const lowestNode = nodeList.reduce((max, n) => Math.max(max, n.y + NODE_H), 0);
    return {
      nodes: nodeList,
      edges: [...sequence, ...laid],
      width: nodeList.reduce((max, n) => Math.max(max, n.x + NODE_W), 0) + PAD,
      height: Math.max(lowestNode, PAD + NODE_H / 2 + deepest) + PAD + 16
    };
  }, [steps, workflow, workflows]);

  if (steps.length === 0) {
    return <p className="muted">스텝이 없습니다. 수정 화면에서 스텝을 추가하면 여기에 흐름이 그려집니다.</p>;
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const path = (edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    const x1 = from.x + NODE_W;
    const x2 = to.x;
    const y1 = from.y + NODE_H / 2;
    const y2 = to.y + NODE_H / 2;
    if (edge.kind === 'seq') return `M ${x1} ${y1} L ${x2} ${y2}`;
    if (from.kind === 'source') return `M ${x1} ${y1} C ${x1 + 40} ${y1} ${x2 - 40} ${y2} ${x2} ${y2}`;
    const dip = y1 + edge.depth;
    return `M ${x1} ${y1} C ${x1 + 40} ${dip} ${x2 - 40} ${dip} ${x2} ${y2}`;
  };
  const labelAt = (edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    const y = from.kind === 'source'
      ? (from.y + to.y) / 2 + NODE_H / 2
      : from.y + NODE_H / 2 + edge.depth * 0.75;
    return { x: (from.x + NODE_W + to.x) / 2, y };
  };

  return (
    <div className="flowmap">
      <svg width={width} height={height} role="img" aria-label={`${workflow.name} 흐름도`}>
        <defs>
          <marker id="flowmap-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L7,3 L0,6 Z" className="flowmap-arrowhead" />
          </marker>
        </defs>

        {edges.map((edge) => (
          <g key={`${edge.kind}-${edge.from}-${edge.to}`} className={`flowmap-edge ${edge.kind}`}>
            <path d={path(edge)} markerEnd="url(#flowmap-arrow)" />
            {edge.labels.length > 0 ? (
              <text {...labelAt(edge)} textAnchor="middle">
                {shorten(edge.labels.join(', '))}
                <title>{edge.labels.join(', ')}</title>
              </text>
            ) : null}
          </g>
        ))}

        {nodes.map((node) => (
          <foreignObject key={node.id} x={node.x} y={node.y} width={NODE_W} height={NODE_H}>
            <div className={`flowmap-node ${node.kind}`}>
              <div className="flowmap-node-head">
                {node.order ? <span className="flowmap-order">{node.order}</span> : null}
                <span className="flowmap-node-title">{node.title}</span>
                {node.branch ? <span className="flowmap-chip">분기</span> : null}
              </div>
              {node.badge ? <span className={`step-type-badge ${node.badge === 'API' ? 'api' : 'wf'}`}>{node.badge}</span> : null}
              {node.subtitle ? <span className="flowmap-node-sub">{node.subtitle}</span> : null}
            </div>
          </foreignObject>
        ))}
      </svg>
    </div>
  );
}

export default Flowmap;
