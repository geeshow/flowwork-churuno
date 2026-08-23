import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import api from '../../api';
import { conditionSource } from '../../engine/branch';
import { buildStepTree, isBlockStep } from '../../engine/runWorkflow';
import { refKey } from '../../engine/catalogLookup';
import { conditionKey, conditionLabel, leafOf, repeatLabel, stepBadgeClass, stepTypeMeta } from '../../StepCard';
import { workflowPopupUrl } from '../../shareUrl';
import useOpenBrunoRequest from '../../useOpenBrunoRequest';

const NODE_W = 190;
const NODE_H = 76;
// 노드 사이 간격은 그 사이에 얹히는 값 이름이 들어갈 만큼 벌린다
const COL_GAP = 150;
// 줄 사이 — 데이터 곡선과 줄바꿈 화살표가 지나갈 자리
const ROW_GAP = 96;
// 그림 가장자리 여백 — 노드 바깥으로 나가는 것들(감싸는 테두리, 줄바꿈 꺾임)이
// 모두 이 안에 들어와야 잘리지 않는다: FRAME_PAD + FRAME_GAP + WRAP_TURN 보다 넉넉히.
const PAD = 40;
// 줄바꿈 화살표가 노드 밖으로 나가 꺾이는 거리
const WRAP_TURN = 14;
const SOURCE_GAP = 28;
// 환경변수는 어느 스텝이든 쓰는 값이라 선으로 이으면 그림을 세로로 가로지른다 —
// 좁은 화면에서는 왼쪽 끝을 타고 내리는 정체 모를 점선이 된다. 그래서 맨 위에 폭
// 전체로 깔아 두기만 하고, 쓰는 스텝 바로 위에 짧은 화살표만 꽂는다.
const ENV_H = 42;
const ENV_GAP = 22;
const ENV_STUB = 16;
const ENV_LABEL_H = 18;
const LABEL_MAX = 30;
// 스텝을 감싸는 테두리(반복·분기) — 노드 둘레 여백, 이름표 높이, 겹칠 때의 간격
const FRAME_PAD = 10;
const FRAME_TOP = 26;
const FRAME_GAP = 8;

// 테두리 n겹이 노드 위로 차지하는 높이 (그 줄을 그만큼 내려 앉힌다)
const frameHeadroom = (levels) =>
  levels === 0 ? 0 : FRAME_PAD + (levels - 1) * FRAME_GAP + FRAME_TOP * levels;

// level 0이 가장 안쪽 — 바깥으로 갈수록 여백과 이름표 자리가 한 겹씩 붙는다
function frameRect(from, to, level) {
  const pad = FRAME_PAD + level * FRAME_GAP;
  const top = from.y - pad - FRAME_TOP * (level + 1) + 6;
  return {
    x: from.x - pad,
    y: top,
    width: to.x + NODE_W + pad - (from.x - pad),
    height: from.y + NODE_H + pad - top
  };
}

/**
 * 감싸는 테두리 목록. 반복은 스텝 하나를, 분기는 같은 조건이 이어지는 스텝들을 묶는다.
 * 한 스텝이 둘 다 가지면(반복 안의 분기) 반복이 바깥, 조건이 안쪽이다.
 */
