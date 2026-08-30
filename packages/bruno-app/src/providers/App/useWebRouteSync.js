/**
 * Web-mode only: keeps the URL hash in sync with what is focused, so every
 * workspace, collection, folder and request has a shareable link.
 *
 *   #/ws/<workspace>                          workspace overview
 *   #/ws/<workspace>/environments             workspace environments
 *   #/ws/<workspace>/c/<collection>           collection settings
 *   #/ws/<workspace>/c/<collection>/<path>    folder (group) or request file
 *   #/flowwork/...                            flowwork app (routes owned by components/Flowwork)
 *   #/home                                    product intro page (ProductHome)
 *
 * Segments are the on-disk names, URL-encoded. Opening a link switches the
 * workspace, mounts the collection and opens the matching tab; focusing things
 * in the UI rewrites the hash (replaceState — no history spam).
 *
 * A #/flowwork hash only flips the app switcher here — the Flowwork component
 * parses and mirrors its own sub-routes. While flowwork is active this hook
 * leaves the hash alone so the two writers never fight.
 */

import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { setActiveApp } from 'providers/ReduxStore/slices/app';
import { switchWorkspace } from 'providers/ReduxStore/slices/workspaces/actions';
import { mountCollection, openCollectionSettings } from 'providers/ReduxStore/slices/collections/actions';
import { expandCollection, toggleCollectionItem } from 'providers/ReduxStore/slices/collections';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import {
  findItemInCollectionByPathname,
  getDefaultRequestPaneTab,
  isItemAFolder,
  isItemARequest
} from 'utils/collections';
import { isWebMode } from 'utils/common/platform';

const encodeSegments = (segments) => segments.map(encodeURIComponent).join('/');

