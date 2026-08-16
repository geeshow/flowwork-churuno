import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { addTab, focusTab } from 'providers/ReduxStore/slices/tabs';
import { mountCollection } from 'providers/ReduxStore/slices/collections/actions';
import { findItemInCollectionByPathname, getDefaultRequestPaneTab } from 'utils/collections';
import { normalizePath } from 'utils/common/path';

const parentPath = (pathname) => pathname.slice(0, pathname.lastIndexOf('/'));

/**
 * 변경 목록의 한 줄 → 그 위치를 앱에서 연다.
 *
 * 서버는 저장소 기준 상대 경로를 주고 앱은 절대 경로로 컬렉션을 들고 있어,
 * 워크스페이스 경로를 앞에 붙여 맞춘다. 종류마다 여는 화면이 다르다:
 * 요청은 요청 탭, 폴더는 폴더 설정, 컬렉션은 컬렉션 설정, 환경은 환경 설정.
 */
const useOpenChangeLocation = (workspace) => {
  const dispatch = useDispatch();
  const collections = useSelector((state) => state.collections.collections);
  const tabs = useSelector((state) => state.tabs.tabs);

  return async (file) => {
    // 워크스페이스에서 지워진 항목은 열 곳이 없다 (main에만 남아 있다)
    if (file.change === 'D') {
      toast('이 워크스페이스에서 삭제된 항목이라 열 수 없습니다');
      return;
    }

    const pathname = normalizePath(`${workspace.pathname}/${file.path}`);
    // 컬렉션이 중첩될 수 있으므로 가장 깊게(길게) 일치하는 것을 고른다
    const collection = collections
      .filter((c) => pathname.startsWith(`${normalizePath(c.pathname)}/`))
      .sort((a, b) => b.pathname.length - a.pathname.length)[0];

    if (!collection) {
      toast.error('이 항목이 속한 컬렉션을 찾지 못했습니다');
      return;
    }

    if (collection.mountStatus !== 'mounted') {
      // 마운트 전에는 컬렉션 안의 요청·폴더가 스토어에 없다
      await dispatch(
        mountCollection({
          collectionUid: collection.uid,
          collectionPathname: collection.pathname,
          brunoConfig: collection.brunoConfig
        })
      ).catch(() => undefined);
    }

    if (file.kind === 'collection') {
      dispatch(addTab({ uid: collection.uid, collectionUid: collection.uid, type: 'collection-settings' }));
      return;
    }

    if (file.kind === 'environment') {
      dispatch(
        addTab({
          uid: `${collection.uid}-environment-settings`,
          collectionUid: collection.uid,
          type: 'environment-settings'
        })
      );
      return;
    }

    // 폴더는 폴더 자체(디렉토리)가 항목이고, folder.yml은 그 메타 파일이다
    const itemPathname = file.kind === 'folder' ? parentPath(pathname) : pathname;
    const item = findItemInCollectionByPathname(collection, itemPathname);
    if (!item) {
      toast.error('컬렉션에서 이 항목을 찾지 못했습니다. 새로고침 후 다시 시도해 주세요');
      return;
    }

    const openTab = tabs.find((t) => t.uid === item.uid);
    if (openTab) {
      dispatch(focusTab({ uid: openTab.uid }));
      return;
    }

    dispatch(
      addTab({
        uid: item.uid,
        collectionUid: collection.uid,
        pathname: item.pathname,
        ...(file.kind === 'folder'
          ? { type: 'folder-settings' }
          : { type: item.type, requestPaneTab: getDefaultRequestPaneTab(item) })
      })
    );
  };
};

export default useOpenChangeLocation;