function buildFrames(steps, byId, label) {
  const frames = [];

  // 1) 반복·분기 블록 — 안에 든 스텝들을 통째로 감싼다 (겹치면 바깥 블록이 한 겹 위)
  const blocks = steps.filter(isBlockStep);
  const depths = new Map(steps.map((step) => [step.id, depthOf(steps, step)]));
  for (const block of blocks) {
    const members = descendantsOf(steps, block.id).filter((id) => byId.has(id));
    if (members.length === 0) continue;
    const boxes = members.map((id) => byId.get(id));
    const blockLabel = block.kind === 'REPEAT' ? label.repeat(block) : label.condition(block);
    // 안에 든 스텝이 다음 줄로 넘어가면 테두리도 줄마다 한 도막씩 그린다 —
    // 이름표는 첫 도막만 달고, 이어지는 도막은 이어진다고 밝힌다
    const rows = [...new Set(boxes.map((n) => n.row))].sort((a, b) => a - b);
    for (const row of rows) {
      const rowBoxes = boxes.filter((n) => n.row === row);
      const first = rowBoxes.reduce((min, n) => (n.x < min.x ? n : min), rowBoxes[0]);
      const last = rowBoxes.reduce((max, n) => (n.x > max.x ? n : max), rowBoxes[0]);
      // 겹은 스텝 쪽에서 센다 — 스텝을 감싼 겹 가운데 이 블록 안쪽에 몇 겹이 더 있는지.
      // 블록의 깊이를 그대로 쓰면 안쪽 블록이 바깥 블록보다 크게 그려진다.
      const level = Math.max(...rowBoxes.map((n) => depths.get(n.id))) - 1 - depths.get(block.id);
      frames.push({
        key: `${block.kind}-${block.id}-${row}`,
        groupKey: `${block.kind}-${block.id}`,
        kind: block.kind === 'REPEAT' ? 'repeat' : 'branch',
        label: row === rows[0] ? blockLabel : `이어짐 — ${blockLabel}`,
        level,
        members: rowBoxes.map((n) => n.id),
        ...frameRect(first, last, level)
      });
    }
  }

  // 2) 블록이 생기기 전 형식 — 스텝에 직접 붙은 반복·조건도 그대로 감싸 보여준다
  let group = null;
  const flush = () => {
    if (group) {
      frames.push({
        key: `branch-${group.first.id}`,
        groupKey: `branch-${group.first.id}`,
        kind: 'branch',
        label: group.label,
        level: 0,
        members: group.members,
        ...frameRect(group.first, group.last, 0)
      });
    }
    group = null;
  };

  for (const step of steps) {
    const node = byId.get(step.id);
    if (!node || isBlockStep(step) || step.parentId) continue;

    if (step.repeat) {
      flush();
      if (step.branchCondition) {
        frames.push({
          key: `branch-${step.id}`,
          groupKey: `branch-${step.id}`,
          kind: 'branch',
          label: label.condition(step),
          level: 0,
          members: [step.id],
          ...frameRect(node, node, 0)
        });
      }
      const level = step.branchCondition ? 1 : 0;
      frames.push({
        key: `repeat-${step.id}`,
        groupKey: `repeat-${step.id}`,
        kind: 'repeat',
        label: label.repeat(step),
        level,
        members: [step.id],
        ...frameRect(node, node, level)
      });
      continue;
    }

    const key = conditionKey(step.branchCondition);
    if (!key) {
      flush();
      continue;
    }
    // 같은 조건이 같은 줄에서 이어질 때만 한 테두리로 묶는다
    if (group?.key === key && group.last.row === node.row) {
      group.last = node;
      group.members.push(step.id);
    } else {
      flush();
      group = { key, label: label.condition(step), first: node, last: node, members: [step.id] };
    }
  }
  flush();
  return frames;
}

// 블록 안에 든 (블록이 아닌) 스텝들의 id — 손자까지 내려간다
function descendantsOf(steps, blockId) {
  const ids = [];
  for (const step of steps) {
    if (step.parentId !== blockId) continue;
    if (isBlockStep(step)) ids.push(...descendantsOf(steps, step.id));
    else ids.push(step.id);
  }
  return ids;
}

const depthOf = (steps, step) => {
  let depth = 0;
  let parentId = step.parentId;
  while (parentId) {
    depth += 1;
    parentId = steps.find((s) => s.id === parentId)?.parentId;
  }
  return depth;
};

/**
 * 선이 닿을 자리. 감싸인 스텝은 노드가 아니라 그 테두리(가장 바깥)에 선을 붙인다 —
 * 반복·조건 묶음은 하나의 덩어리로 드나들기 때문이다.
 */
function boundsByNode(frames) {
  const bounds = new Map();
  for (const frame of frames) {
    for (const id of frame.members) {
      const current = bounds.get(id);
      if (!current || frame.level > current.level) bounds.set(id, frame);
    }
  }
  return bounds;
}
// 데이터선이 노드 아래로 파고드는 깊이 — 같은 줄에서 겹치지 않게 세 단계로 돌려 쓴다
const DIP_BASE = 26;
const DIP_STEP = 20;
// 폭을 재기 전(첫 렌더)에 쓸 한 줄 칸 수
const FALLBACK_COLUMNS = 4;

