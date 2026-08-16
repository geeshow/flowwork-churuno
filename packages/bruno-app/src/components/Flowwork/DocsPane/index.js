import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconPencil } from '@tabler/icons';
import DocsEditor from 'components/Documentation/DocsEditor';
import IconSparkles from 'components/Icons/IconSparkles';
import { aiGenerateScript } from 'utils/ai';

// 한 번 눌러 초안을 받는 자리라 사용자가 프롬프트를 쓰지 않는다 — 대신 무엇을 어떤
// 순서로 쓸지 여기서 정해준다. 스텝·입력값은 문맥(context)으로 함께 넘어간다.
const GENERATE_PROMPTS = {
  workflow: `이 작업의 문서를 한국어 마크다운으로 작성하세요. 순서는 이렇게 합니다.
1) 첫 문단: 이 작업이 무엇을 하고 언제 쓰는지 두세 문장
2) "## 입력값": 입력마다 무엇을 뜻하고 어떤 값을 넣는지 목록으로
3) "## 진행 순서": 스텝을 번호로. 조건부로 실행되는 스텝과 중간에 사람이 입력·선택해야 하는 지점은 반드시 밝힙니다
4) "## 주의": 실행 전에 알아야 할 점 (없으면 이 절을 생략)
제목(h1)은 넣지 마세요. 문맥에 없는 API·필드·동작은 지어내지 마세요.`,
  folder: `이 폴더의 문서를 한국어 마크다운으로 작성하세요.
1) 첫 문단: 이 폴더가 어떤 업무를 묶고 있는지 두세 문장
2) "## 작업": 폴더 안 작업마다 무엇을 하는지 한 줄씩
제목(h1)은 넣지 마세요. 문맥에 없는 작업이나 동작은 지어내지 마세요.`
};

/**
 * 문서 편집 판 — Bruno의 Docs 탭(components/Documentation)과 같은 편집기를 그대로
 * 쓴다. 미리보기 → 더블클릭 → 서식 편집(WYSIWYG) / 마크다운 모드 전환이 같고,
 * 저장 위치만 호출부가 정한다 (작업 파일의 docs, 폴더 표식의 docs).
 *
 * 편집 중인지(isEditing)는 Bruno에서는 탭 상태(useDocsEditingState)에 들어 있지만,
 * flowwork는 자체 탭을 쓰므로 여기서 들고 있는다.
 */
export function DocsPane({ docs, editable, context, emptyLabel, autoGenerate, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(docs ?? '');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
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

  // 받은 초안은 저장하지 않고 편집 상태로 띄운다 — 사람이 읽고 저장을 눌러야
  // 기록되므로, 이미 쓰여 있던 문서를 AI가 말없이 덮어쓰는 일이 없다.
  const generate = () => {
    setGenerating(true);
    setError(null);
    aiGenerateScript({
      scriptType: 'docs',
      prompt: GENERATE_PROMPTS[context.scope] ?? GENERATE_PROMPTS.workflow,
      currentScript: docs ?? '',
      docsContext: context
    })
      .then((result) => {
        if (result?.error) throw new Error(result.error);
        if (!result?.content) throw new Error('문서를 만들지 못했습니다. 잠시 후 다시 시도하세요.');
        setDraft(result.content);
        setEditing(true);
      })
      .catch((e) => setError(e.message))
      .finally(() => setGenerating(false));
  };

  // 사이드바 메뉴의 Generate Docs로 들어오면 화면이 열리자마자 초안을 만든다.
  // 같은 요청으로 두 번 부르지 않도록 처리한 값을 기억해 둔다.
  const generatedForRef = useRef(null);
  useEffect(() => {
    if (!autoGenerate || autoGenerate === generatedForRef.current) return;
    generatedForRef.current = autoGenerate;
    // generate는 매 렌더 새로 만들어지므로 의존성에 넣지 않는다 (넣으면 반복 호출)
    generate();
  }, [autoGenerate]);

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
            <>
              <button
                className="small"
                onClick={generate}
                disabled={generating}
                title="스텝과 입력값을 읽어 문서 초안을 만듭니다 — 저장 전에 고칠 수 있습니다"
              >
                <IconSparkles size={14} strokeWidth={1.5} />
                {generating ? '만드는 중…' : 'Generate Docs'}
              </button>
              <button className="small" onClick={() => setEditing(true)}>
                <IconPencil size={14} strokeWidth={1.5} />
                편집
              </button>
            </>
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
