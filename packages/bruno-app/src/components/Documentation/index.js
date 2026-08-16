import 'github-markdown-css/github-markdown.css';
import get from 'lodash/get';
import { updateRequestDocs } from 'providers/ReduxStore/slices/collections';
import { useCallback, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { saveRequest } from 'providers/ReduxStore/slices/collections/actions';
import { buildAiContextPayload } from 'utils/ai';
import StyledWrapper from './StyledWrapper';
import { usePersistedState } from 'hooks/usePersistedState';
import { useDocsEditingState } from './useDocsEditingState';
import DocsEditor from './DocsEditor';

const Documentation = ({ item, collection }) => {
  const dispatch = useDispatch();
  const { isEditing, setEditing } = useDocsEditingState();
  const docs = item?.draft ? get(item, 'draft.request.docs') : get(item, 'request.docs');

  // Scroll tracking (both the rich-text preview/edit view and markdown mode's
  // CodeEditor) lives in DocsEditor itself; this just owns the persisted value.
  const [scroll, setScroll] = usePersistedState({ key: `request-docs-scroll-${item?.uid}`, default: 0 });

  const onEdit = useCallback(
    (value) => {
      if (!item) return;
      dispatch(
        updateRequestDocs({
          itemUid: item.uid,
          collectionUid: collection.uid,
          docs: value
        })
      );
    },
    [collection.uid, dispatch, item]
  );

  const onSave = useCallback(() => {
    if (!item) return;
    dispatch(saveRequest(item.uid, collection.uid));
  }, [collection.uid, dispatch, item]);

  const { requestContext, variables: aiVariables } = useMemo(
    () => (item ? buildAiContextPayload(item, collection) : { requestContext: null, variables: [] }),
    [item, collection]
  );

  if (!item) {
    return null;
  }

  return (
    <StyledWrapper className="h-full w-full relative">
      <DocsEditor
        docs={docs}
        onEdit={onEdit}
        onSave={onSave}
        isEditing={isEditing}
        collection={collection}
        collectionPath={collection?.pathname}
        requestContext={requestContext}
        variables={aiVariables}
        emptyPreviewContent={documentationPlaceholder}
        onRequestEdit={() => setEditing(true)}
        initialScroll={scroll}
        onScroll={setScroll}
        testId="docs-editor"
      />
    </StyledWrapper>
  );
};

export default Documentation;

const documentationPlaceholder = `
아직 작성된 문서가 없습니다. 이 요청의 목적과 사용법을 정리해 두면, 함께 작업하는 누구나 API를 빠르게 이해할 수 있습니다.

## 이런 내용을 담아 주세요
- 이 요청이 하는 일과 호출하는 상황
- 주요 파라미터·헤더 설명
- 요청/응답 예시와 오류 상황별 대처 방법

더블클릭하면 바로 작성을 시작할 수 있습니다. 문서는 저장 즉시 기록되어 팀과 공유됩니다.
`;
