import { useDispatch } from 'react-redux';
import { isItemAFolder } from 'utils/tabs';
import { renameItem, saveRequest, closeTabs } from 'providers/ReduxStore/slices/collections/actions';

const MAX_NAME_LENGTH = 255;

/**
 * 요청/폴더 이름 변경 — 이름 변경 모달과 사이드바 인라인 편집이 같은 규칙을 쓴다.
 *
 * 이름이 바뀌면 파일 경로도 바뀌므로, 저장되지 않은 편집은 먼저 저장하고
 * 폴더는 열린 탭을 닫는다(하위 항목 탭이 옛 경로를 가리키게 되기 때문).
 * 반환값은 실제로 이름을 바꿨는지 여부다.
 */
const useRenameCollectionItem = (collectionUid, item) => {
  const dispatch = useDispatch();

  return async (newName) => {
    const name = newName?.trim();
    if (!name || name === item.name) {
      return false;
    }
    if (name.length > MAX_NAME_LENGTH) {
      throw new Error(`Name must be ${MAX_NAME_LENGTH} characters or less`);
    }

    const isFolder = isItemAFolder(item);
    if (!isFolder && item.draft) {
      await dispatch(saveRequest(item.uid, collectionUid, true));
    }
    await dispatch(renameItem({ itemUid: item.uid, collectionUid, newName: name }));
    if (isFolder) {
      dispatch(closeTabs({ tabUids: [item.uid] }));
    }
    return true;
  };
};

export default useRenameCollectionItem;
