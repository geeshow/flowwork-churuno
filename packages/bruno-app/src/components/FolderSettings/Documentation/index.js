import get from 'lodash/get';
import { updateFolderDocs } from 'providers/ReduxStore/slices/collections';
import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { saveFolderRoot } from 'providers/ReduxStore/slices/collections/actions';
import { buildAiVariablesPayload, buildDocsContextFromFolder } from 'utils/ai';
import Button from 'ui/Button';
import StyledWrapper from './StyledWrapper';
import { usePersistedState } from 'hooks/usePersistedState';
import { useDocsEditingState } from 'components/Documentation/useDocsEditingState';
import DocsEditor from 'components/Documentation/DocsEditor';

const Documentation = ({ collection, folder }) => {
  const dispatch = useDispatch();
  const { isEditing, setEditing } = useDocsEditingState();
  const docs = folder.draft ? get(folder, 'draft.docs', '') : get(folder, 'root.docs', '');

  // Scroll tracking (both the rich-text preview/edit view and markdown mode's
  // CodeEditor) lives in DocsEditor itself; this just owns the persisted value.
  const [scroll, setScroll] = usePersistedState({ key: `folder-docs-scroll-${folder.uid}`, default: 0 });

  const toggleViewMode = () => {
    setEditing(!isEditing);
  };

  const onEdit = (value) => {
    dispatch(
      updateFolderDocs({
        folderUid: folder.uid,
        collectionUid: collection.uid,
        docs: value
      })
    );
  };

  const onSave = () => dispatch(saveFolderRoot(collection.uid, folder.uid));
  const docsContext = useMemo(() => buildDocsContextFromFolder(collection, folder), [collection, folder]);
  const aiVariables = useMemo(() => buildAiVariablesPayload(collection, folder), [collection, folder]);

  if (!folder) {
    return null;
  }

  return (
    <StyledWrapper className="h-full w-full relative flex flex-col">
      <div className="flex-1 min-h-0 flex flex-col">
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

      {isEditing && (
        <div className="mt-6 flex-shrink-0">
          <Button type="submit" size="sm" onClick={onSave}>
            Save
          </Button>
        </div>
      )}
    </StyledWrapper>
  );
};

export default Documentation;

const documentationPlaceholder = `
아직 작성된 문서가 없습니다. 이 폴더에 묶인 API들의 목적과 흐름을 정리해 두면, 함께 작업하는 누구나 빠르게 이해할 수 있습니다.

## 이런 내용을 담아 주세요
- 폴더에 묶인 API들의 공통 목적
- 호출 순서와 선행 조건 (어떤 요청을 먼저 보내야 하는지)
- 공통으로 쓰는 헤더·변수 설명

더블클릭하면 바로 작성을 시작할 수 있습니다. 문서는 저장 즉시 기록되어 팀과 공유됩니다.
`;
