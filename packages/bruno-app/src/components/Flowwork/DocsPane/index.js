import React, { useMemo, useState } from 'react';
import { IconPencil } from '@tabler/icons';
import DocsEditor from 'components/Documentation/DocsEditor';

/**
 * 문서 편집 판 — Bruno의 Docs 탭(components/Documentation)과 같은 편집기를 그대로
 * 쓴다. 미리보기 → 더블클릭 → 서식 편집(WYSIWYG) / 마크다운 모드 전환이 같고,
 * 저장 위치만 호출부가 정한다 (작업 파일의 docs, 폴더 표식의 docs).
 *
 * 편집 중인지(isEditing)는 Bruno에서는 탭 상태(useDocsEditingState)에 들어 있지만,
 * flowwork는 자체 탭을 쓰므로 여기서 들고 있는다.
 */
export function DocsPane({ docs, editable, context, emptyLabel, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(docs ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const autocomplete = useMemo(
    () => ({ scriptType: 'docs', getContext: () => ({ docsContext: context }) }),
    [context]
  );

  const placeholder = `
${emptyLabel}

## 이런 내용을 담아 주세요
- 무엇을 하는지, 언제 쓰는지
- 입력값이 각각 무엇을 뜻하는지
- 순서와 중간에 사람이 판단해야 하는 지점

더블클릭하면 바로 작성을 시작할 수 있습니다. 저장하면 다른 편집과 똑같이 즉시 기록됩니다.
`;

  const save = () => {
    setSaving(true);
    setError(null);
    Promise.resolve(onSave(draft))
      .then(() => setEditing(false))
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
                  setDraft(docs ?? '');
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
          docs={editing ? draft : docs}
          onEdit={setDraft}
          onSave={save}
          isEditing={editing}
          docsContext={context}
          autocomplete={autocomplete}
          emptyPreviewContent={editable ? placeholder : '아직 작성된 문서가 없습니다.'}
          onRequestEdit={() => editable && setEditing(true)}
          testId="flowwork-docs-editor"
        />
      </div>
    </div>
  );
}

export default DocsPane;
