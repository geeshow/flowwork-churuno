import React, { useState, useRef, useEffect } from 'react';
import classnames from 'classnames';
import ManageWorkspace from 'components/ManageWorkspace';
import RequestTabs from 'components/RequestTabs';
import RequestTabPanel from 'components/RequestTabPanel';
import AiChatSidebar from 'components/AiChatSidebar';
import AiChatPopout from 'components/AiChatSidebar/Popout';
import Sidebar from 'components/Sidebar';
import Flowwork from 'components/Flowwork';
import ProductHome from 'components/ProductHome';
import ServerConnectBanner from 'components/ServerConnectBanner';
import StatusBar from 'components/StatusBar';
import PreferencesPageOverlay from 'components/Preferences/PageOverlay';
import AppTitleBar from 'components/AppTitleBar';
import ApiSpecPanel from 'components/ApiSpecPanel';
import TabPanelErrorBoundary from 'components/RequestTabPanel/TabPanelErrorBoundary';
// import ErrorCapture from 'components/ErrorCapture';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { setActiveApp, showManageWorkspacePage as showManageWorkspacePageAction } from 'providers/ReduxStore/slices/app';
import { isElectron, isWebMode } from 'utils/common/platform';
import StyledWrapper from './StyledWrapper';
import 'swagger-ui-react/swagger-ui.css';
import Devtools from 'components/Devtools';
import useGrpcEventListeners from 'utils/network/grpc-event-listeners';
import useWsEventListeners from 'utils/network/ws-event-listeners';
import Portal from 'components/Portal';
import SaveTransientRequestContainer from 'components/SaveTransientRequest/Container';
import SaveTransientRequest from 'components/SaveTransientRequest';

const TransientRequestModalsRenderer = ({ modals }) => {
  if (modals.length === 0) {
    return null;
  }

  if (modals.length === 1) {
    return (
      <SaveTransientRequest
        item={modals[0].item}
        collection={modals[0].collection}
        isOpen={true}
        closeAfterSave={modals[0].closeAfterSave}
      />
    );
  }

  return <SaveTransientRequestContainer />;
};