const parseHash = (hash) => {
  const segments = (hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (segments[0] === 'flowwork') {
    return { flowwork: true };
  }
  if (segments[0] === 'home') {
    return { home: true };
  }
  if (segments[0] !== 'ws' || !segments[1]) {
    return null;
  }
  const route = { workspaceName: segments[1] };
  if (segments[2] === 'environments') {
    route.environments = true;
  } else if (segments[2] === 'c' && segments[3]) {
    route.collectionDirName = segments[3];
    route.itemSegments = segments.slice(4);
  }
  return route;
};

const buildHashFromState = (state) => {
  if (state.app.activeApp === 'flowwork') {
    return null;
  }
  if (state.app.activeApp === 'home') {
    return '#/home';
  }
  const { workspaces, activeWorkspaceUid } = state.workspaces;
  const workspace = workspaces.find((w) => w.uid === activeWorkspaceUid);
  if (!workspace?.name) {
    return null;
  }
  const base = `#/ws/${encodeURIComponent(workspace.name)}`;

  const activeTab = state.tabs.tabs.find((t) => t.uid === state.tabs.activeTabUid);
  if (!activeTab) {
    return base;
  }
  if (activeTab.type === 'workspaceEnvironments') {
    return `${base}/environments`;
  }
  if (activeTab.type === 'workspaceOverview') {
    return base;
  }

  const collection = state.collections.collections.find((c) => c.uid === activeTab.collectionUid);
  // scratch (transient) requests have no shareable location
  if (!collection || collection.uid === workspace.scratchCollectionUid) {
    return base;
  }
  const collectionHash = `${base}/c/${encodeURIComponent(collection.pathname.split('/').pop())}`;
  if (activeTab.type === 'collection-settings') {
    return collectionHash;
  }
  if (!activeTab.pathname || !activeTab.pathname.startsWith(`${collection.pathname}/`)) {
    return collectionHash;
  }
  const relativeSegments = activeTab.pathname.slice(collection.pathname.length + 1).split('/');
  if (relativeSegments[0] === '.transient') {
    return collectionHash;
  }
  return `${collectionHash}/${encodeSegments(relativeSegments)}`;
};

const expandAncestors = (dispatch, collection, item) => {
  dispatch(expandCollection(collection.uid));
  const relative = item.pathname.slice(collection.pathname.length + 1).split('/');
  let currentPath = collection.pathname;
  for (const segment of relative.slice(0, -1)) {
    currentPath = `${currentPath}/${segment}`;
    const folder = findItemInCollectionByPathname(collection, currentPath);
    if (folder?.collapsed) {
      dispatch(toggleCollectionItem({ itemUid: folder.uid, collectionUid: collection.uid }));
    }
  }
};

const useWebRouteSync = () => {
  const dispatch = useDispatch();
  const store = useStore();
  const [pendingHash, setPendingHash] = useState(() => (isWebMode() ? window.location.hash : ''));
  const applyingRef = useRef(false);

  const activeApp = useSelector((state) => state.app.activeApp);
  const workspaces = useSelector((state) => state.workspaces.workspaces);
  const activeWorkspaceUid = useSelector((state) => state.workspaces.activeWorkspaceUid);
  const collections = useSelector((state) => state.collections.collections);
  const activeTabUid = useSelector((state) => state.tabs.activeTabUid);
  const tabs = useSelector((state) => state.tabs.tabs);

  // URL → state: applied once boot has progressed far enough to resolve the route,
  // and again whenever the user navigates to a new hash.
  useEffect(() => {
    if (!isWebMode() || !pendingHash) return;
    const route = parseHash(pendingHash);
    if (!route) {
      setPendingHash('');
      return;
    }

    if (route.flowwork || route.home) {
      dispatch(setActiveApp(route.home ? 'home' : 'flowwork'));
      setPendingHash('');
      return;
    }

    const state = store.getState();
    const workspace = state.workspaces.workspaces.find((w) => w.name === route.workspaceName);
    if (!workspace) return; // boot not far enough — retried on the next state change

    let collection = null;
    if (route.collectionDirName) {
      collection = state.collections.collections.find(
        (c) => c.pathname === `${workspace.pathname}/${route.collectionDirName}`
      );
      if (!collection) return;
    }

    const apply = async () => {
      applyingRef.current = true;
      try {
        dispatch(setActiveApp('bruno'));
        if (workspace.uid !== state.workspaces.activeWorkspaceUid) {
          await dispatch(switchWorkspace(workspace.uid));
        }

        if (!collection) {
          const scratchUid = store.getState().workspaces.workspaces
            .find((w) => w.uid === workspace.uid)?.scratchCollectionUid;
          if (scratchUid) {
            const type = route.environments ? 'workspaceEnvironments' : 'workspaceOverview';
            const suffix = route.environments ? 'environments' : 'overview';
            dispatch(addTab({ uid: `${scratchUid}-${suffix}`, collectionUid: scratchUid, type }));
          }
          return;
        }

        if (collection.mountStatus !== 'mounted') {
          await dispatch(mountCollection({
            collectionUid: collection.uid,
            collectionPathname: collection.pathname,
            brunoConfig: collection.brunoConfig,
            workspacePathname: workspace.pathname
          }));
        }

        if (!route.itemSegments?.length) {
          dispatch(expandCollection(collection.uid));
          dispatch(openCollectionSettings(collection.uid));
          return;
        }

        const mounted = store.getState().collections.collections.find((c) => c.uid === collection.uid);
        const itemPathname = `${collection.pathname}/${route.itemSegments.join('/')}`;
        const item = findItemInCollectionByPathname(mounted, itemPathname)
          || findItemInCollectionByPathname(mounted, `${itemPathname}.bru`)
          || findItemInCollectionByPathname(mounted, `${itemPathname}.yml`);
        if (!item) return;

        expandAncestors(dispatch, mounted, item);
        if (isItemAFolder(item)) {
          if (item.collapsed) {
            dispatch(toggleCollectionItem({ itemUid: item.uid, collectionUid: collection.uid }));
          }
          dispatch(addTab({ uid: item.uid, collectionUid: collection.uid, type: 'folder-settings', pathname: item.pathname }));
        } else if (isItemARequest(item)) {
          dispatch(addTab({
            uid: item.uid,
            collectionUid: collection.uid,
            type: item.type,
            pathname: item.pathname,
            requestPaneTab: getDefaultRequestPaneTab(item),
            preview: false
          }));
        }
      } finally {
        applyingRef.current = false;
      }
    };

    setPendingHash('');
    apply().catch((error) => console.error('[web-route] failed to open shared link:', error));
  }, [pendingHash, workspaces, collections]);

  // user navigation (paste a link, back/forward) re-enters the apply flow
  useEffect(() => {
    if (!isWebMode()) return;
    const onHashChange = () => {
      if (applyingRef.current) return;
      if (window.location.hash !== buildHashFromState(store.getState())) {
        setPendingHash(window.location.hash);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // state → URL: whatever is focused becomes the address-bar link
  useEffect(() => {
    if (!isWebMode() || pendingHash || applyingRef.current) return;
    const canonical = buildHashFromState(store.getState());
    if (canonical && window.location.hash !== canonical) {
      window.history.replaceState(null, '', canonical);
    }
  }, [activeApp, activeTabUid, activeWorkspaceUid, tabs, collections, workspaces, pendingHash]);
};

export default useWebRouteSync;