const shorten = (text) => (text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX - 1)}…` : text);

// SVG는 글자 폭을 미리 재 주지 않는다. 그림 크기를 정할 때 이름표가 잘리지 않을 만큼은
// 잡아야 하므로, 한글은 글자마다 거의 정사각이고 로마자는 그 절반쯤이라고 어림잡는다.
const textWidth = (text, size) =>
  [...text].reduce((sum, char) => sum + (char.charCodeAt(0) > 0x2e80 ? size : size * 0.55), 0);

// 선 끝의 화살표 — 종류마다 색·모양이 달라 마커도 따로 쓴다 (마커는 선 색을 물려받지 않는다)
const ARROW_MARKER = { seq: 'flowmap-arrow-seq', async: 'flowmap-arrow-async' };

/**
 * 값 이름을 사람이 읽는 말로 바꾼다. 기본 입력값은 그 입력의 라벨, 이전 단계 응답은
 * 그 API가 docs의 `output: 이름=라벨`로 밝혀 둔 한글 이름을 쓴다. 찾지 못하면 원래
 * 변수 이름을 그대로 둔다 — 지어내지 않는다.
 */
function makeValueNamer(workflow, catalog) {
  const inputLabels = new Map(workflow.baseInputs.map((input) => [input.key, input.label]));
  // 중간 입력은 어느 스텝이 물어보든 실행 중에는 기본 입력값과 같은 값 주머니에 들어간다
  const midInputLabels = new Map(
    workflow.steps.flatMap((step) => (step.midInputs ?? []).map((input) => [input.key, input.label]))
  );
  const outputLabelsByStep = new Map(
    workflow.steps
      .filter((step) => step.apiBinding?.catalogEntry)
      .map((step) => [
        step.id,
        catalog.find((entry) => refKey(entry) === refKey(step.apiBinding.catalogEntry))?.outputLabels ?? {}
      ])
  );

  return {
    input: (key) => inputLabels.get(key) || midInputLabels.get(key) || key,
    isMidInput: (key) => midInputLabels.has(key),
    output: (stepId, jsonPath) => {
      const field = leafOf(jsonPath);
      return outputLabelsByStep.get(stepId)?.[field] || field || jsonPath;
    }
  };
}

// 스텝이 받는 값 — API 스텝은 요청 변수, 연결업무 스텝은 넘겨주는 입력이다.
// 둘 다 같은 ValueSource라 흐름도에서는 구분하지 않는다.
const inputsOf = (step) => ({
  ...(step.apiBinding?.variableBindings ?? {}),
  ...(step.workflowBinding?.inputMappings ?? {})
});

// 블록은 그림에서 칸을 차지하지 않으므로, 블록으로 드나드는 선은 그 안의 첫 스텝에 붙인다
const firstMemberOf = (steps) => {
  const resolve = (id) => {
    const step = steps.find((s) => s.id === id);
    if (!step || !isBlockStep(step)) return id;
    const child = steps.find((s) => s.parentId === id);
    return child ? resolve(child.id) : null;
  };
  return resolve;
};

/** 같은 두 노드를 잇는 값들은 한 줄로 묶는다 — 변수마다 선을 그으면 그림이 읽히지 않는다 */
function collectEdges(steps, name, nodeOf) {
  const merged = new Map();
  // label은 화면에 보이는 한글 이름, detail은 마우스를 올렸을 때 보이는 실제 변수/경로
  const add = (from, to, label, detail, kind) => {
    const key = `${kind}:${from}→${to}`;
    const edge = merged.get(key) ?? { from, to, kind, labels: [], details: [] };
    if (label) {
      edge.labels.push(label);
      edge.details.push(detail);
    }
    merged.set(key, edge);
  };

  for (const step of steps) {
    const to = nodeOf(step.id);
    if (!to) continue;
    for (const [variable, source] of Object.entries(inputsOf(step))) {
      if (source?.kind === 'USER_INPUT') {
        // 실행 도중 받는 값은 처음 입력값과 다른 자리에서 온다
        const from = name.isMidInput(source.inputKey) ? 'midinputs' : 'inputs';
        add(from, to, name.input(source.inputKey), `{{${variable}}} ← ${source.inputKey}`, 'data');
      } else if (source?.kind === 'ENV') {
        add('env', to, source.envKey || variable, `{{${variable}}} ← ${source.envKey}`, 'data');
      } else if (source?.kind === 'PREV_RESPONSE' && source.stepId) {
        add(
          source.stepId,
          to,
          name.output(source.stepId, source.jsonPath),
          `{{${variable}}} ← ${source.jsonPath}`,
          'data'
        );
      }
    }
    // 반복할 목록도 값의 흐름이다 — 어느 스텝의 응답을 돌리는지 화살표로 잇는다.
    // 무엇을 기준으로 도는지는 그 스텝을 감싼 테두리가 말하므로 선에는 글자를 얹지 않는다.
    if (step.repeat?.kind === 'LIST' && step.repeat.sourceStepId) {
      add(step.repeat.sourceStepId, to, '', '', 'data');
    }
    // 조건이 보는 값이 어디서 오는지도 화살표로 잇는다 — 조건 문장은 테두리가 말한다
    if (step.branchCondition) {
      const from = branchOrigin(conditionSource(step.branchCondition));
      if (from) add(from, to, '', '', 'branch');
    }
  }
  return [...merged.values()];
}

/**
 * 순서선 — 블록 구조를 따라 잇는다. 블록 자체는 칸을 차지하지 않으므로 선은 블록 안의
 * 스텝에서 시작하고 끝난다. 분기 블록은 통째로 건너뛸 수 있어서, 그 앞 스텝이 다음
 * 스텝의 출발점으로도 남는다 — 나란히 선 분기끼리 한 줄로 이어지지 않게 하기 위해서다.
 * 비동기 요청 스텝은 묶음을 여는 스텝만 사슬에 낀다 (나머지는 async 선이 잇는다).
 */
function sequenceEdges(steps) {
  const edges = new Map();

  const walk = (nodes, incoming) => {
    let sources = incoming;
    for (const { step, children } of nodes) {
      if (step.parallel) continue;
      if (isBlockStep(step)) {
        const exits = walk(children, sources);
        sources = step.kind === 'BRANCH' ? [...new Set([...sources, ...exits])] : exits;
        continue;
      }
      for (const from of sources) {
        edges.set(`${from}→${step.id}`, { from, to: step.id, kind: 'seq', labels: [], details: [], depth: 0 });
      }
      sources = [step.id];
    }
    return sources;
  };

  walk(buildStepTree(steps), []);
  return [...edges.values()];
}

/** 분기 조건이 보는 값의 출처 노드 — 그릴 수 없는 소스(반복 항목)는 선을 긋지 않는다 */
function branchOrigin(source) {
  switch (source.kind) {
    case 'PREV_RESPONSE':
      return source.stepId;
    case 'USER_INPUT':
      return 'inputs';
    case 'ENV':
      return 'env';
    default:
      return null;
  }
}

// 이 워크플로우가 끝내 내놓는 값 — 결과 표를 가진 마지막 스텝의 필드들
function resultOf(steps, name) {
  const last = [...steps].reverse().find((step) => step.resultView?.columns?.length);
  if (!last) return null;
  return {
    stepId: last.id,
    fields: last.resultView.columns.map((column) => name.output(last.id, column))
  };
}

/**
 * 워크플로우의 입력과 출력이 어디서 어디로 흐르는지 그래프로 보여준다.
 *
 * 스텝은 실행 순서대로 가로로 놓고(가는 화살표), 화면 폭을 넘기면 글줄처럼 다음 줄로
 * 넘긴다. 값이 오가는 관계는 아래로 흐르는 곡선으로 잇는다 — 순서선과 데이터선이
 * 같은 자리에서 겹치지 않게 하기 위해서다.
 *
 * 그림 안의 링크는 모두 새 창으로 연다. 이 화면을 갈아 치우면 짜던 것(아직 저장하지
 * 않은 초안, 적어 둔 입력값)이 사라지기 때문이다.
 */
export function Flowmap({ workflow, workflows }) {
  const steps = useMemo(() => [...workflow.steps].sort((a, b) => a.order - b.order), [workflow]);
  const openBrunoRequest = useOpenBrunoRequest();
  const [catalog, setCatalog] = useState([]);
  // 한 줄에 몇 칸이 들어가는지는 그려지는 폭에 달렸다
  const [viewWidth, setViewWidth] = useState(0);
  const scrollerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    api
      .searchCatalog('')
      .then((found) => alive && setCatalog(found.results))
      .catch(() => alive && setCatalog([]));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setViewWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { nodes, frames, bounds, edges, width, height } = useMemo(() => {
    const namer = makeValueNamer(workflow, catalog);
    // 블록(반복·분기)은 칸을 차지하지 않는다 — 안에 든 스텝을 감싸는 테두리로만 그린다
    const drawn = steps.filter((step) => !isBlockStep(step));
    const dataEdges = collectEdges(steps, namer, firstMemberOf(steps));
    const used = new Set(dataEdges.map((e) => e.from));

    const result = resultOf(steps, namer);

    // 기본 입력값 가운데 다른 API를 조회해 채우는 것들 — 사람이 직접 적는 값과 달리
    // 그 값에도 출처가 있다. 채워 주는 것도 결국 API 호출이므로 스텝과 같은 모양으로
    // 세워, 어느 요청이 도는지 그림에서 바로 짚어 볼 수 있게 한다.
    const lookups = new Map();
    for (const input of workflow.baseInputs) {
      const apiId = input.lookupApiId || input.sourceApiId;
      if (!apiId) continue;
      const row = lookups.get(apiId) ?? { entry: catalog.find((e) => e.id === apiId), fills: [] };
      row.fills.push({ label: input.label || input.key, dependsOnKey: input.dependsOnKey });
      lookups.set(apiId, row);
    }

    const sources = [];
    // 값의 출처(입력 조회·기본 입력값·중간 입력)는 왼쪽 첫 칸에 세로로 쌓는다
    for (const [apiId, { entry }] of lookups) {
      sources.push({
        id: `lookup:${apiId}`,
        kind: 'lookup',
        title: entry?.name ?? '(카탈로그에 없는 API)',
        subtitle: entry ? [entry.department, ...entry.itemPath].join(' > ') : '',
        badge: 'API',
        chips: ['입력 조회'],
        apiEntry: entry
      });
    }
    if (workflow.baseInputs.length > 0) {
      sources.push({
        id: 'inputs',
        kind: 'source',
        title: '기본 입력값',
        subtitle: workflow.baseInputs.map((i) => i.label || i.key).join(', ')
      });
    }
    // 환경변수는 세로 칸에 끼지 않는다 — 맨 위 띠로 따로 올린다
    const envVars = used.has('env')
      ? [...new Set(dataEdges.filter((e) => e.from === 'env').flatMap((e) => e.labels))]
      : [];
    if (used.has('midinputs')) {
      const asked = steps.flatMap((step) => step.midInputs ?? []);
      sources.push({
        id: 'midinputs',
        kind: 'source',
        title: '중간 입력',
        subtitle: asked.map((input) => input.label || input.key).join(', ')
      });
    }

    const fitColumns = viewWidth
      ? Math.floor((viewWidth - 2 * PAD + COL_GAP) / (NODE_W + COL_GAP))
      : FALLBACK_COLUMNS;
    // 출처 칸이 첫 줄 한 칸을 차지하므로, 그 옆에 스텝이 하나는 서야 한다
    const columns = Math.max(sources.length > 0 ? 2 : 1, fitColumns);

    const sourceHeight = sources.length * NODE_H + Math.max(0, sources.length - 1) * SOURCE_GAP;
    const firstCell = sources.length > 0 ? 1 : 0;
    const rowOf = (cell) => Math.floor(cell / columns);

    // 감싸는 테두리(블록, 그리고 옛 형식의 스텝 자체 반복·조건)가 앉을 자리만큼
    // 그 줄의 위쪽을 비워 둔다. 겹쳐 감싸이면 그만큼 겹이 늘어난다.
    const framesOf = (step) =>
      depthOf(steps, step) + (step.repeat ? 1 : 0) + (step.branchCondition ? 1 : 0);
    const rowFrames = new Map();
    // 환경변수 화살표는 테두리보다 더 위에서 내려오므로 그 줄에 한 칸을 더 비워 둔다 —
    // 자리를 잡아 두지 않으면 이름이 테두리 이름표와 겹쳐 둘 다 읽히지 않는다
    const envTargets = new Set(dataEdges.filter((e) => e.from === 'env').map((e) => e.to));
    const envRows = new Set();
    drawn.forEach((step, i) => {
      const row = rowOf(firstCell + i);
      rowFrames.set(row, Math.max(rowFrames.get(row) ?? 0, framesOf(step)));
      if (envTargets.has(step.id)) envRows.add(row);
    });

    // 환경변수 띠가 있으면 그만큼 아래에서 시작한다
    const topPad = PAD + (envVars.length > 0 ? ENV_H + ENV_GAP : 0);

    const rowTops = [];
    let rowY = topPad;
    for (let row = 0; row <= rowOf(firstCell + Math.max(0, drawn.length)); row += 1) {
      rowY += frameHeadroom(rowFrames.get(row) ?? 0) + (envRows.has(row) ? ENV_STUB + ENV_LABEL_H : 0);
      rowTops.push(rowY);
      rowY += (row === 0 ? Math.max(NODE_H, sourceHeight) : NODE_H) + ROW_GAP;
    }

    const nodeList = sources.map((source, i) => ({
      ...source,
      x: PAD,
      y: topPad + i * (NODE_H + SOURCE_GAP)
    }));

    const place = (cell) => ({
      row: rowOf(cell),
      x: PAD + (cell % columns) * (NODE_W + COL_GAP),
      y: rowTops[rowOf(cell)]
    });

    drawn.forEach((step, i) => {
      const { typeLabel, category } = stepTypeMeta(step, (id) => workflows.find((w) => w.id === id));
      nodeList.push({
        id: step.id,
        kind: 'step',
        ...place(firstCell + i),
        order: step.order,
        title: step.name || `스텝 ${step.order}`,
        subtitle: category,
        badge: typeLabel,
        // 반복·분기는 칩이 아니라 노드를 감싸는 테두리로 보여준다 (무엇을 기준으로 도는지·언제 도는지)
        chips: step.parallel ? ['비동기'] : [],
        apiEntry: step.apiBinding?.catalogEntry,
        linkedWorkflowId: step.workflowBinding?.ref?.id
      });
    });

    // 마지막 결과는 흐름의 끝 칸에 둔다 — 이 업무가 무엇을 내놓는지가 그림에서 끝난다
    if (result) {
      nodeList.push({
        id: 'result',
        kind: 'result',
        ...place(firstCell + drawn.length),
        title: '결과',
        subtitle: result.fields.join(', ')
      });
      dataEdges.push({ from: result.stepId, to: 'result', kind: 'data', labels: [], details: [] });
    }

    // 조회로 채워지는 입력값 — API 하나가 채우는 값들은 한 선에 모아 얹는다
    // (같은 두 칸 사이를 몇 겹으로 긋지 않게)
    for (const [apiId, { fills }] of lookups) {
      dataEdges.push({
        from: `lookup:${apiId}`,
        to: 'inputs',
        kind: 'data',
        labels: fills.map((f) => f.label),
        details: fills.map((f) => `${f.label}${f.dependsOnKey ? ` ← ${f.dependsOnKey}로 조회` : ''}`)
      });
    }

    // 환경변수 띠 — 다른 노드를 다 앉힌 뒤 그 폭에 맞춰 맨 위에 깐다
    if (envVars.length > 0) {
      const right = nodeList.reduce((max, n) => Math.max(max, n.x + NODE_W), PAD + NODE_W);
      nodeList.push({
        id: 'env',
        kind: 'envbar',
        x: PAD,
        y: PAD,
        width: right - PAD,
        height: ENV_H,
        title: '환경변수',
        subtitle: `${envVars.join(', ')} — 실행 환경에서 주입`
      });
    }

    const byId = new Map(nodeList.map((n) => [n.id, n]));
    // 곡선이 서로 겹치지 않도록 줄마다 아래로 한 칸씩 내려 그린다
    const perRowDips = new Map();
    const laid = dataEdges
      .filter((e) => byId.has(e.from) && byId.has(e.to))
      .map((edge) => {
        const row = byId.get(edge.from).row ?? 0;
        const index = perRowDips.get(row) ?? 0;
        perRowDips.set(row, index + 1);
        return { ...edge, depth: DIP_BASE + (index % 3) * DIP_STEP };
      });

    // 비동기 요청 스텝은 앞 스텝을 기다리지도, 뒤 스텝이 기다려 주지도 않는 독립된 호출이다.
    // 순서선은 묶음을 여는 스텝끼리만 이어 실제로 이어지는 관계만 남기고,
    // 누가 함께 출발시키는지는 따로 구분되는 선(async)으로 잇는다.
    const sequence = sequenceEdges(steps);

    const asyncStarts = [];
    let leaderId = null;
    for (const step of drawn) {
      if (!step.parallel) leaderId = step.id;
      else if (leaderId) {
        asyncStarts.push({
          from: leaderId,
          to: step.id,
          kind: 'async',
          labels: ['비동기 요청'],
          details: ['앞 스텝과 함께 출발 — 응답을 기다리지 않는다'],
          depth: 0
        });
      }
    }

    const frames = buildFrames(steps, byId, {
      repeat: (step) => repeatLabel(step.repeat, (id) => steps.find((s) => s.id === id)?.name),
      condition: (step) =>
        conditionLabel(step.branchCondition, {
          stepName: (id) => steps.find((s) => s.id === id)?.name,
          inputLabel: namer.input,
          fieldLabel: namer.output
        })
    });

    // 테두리는 노드보다 밖으로 나가고, 줄이지 않는 테두리 이름표는 테두리보다 더 나간다 —
    // 그림 크기를 이름표까지 재야 긴 조건문이 오른쪽에서 잘리지 않는다
    const rightMost = Math.max(
      nodeList.reduce((max, n) => Math.max(max, n.x + (n.width ?? NODE_W)), 0),
      frames.reduce((max, f) => Math.max(max, f.x + Math.max(f.width, 8 + textWidth(f.label, 10))), 0)
    );
    const lowest = Math.max(
      nodeList.reduce((max, n) => Math.max(max, n.y + NODE_H), 0),
      frames.reduce((max, f) => Math.max(max, f.y + f.height), 0)
    );
    return {
      nodes: nodeList,
      frames,
      bounds: boundsByNode(frames),
      edges: [...sequence, ...asyncStarts, ...laid],
      width: rightMost + PAD,
      height: lowest + PAD + 40
    };
  }, [steps, workflow, workflows, catalog, viewWidth]);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const sameRow = (from, to) => (from.row ?? 0) === (to.row ?? 0);
  // 왼쪽 첫 칸에 세로로 쌓인 것들 — 스텝 줄과 달리 서로 다른 높이에서 오른쪽으로 흘러 나간다
  const inSourceColumn = (node) => node.kind === 'source' || node.kind === 'lookup';

  /**
   * 선이 닿는 자리 — 감싸인 스텝은 테두리 바깥면에 붙인다. 같은 테두리 안끼리 잇는
   * 선은 그 안에서 노드끼리 잇는다. 세로 위치는 노드 중심에 맞춰 선이 눕지 않게 한다.
   */
  const anchors = (from, to) => {
    const fromFrame = bounds.get(from.id);
    const toFrame = bounds.get(to.id);
    const inSameFrame = fromFrame && fromFrame.groupKey === toFrame?.groupKey;
    const box = (node, frame) =>
      frame && !inSameFrame
        ? { left: frame.x, right: frame.x + frame.width, bottom: frame.y + frame.height }
        : { left: node.x, right: node.x + NODE_W, bottom: node.y + NODE_H };
    return { from: box(from, fromFrame), to: box(to, toFrame) };
  };
  // 줄과 줄 사이 빈 띠 — 줄바꿈 화살표와 줄을 건너뛰는 데이터선이 여기로 지난다
  const bandY = (node) => node.y + NODE_H + ROW_GAP / 2;
  // 한 줄 안에서는 깊이로, 줄을 건너뛸 때는 좌우 어긋남으로 선을 벌린다
  const fanOf = (edge) => edge.depth - DIP_BASE;

  // 감싸는 테두리가 있으면 그 위가 스텝의 지붕이다 — 환경변수 화살표는 거기에 꽂는다
  const roofOf = (node) => bounds.get(node.id)?.y ?? node.y;

  const path = (edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);

    // 환경변수는 띠에서 스텝까지 선을 잇지 않는다 — 그 선이 그림을 세로로 가로지르기
    // 때문이다. 쓰는 스텝 바로 위에 짧은 화살표만 꽂고, 무엇이 들어오는지는 글로 적는다
    if (from.kind === 'envbar') {
      const roof = roofOf(to);
      const cx = to.x + NODE_W / 2;
      return `M ${cx} ${roof - ENV_STUB} V ${roof}`;
    }

    const box = anchors(from, to);
    const x1 = box.from.right;
    const x2 = box.to.left;
    const y1 = from.y + NODE_H / 2;
    const y2 = to.y + NODE_H / 2;

    if (!sameRow(from, to)) {
      // 다음 줄로 넘어가는 순서선·비동기 요청선은 글줄처럼 오른쪽 끝에서 내려와 왼쪽 처음으로
      // 돌아간다. 모서리를 둥글려 그어야 구분선이 아니라 이어지는 흐름으로 읽힌다.
      if (edge.kind === 'seq' || edge.kind === 'async') {
        const band = bandY(from);
        // 꺾이는 자리는 PAD 안에 둔다 — 그 밖으로 나가면 그림 밖이라 잘린다
        const right = x1 + WRAP_TURN;
        const left = x2 - WRAP_TURN;
        const r = 8;
        return [
          `M ${x1} ${y1}`,
          `H ${right - r} Q ${right} ${y1} ${right} ${y1 + r}`,
          `V ${band - r} Q ${right} ${band} ${right - r} ${band}`,
          `H ${left + r} Q ${left} ${band} ${left} ${band + r}`,
          `V ${y2 - r} Q ${left} ${y2} ${left + r} ${y2}`,
          `H ${x2}`
        ].join(' ');
      }
      // 같은 노드에서 줄을 건너뛰는 선이 여럿이면 시작점을 어긋나게 해 겹치지 않게 한다
      const belowFrom = box.from.bottom;
      const start = from.x + NODE_W / 2 + fanOf(edge);
      return `M ${start} ${belowFrom} C ${start} ${belowFrom + 50 + fanOf(edge)} ${x2 - 60} ${y2} ${x2} ${y2}`;
    }

    if (edge.kind === 'seq' || edge.kind === 'async') return `M ${x1} ${y1} L ${x2} ${y2}`;
    if (inSourceColumn(from)) return `M ${x1} ${y1} C ${x1 + 40} ${y1} ${x2 - 40} ${y2} ${x2} ${y2}`;
    const dip = y1 + edge.depth;
    return `M ${x1} ${y1} C ${x1 + 40} ${dip} ${x2 - 40} ${dip} ${x2} ${y2}`;
  };

  const labelAt = (edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    // 어느 스텝이 무슨 환경변수를 쓰는지는 그 스텝 지붕 위, 화살표 바로 머리에 적는다
    if (from.kind === 'envbar') return { x: to.x + NODE_W / 2, y: roofOf(to) - ENV_STUB - 5 };
    const box = anchors(from, to);
    const middle = (box.from.right + box.to.left) / 2;
    if (edge.kind === 'async') {
      // 비동기 요청선은 노드 사이를 곧게 지나므로 글자를 그 선 위에 얹는다
      return sameRow(from, to)
        ? { x: middle, y: from.y + NODE_H / 2 - 7 }
        : { x: middle, y: bandY(from) - 7 };
    }
    if (!sameRow(from, to)) {
      return { x: from.x + NODE_W / 2 + fanOf(edge), y: box.from.bottom + 16 + fanOf(edge) };
    }
    const y = inSourceColumn(from)
      ? (from.y + to.y) / 2 + NODE_H / 2
      : from.y + NODE_H / 2 + edge.depth * 0.75;
    return { x: middle, y };
  };

  // API 스텝은 Bruno의 그 요청으로, 연결업무 스텝은 그 업무 화면으로 건너갈 수 있다
  const nodeLink = (node) => {
    if (node.apiEntry) {
      return (
        <button
          className="flowmap-node-title link"
          title={`Bruno에서 '${node.apiEntry.name}' 요청 새 창으로 열기`}
          onClick={() =>
            openBrunoRequest(node.apiEntry, { popup: true }).then((opened) => {
              if (!opened) toast.error(`워크스페이스에서 '${node.apiEntry.name}' 요청을 찾지 못했습니다`);
            })}
        >
          {node.title}
        </button>
      );
    }
    if (node.linkedWorkflowId && workflows.some((w) => w.id === node.linkedWorkflowId)) {
      return (
        <button
          className="flowmap-node-title link"
          title="연결된 업무 새 창으로 열기"
          onClick={() => window.open(workflowPopupUrl(node.linkedWorkflowId), '_blank')}
        >
          {node.title}
        </button>
      );
    }
    return <span className="flowmap-node-title">{node.title}</span>;
  };

  if (steps.length === 0) {
    return <p className="muted">스텝이 없습니다. 수정 화면에서 스텝을 추가하면 여기에 흐름이 그려집니다.</p>;
  }

  return (
    <div className="flowmap" ref={scrollerRef}>
      <svg width={width} height={height} role="img" aria-label={`${workflow.name} 흐름도`}>
        <defs>
          <marker id="flowmap-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L7,3 L0,6 Z" className="flowmap-arrowhead" />
          </marker>
          {/* 실행 순서선은 선도 화살표도 진하게 — 마커는 선 색을 물려받지 않아 따로 둔다 */}
          <marker id="flowmap-arrow-seq" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L7,3 L0,6 Z" className="flowmap-arrowhead seq" />
          </marker>
          {/* 비동기 요청은 응답을 받지 않는 호출이라 속이 빈 화살표로 구분한다 */}
          <marker id="flowmap-arrow-async" markerWidth="9" markerHeight="9" refX="8" refY="3.5" orient="auto">
            <path d="M0.5,0.5 L7.5,3.5 L0.5,6.5 Z" className="flowmap-arrowhead async" />
          </marker>
        </defs>

        {/* 반복·분기는 무엇을 기준으로 도는지 적힌 테두리로 감싼다 — 선보다 먼저 깔린다 */}
        {frames.map((frame) => (
          <g key={frame.key} className={`flowmap-frame ${frame.kind}`}>
            <rect x={frame.x} y={frame.y} width={frame.width} height={frame.height} rx="10" />
            {/* 테두리 이름표는 줄이지 않는다 — 위쪽이 비어 있어 넘쳐도 가릴 것이 없다 */}
            <text x={frame.x + 8} y={frame.y + 15}>
              {frame.label}
            </text>
          </g>
        ))}

        {edges.map((edge) => (
          <g key={`${edge.kind}-${edge.from}-${edge.to}`} className={`flowmap-edge ${edge.kind}`}>
            <path d={path(edge)} markerEnd={`url(#${ARROW_MARKER[edge.kind] ?? 'flowmap-arrow'})`} />
            {edge.labels.length > 0 ? (
              <text {...labelAt(edge)} textAnchor="middle">
                {shorten(edge.labels.join(', '))}
                <title>{edge.details.join('\n')}</title>
              </text>
            ) : null}
          </g>
        ))}

        {nodes.map((node) => (
          <foreignObject key={node.id} x={node.x} y={node.y} width={node.width ?? NODE_W} height={node.height ?? NODE_H}>
            <div className={`flowmap-node ${node.kind}`}>
              <div className="flowmap-node-head">
                {node.order ? <span className="flowmap-order">{node.order}</span> : null}
                {nodeLink(node)}
                {(node.chips ?? []).map((chip) => (
                  <span key={chip} className="flowmap-chip">
                    {chip}
                  </span>
                ))}
              </div>
              {node.badge ? <span className={`step-type-badge ${stepBadgeClass(node.badge)}`}>{node.badge}</span> : null}
              {node.subtitle ? <span className="flowmap-node-sub" title={node.subtitle}>{node.subtitle}</span> : null}
            </div>
          </foreignObject>
        ))}
      </svg>
    </div>
  );
}

export default Flowmap;
