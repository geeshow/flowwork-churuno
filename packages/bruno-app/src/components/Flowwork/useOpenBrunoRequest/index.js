import { useDispatch, useStore } from 'react-redux';
import { mountCollection } from 'providers/ReduxStore/slices/collections/actions';
import { findItemInCollectionByPathname } from 'utils/collections';

const dirName = (pathname) => pathname.split('/').pop();

/**
 * flowwork 카탈로그 항목(부서/폴더/이름) → Bruno에서 그 요청 열기.
 *
 * 워크플로우 데이터에는 그 API가 어느 컬렉션 것인지가 없고(부서 폴더부터 기록한다),
 * 워크스페이스마다 컬렉션 이름이 다를 수 있다. 그래서 워크스페이스의 컬렉션을 하나씩
 * 마운트해 같은 경로의 요청이 있는지 보고, 찾은 컬렉션으로 주소를 만든다.
 *
 * 주소만 바꾸면 웹 모드 라우팅(providers/App/useWebRouteSync)이 앱 전환과 탭 열기를
 * 맡는다. 찾지 못하면 false — 호출부가 사용자에게 알린다.
 *
 * popup으로 부르면 새 창에 띄운다. 아직 저장하지 않은 것을 짜는 중(새 워크플로우·AI
 * 초안)에는 이 화면을 떠나는 순간 그것이 사라지므로, 잠깐 들여다보는 일에 지금 하던
 * 일을 잃게 할 수는 없다.
 */
export function useOpenBrunoRequest() {
  const dispatch = useDispatch();
  const store = useStore();

  return async (entry, { popup = false } = {}) => {
    const state = store.getState();
    const { workspaces, activeWorkspaceUid } = state.workspaces;
    const active = workspaces.find((w) => w.uid === activeWorkspaceUid);
    // main(default)은 읽기 전용이라 링크로 열리지 않는다 — 편집용 워크스페이스로 보낸다
    const workspace = active && active.type !== 'default' ? active : workspaces.find((w) => w.type !== 'default');
    if (!workspace?.name) return false;

    const segments = [entry.department, ...entry.itemPath, entry.name];
    const candidates = state.collections.collections.filter(
      (c) => c.pathname.startsWith(`${workspace.pathname}/`) && c.uid !== workspace.scratchCollectionUid
    );

    const findRequestItem = (collectionUid, base) => {
      const mounted = store.getState().collections.collections.find((c) => c.uid === collectionUid);
      return findItemInCollectionByPathname(mounted, `${base}.bru`)
        || findItemInCollectionByPathname(mounted, `${base}.yml`);
    };

    for (const collection of candidates) {
      const justMounted = collection.mountStatus !== 'mounted';
      if (justMounted) {
        await dispatch(mountCollection({
          collectionUid: collection.uid,
          collectionPathname: collection.pathname,
          brunoConfig: collection.brunoConfig,
          workspacePathname: workspace.pathname
        }));
      }
      const base = [collection.pathname, ...segments].join('/');
      let item = findRequestItem(collection.uid, base);
      // 웹 모드의 IPC 이벤트는 다음 태스크로 전달되어(web-ipc/core.js emit), 마운트
      // 직후에는 트리가 아직 스토어에 없을 수 있다 — 잠깐 물러났다 다시 본다
      for (let attempt = 0; justMounted && !item && attempt < 5; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        item = findRequestItem(collection.uid, base);
      }
      if (!item) continue;

      const route = [dirName(collection.pathname), ...segments].map(encodeURIComponent).join('/');
      const hash = `#/ws/${encodeURIComponent(workspace.name)}/c/${route}`;
      if (popup) {
        window.open(`${window.location.origin}${window.location.pathname}${hash}`, '_blank');
      } else {
        window.location.hash = hash;
      }
      return true;
    }
    return false;
  };
}

export default useOpenBrunoRequest;
