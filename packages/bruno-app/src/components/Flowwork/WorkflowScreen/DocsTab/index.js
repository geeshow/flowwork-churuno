import React, { useMemo, useState } from 'react';
import { IconPencil } from '@tabler/icons';
import DocsEditor from 'components/Documentation/DocsEditor';

import api from '../../api';
import { stepTypeMeta } from '../../StepCard';

const PLACEHOLDER = `
아직 작성된 문서가 없습니다. 이 작업이 무엇을 하는지 적어두면, 처음 보는 사람도 실행 전에 무슨 일이 일어나는지 알 수 있습니다.

## 이런 내용을 담아 주세요
- 이 작업을 언제 쓰는지, 어떤 결과를 만드는지
- 입력값이 각각 무엇을 뜻하는지
- 스텝 순서와 중간에 사람이 판단해야 하는 지점

더블클릭하면 바로 작성을 시작할 수 있습니다. 저장하면 다른 편집과 똑같이 즉시 기록됩니다.
`;

/**
 * 작업 문서 — Bruno의 Docs 탭(components/Documentation)과 같은 편집기를 그대로 쓴다.
 * 미리보기 → 더블클릭 → 서식 편집(WYSIWYG) / 마크다운 모드 전환까지 동작이 같고,
 * 저장 위치만 워크플로우 파일의 docs 필드다.
 *
 * 편집 중인지(isEditing)는 Bruno에서는 탭 상태(useDocsEditingState)에 들어 있지만,
 * flowwork는 자체 탭을 쓰므로 여기서 들고 있는다.
 */
export function DocsTab({ workflow, editable, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(workflow.docs ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // AI(생성·자동완성)에 이 작업이 무엇을 하는지 알려주는 문맥 —
  // 이름·위치·설명에 더해 실제 스텝 순서와 입력값까지 넘겨야 쓸만한 문장이 나온다
  const docsContext = useMemo(
    () => ({
      scope: 'workflow',
      name: workflow.name,
      location: `${workflow.domain} / ${workflow.task}`,
      description: workflow.description || '',
      inputs: workflow.baseInputs.map((input) => ({ key: input.key, label: input.label, type: input.type })),
      steps: [...workflow.steps]
        .sort((a, b) => a.order - b.order)
        .map((step) => {
          const { typeLabel, category } = stepTypeMeta(step);
          return {
            order: step.order,
            name: step.name,
            kind: typeLabel,
            api: category,
            branch: step.branchCondition ? '조건부 실행' : undefined,
            asksUser: step.midInputs?.length ? step.midInputs.map((i) => i.label || i.key) : undefined
          };
        })
    }),
    [workflow]
  );

  const autocomplete = useMemo(
    () => ({ scriptType: 'docs', getContext: () => ({ docsContext }) }),
    [docsContext]
  );

  const save = () => {
    setSaving(true);
    setError(null);
    api
      .saveWorkflow({ ...workflow, docs: draft })
      .then(() => {
        setEditing(false);
        onSaved();
      })
      .catch((e) => setError(e.message))
      .finally(() => setSaving(false));
  };

  return (
    <div className="wf-docs">
      {error ? <div className="error-banner">{error}</div> : null}
      {editable ? (
        <div className="wf-docs-bar">
          {editing ? (
            <>
              <span className="muted hint">Tab으로 AI 제안 수락 · ⌘\로 직접 요청</span>
              <button
                className="small"
                onClick={() => {
                  setDraft(workflow.docs ?? '');
                  setEditing(false);
                }}
              >
                취소
              </button>
              <button className="primary small" onClick={save} disabled={saving}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </>
          ) : (
            <button className="small" onClick={() => setEditing(true)}>
              <IconPencil size={14} strokeWidth={1.5} />
              편집
            </button>
          )}
        </div>
      ) : null}

      <div className={`wf-docs-body ${editing ? 'editing' : ''}`}>
        <DocsEditor
          docs={editing ? draft : workflow.docs}
          onEdit={setDraft}
          onSave={save}
          isEditing={editing}
          docsContext={docsContext}
          autocomplete={autocomplete}
          emptyPreviewContent={editable ? PLACEHOLDER : '아직 작성된 문서가 없습니다.'}
          onRequestEdit={() => editable && setEditing(true)}
          testId="flowwork-docs-editor"
        />
      </div>
    </div>
  );
}

export default DocsTab;