export default function Main() {
  const activeTabUid = useSelector((state) => state.tabs.activeTabUid);
  const activeApiSpecUid = useSelector((state) => state.apiSpec.activeApiSpecUid);
  const isDragging = useSelector((state) => state.app.isDragging);
  const activeApp = useSelector((state) => state.app.activeApp);
  const showApiSpecPage = useSelector((state) => state.app.showApiSpecPage);
  const showManageWorkspacePage = useSelector((state) => state.app.showManageWorkspacePage);
  const showPreferencesPage = useSelector((state) => state.app.showPreferencesPage);
  const isConsoleOpen = useSelector((state) => state.logs.isConsoleOpen);
  const saveTransientRequestModals = useSelector((state) => state.collections.saveTransientRequestModals);

  // AI sidebar mounts here so it spans the full request-pane height. It reads
  // the active collection via the active tab so the sidebar follows tab switches.
  // The selector returns null while the sidebar is closed so the page doesn't
  // re-render on every tabs/collections change — important on Windows where
  // extra re-renders during initial layout were destabilising CodeMirror.
  const isAiSidebarOpen = useSelector((state) => state.chat.isOpen);
  const isAiPoppedOut = useSelector((state) => state.chat.isPoppedOut);
  const activeCollection = useSelector((state) => {
    if (!state.chat.isOpen) return null;
    const activeTab = state.tabs.tabs.find((t) => t.uid === state.tabs.activeTabUid);
    if (!activeTab) return null;
    return state.collections.collections.find((c) => c.uid === activeTab.collectionUid) || null;
  });
  const mainSectionRef = useRef(null);
  const [showRosettaBanner, setShowRosettaBanner] = useState(false);
  // 웹 모드: 실행 서버(web-server)에 붙지 못한 채 뜬 경우 그 주소를 알려 준다
  const [serverBootError, setServerBootError] = useState(null);
  const reduxStore = useStore();
  const dispatch = useDispatch();

  // Initialize event listeners
  useGrpcEventListeners();
  useWsEventListeners();

  const className = classnames({
    'is-dragging': isDragging
  });

  useEffect(() => {
    if (!isElectron()) {
      return;
    }

    const { ipcRenderer } = window;

    const removeAppLoadedListener = ipcRenderer.on('main:app-loaded', (init) => {
      if (mainSectionRef.current) {
        mainSectionRef.current.setAttribute('data-app-state', 'loaded');
      }
      setShowRosettaBanner(init.isRunningInRosetta);

      // 웹 모드: 부팅이 끝나고도 보여줄 탭이 없으면(워크스페이스 복원이 탭을
      // 열지 못한 환경) Loading 스피너에 머물지 않는다. 해시가 특정 화면을
      // 가리키면 라우트 동기화가 곧 탭을 열므로 건드리지 않는다. git 저장소에
      // main뿐이라 작업 워크스페이스가 하나도 없으면 브랜치를 만들 수 있는
      // 워크스페이스 관리 화면으로, 그 외에는 제품 홈으로 보낸다.
      if (isWebMode()) {
        setTimeout(() => {
          const state = reduxStore.getState();
          // 라우트 동기화가 부팅 직후 상태를 #/ws/<name>으로 미러링하므로, 탭을
          // 열게 될 딥링크(#/ws/<name>/... 하위 경로)만 양보한다.
          const hashSegments = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
          const deepLink = hashSegments[0] === 'ws' && hashSegments.length > 2;
          if (state.app.activeApp !== 'bruno' || state.tabs.tabs.length || deepLink) {
            return;
          }
          const workspaces = state.workspaces.workspaces || [];
          const gitModeWithoutWorkspaces = workspaces.length > 0
            && workspaces[0].branch
            && workspaces.every((workspace) => workspace.type === 'default');
          if (gitModeWithoutWorkspaces) {
            dispatch(showManageWorkspacePageAction());
          } else {
            dispatch(setActiveApp('home'));
          }
        }, 1500);
      }
    });
    // 서버 없이 뜬 정적 배포(GitHub Pages 등) — 빈 워크스페이스 대신 제품 소개로 연다
    const removeServerUnreachableListener = ipcRenderer.on('main:web:server-unreachable', ({ serverUrl, reason }) => {
      setServerBootError({ serverUrl, reason });
      dispatch(setActiveApp('home'));
    });

    return () => {
      removeAppLoadedListener();
      removeServerUnreachableListener();
    };
  }, []);

  return (
    // <ErrorCapture>
    <div id="main-container" className="flex flex-col h-screen max-h-screen overflow-hidden">
      <AppTitleBar />
      {showRosettaBanner ? (
        <Portal>
          <div className="fixed bottom-0 left-0 right-0 z-10 bg-amber-100 border border-amber-400 text-amber-700 px-4 py-3" role="alert">
            <strong className="font-bold">WARNING:</strong>
            <div>
              It looks like Bruno was launched as the Intel (x64) build under Rosetta on your Apple Silicon Mac. This can cause reduced performance and unexpected behavior.
            </div>
            <button className="absolute right-2 top-0 text-xl" onClick={() => setShowRosettaBanner(!showRosettaBanner)}>
              &times;
            </button>
          </div>
        </Portal>
      ) : null}
      {serverBootError ? (
        <ServerConnectBanner serverUrl={serverBootError.serverUrl} reason={serverBootError.reason} onDismiss={() => setServerBootError(null)} />
      ) : null}
      <div
        ref={mainSectionRef}
        className="flex-1 min-h-0 flex"
        data-app-state="loading"
        style={{
          height: isConsoleOpen ? `calc(100vh - 60px - ${isConsoleOpen ? '300px' : '0px'})` : 'calc(100vh - 60px)'
        }}
      >
        {activeApp === 'home' ? (
          <ProductHome />
        ) : activeApp === 'flowwork' ? (
          <Flowwork />
        ) : (
          <StyledWrapper className={className} style={{ height: '100%', zIndex: 1 }}>
            <Sidebar />
            <section className="flex flex-grow flex-col overflow-hidden">
              {showApiSpecPage && activeApiSpecUid ? (
                <ApiSpecPanel key={activeApiSpecUid} />
              ) : showManageWorkspacePage ? (
                <ManageWorkspace />
              ) : (
                <>
                  <RequestTabs />
                  <div className="relative flex flex-col flex-grow overflow-hidden">
                    <TabPanelErrorBoundary key={activeTabUid} tabUid={activeTabUid}>
                      <RequestTabPanel key={activeTabUid} />
                    </TabPanelErrorBoundary>
                  </div>
                </>
              )}
            </section>
            {isAiSidebarOpen && activeCollection && isAiPoppedOut && (
              <AiChatPopout collection={activeCollection} />
            )}
            {isAiSidebarOpen && activeCollection && !isAiPoppedOut && !showApiSpecPage && !showManageWorkspacePage && (
              <AiChatSidebar collection={activeCollection} />
            )}
          </StyledWrapper>
        )}
      </div>

      <Devtools mainSectionRef={mainSectionRef} />
      <StatusBar />
      {showPreferencesPage ? <PreferencesPageOverlay /> : null}
      <TransientRequestModalsRenderer modals={saveTransientRequestModals} />
    </div>
    // </ErrorCapture>
  );
}
