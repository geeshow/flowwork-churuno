import 'github-markdown-css/github-markdown.css';
import get from 'lodash/get';
import { updateCollectionDocs } from 'providers/ReduxStore/slices/collections';
import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { saveCollectionSettings } from 'providers/ReduxStore/slices/collections/actions';
import { buildAiVariablesPayload, buildDocsContextFromCollection } from 'utils/ai';
import StyledWrapper from './StyledWrapper';
import { IconEdit, IconFileText } from '@tabler/icons';
import Button from 'ui/Button/index';
import ActionIcon from 'ui/ActionIcon/index';
import { usePersistedState } from 'hooks/usePersistedState';
import { useDocsEditingState } from 'components/Documentation/useDocsEditingState';
import DocsEditor from 'components/Documentation/DocsEditor';

const Docs = ({ collection }) => {
  const dispatch = useDispatch();
  const { isEditing, setEditing } = useDocsEditingState();
  const savedDocs = get(collection, 'root.docs', '');
  const docs = collection.draft?.root ? get(collection, 'draft.root.docs', '') : savedDocs;
  const docsContext = useMemo(() => buildDocsContextFromCollection(collection), [collection]);
  const aiVariables = useMemo(() => buildAiVariablesPayload(collection, null), [collection]);

  // Scroll tracking (both the rich-text preview/edit view and markdown mode's
  // CodeEditor) lives in DocsEditor itself; this just owns the persisted value.
  const [scroll, setScroll] = usePersistedState({ key: `collection-docs-scroll-${collection.uid}`, default: 0 });

  const toggleViewMode = () => {
    setEditing(!isEditing);
  };

  const onEdit = (value) => {
    dispatch(
      updateCollectionDocs({
        collectionUid: collection.uid,
        docs: value
      })
    );
  };

  const handleDiscardChanges = () => {
    dispatch((
      updateCollectionDocs({
        collectionUid: collection.uid,
        docs: savedDocs
      }))
    );
    toggleViewMode();
  };

  const onSave = () => {
    dispatch(saveCollectionSettings(collection.uid));
    toggleViewMode();
  };

  return (
    <StyledWrapper className="h-full w-full relative flex flex-col">
      <div className="flex flex-row w-full justify-between items-center mb-4">
        <div className="text-lg font-medium flex items-center gap-2">
          <IconFileText size={20} strokeWidth={1.5} />
          Documentation
        </div>
        <div className="flex flex-row gap-2 items-center justify-center">
          {isEditing ? (
            <>
              <Button type="button" color="secondary" onClick={handleDiscardChanges}>
                Cancel
              </Button>
              <Button type="button" onClick={onSave}>
                Save
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <DocsEditor
          docs={docs}
          onEdit={onEdit}
          onSave={onSave}
          isEditing={isEditing}
          collection={collection}
          collectionPath={collection.pathname}
          docsContext={docsContext}
          variables={aiVariables}
          emptyPreviewContent={documentationPlaceholder}
          onRequestEdit={toggleViewMode}
          initialScroll={scroll}
          onScroll={setScroll}
        />
      </div>
    </StyledWrapper>
  );
};

export default Docs;

const documentationPlaceholder = `
아직 작성된 문서가 없습니다. 이 공간에 이 컬렉션의 목적과 사용법을 정리해 두면, 함께 작업하는 누구나 API를 빠르게 이해할 수 있습니다.

## 개요
- 이 컬렉션이 다루는 서비스·도메인
- 주요 API 호출 흐름 (어떤 순서로, 어떤 상황에서 호출하는지)
- 담당자와 관련 문서 링크

## 작성 가이드
- 요청/응답 예시를 함께 남겨 주세요
- 오류 상황과 대처 방법을 기록해 주세요
- 문서는 저장 즉시 기록되어 팀과 공유됩니다

## 마크다운 지원
- **굵게** / *기울임*
- \`코드 블록\`과 문법 강조
- 표, 목록, [링크](https://usebruno.com)
`;
