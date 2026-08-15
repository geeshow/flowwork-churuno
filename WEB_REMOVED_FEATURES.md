# 웹 버전 전환으로 삭제된 기능 목록

브라우저 + Python 실행 서버(web-server/) 구조에서는 동작할 수 없는 데스크톱(Electron) 전용
기능들을 코드에서 제거했다. 앱(Electron) 버전은 현재 고려하지 않으므로 조건부 분기 없이
기능 자체를 삭제했다. 나중에 데스크톱 지원을 되살릴 때 이 문서를 기준으로 복원 범위를
파악할 수 있다 (`git log`에서 이 문서가 추가된 커밋의 diff 참조).

## 1. Reveal in Finder / Show in Folder

파일이 서버에 있으므로 사용자 로컬 파일 탐색기를 열 수 없다. `renderer:show-in-folder`
(`shell.showItemInFolder`) 호출 전부 삭제.

- `components/ManageWorkspace` — 워크스페이스 행의 Reveal 버튼
- `components/Sidebar/Collections/Collection` — 컬렉션 컨텍스트 메뉴
- `components/Sidebar/Collections/Collection/CollectionItem` — 폴더/요청 컨텍스트 메뉴
- `components/RequestTabs/CollectionHeader` — 워크스페이스 액션 드롭다운
- `components/WorkspaceHome/WorkspaceOverview/CollectionsList` — 컬렉션 드롭다운
- `components/OpenAPISyncTab/OpenAPISyncHeader` — 로컬 스펙 경로 클릭 시 열기 (일반 텍스트로 대체)
- `showInFolder` 썽크(`slices/collections/actions.js`), `getRevealInFolderLabel`(`utils/common/platform.js`) 삭제

## 2. Devtools 터미널 탭 (node-pty)

브라우저에 로컬 셸을 노출할 수 없고, 서버 셸 노출은 보안상 불가.

- `components/Devtools/Console/TerminalTab/` 디렉터리 삭제, Console의 Terminal 탭 제거
- `utils/terminal.js`(openDevtoolsAndSwitchToTerminal) 삭제
- "Open in Terminal" 메뉴: 사이드바 컬렉션/폴더 메뉴, CollectionsSection 워크스페이스 메뉴, ManageWorkspace 드롭다운에서 제거
- `openTerminal` 단축키(Cmd+T)와 Hotkeys 핸들러, keyMappings의 "Developer Tool" 섹션 삭제
- logs 슬라이스의 `TABS.TERMINAL` 제거, web-ipc의 terminal:* 스텁 제거
- **npm 의존성 제거: `@xterm/xterm`, `@xterm/addon-fit`**

## 3. Mock Server (베타 기능 전체)

로컬 포트에 HTTP 서버를 띄우는 기능. 서버에서 띄우면 사용자의 localhost가 아니며
멀티유저 포트 충돌 문제가 있어 기능 전체를 삭제.

- 디렉터리 삭제: `components/MockServer/`, `components/Sidebar/Sections/MockServersSection/`,
  `providers/ReduxStore/slices/mock-server/`, `utils/mock-server/`,
  `slices/collections/mockResponseEditorReducers.js`
- 진입점 제거: 사이드바 Mock Servers 섹션, 컬렉션 메뉴 "Create Mock server",
  CollectionHeader "Mock Server" 메뉴, Preferences > Beta의 Mock Server 토글
  (`BETA_FEATURES.MOCK_SERVER` 삭제)
- `mock-server`/`mock-response` 탭 타입: tabs 슬라이스·snapshot 직렬화에서 제거
  (기존 스냅샷에 남은 mock 탭은 복원 시 무시 — `IGNORED_TAB_TYPES`)
- Response Example의 "Try Result" 탭(mock 서버 시험 결과 표시) 제거
- useIpcEvents의 mock-server 이벤트 리스너, 워크스페이스 전환 시 `hydrateMockServerInstances` 호출 제거
- Redux 스토어에서 `mockServer` 리듀서 제거

## 4. 네이티브 저장 다이얼로그 기반 저장/내보내기

`dialog.showSaveDialog`로 로컬 경로에 쓰는 기능들. 브라우저 다운로드(file-saver)로 동작하는
내보내기(YAML 단일 파일, 문서 HTML, 컬렉션 JSON)는 **유지**.

- 응답 다운로드: `components/ResponsePane/ResponseDownload/` 삭제,
  ResponsePaneActions/ResponseActions의 "Download response" 항목, LargeResponseWarning의
  Download 버튼 제거 (`renderer:save-response-to-file`)
- 컬렉션 ZIP 내보내기: ShareCollection 모달의 "Bruno Collection (ZIP)" 옵션 제거
  (`renderer:export-collection-zip`) — YAML 단일 파일 내보내기만 유지
- Postman 내보내기: ShareCollection의 Postman 옵션과
  `components/.../ExportCollection/ExportToPostman/` 디렉터리, `exportCollectionToPostman` 썽크 삭제
  (서버 디스크 경로에 쓰는 방식이라 웹에서 무의미)
- 워크스페이스 내보내기: CollectionHeader의 Export 메뉴와 `exportWorkspaceAction` 썽크 삭제
  (`renderer:export-workspace`)
- 환경 내보내기: `components/Environments/Common/ExportEnvironmentModal/`,
  `utils/exporters/bruno-environment.js` 삭제, 컬렉션/워크스페이스 환경 목록의 Export 버튼 제거
  (`renderer:export-environment`)
- 마이그레이션 모달의 "Export Collection"(ZIP 백업) 버튼 제거

## 5. 네이티브 파일/폴더 선택 다이얼로그

`dialog.showOpenDialog` 기반. 위치 입력 필드는 직접 입력 방식으로 전환(읽기전용+클릭 시
다이얼로그 → 편집 가능한 텍스트 입력), Browse 링크는 삭제.

- Browse 삭제 + 직접 입력 전환: CreateCollection, ImportCollectionLocation,
  BulkImportCollectionLocation, CloneCollection, CreateWorkspace, ImportWorkspace,
  CreateApiSpec(스펙/컬렉션 위치 둘 다), CloneGitRepository, Preferences > General의
  Default Location, WelcomeModal의 Storage 단계
- "Open Collection"(로컬 폴더 다중 선택 후 스캔): `components/Sidebar/OpenCollection/` 삭제,
  사이드바 "+" 메뉴와 WelcomeModal의 "Open existing collection" 항목 제거,
  `browseDirectories` 사용처 제거 (`renderer:browse-directories`)
- "Open workspace"(네이티브 다이얼로그): 타이틀바 워크스페이스 메뉴 항목과
  `openWorkspaceDialog` 썽크 삭제 (`renderer:open-workspace-dialog`)

## 6. 창 제어 / 앱 메뉴 (데스크톱 크롬)

브라우저가 자체 제공하는 기능이라 UI 삭제.

- `components/AppTitleBar/AppMenu/` 삭제 (Open Collection, Quit, Developer Tools 토글,
  줌 인/아웃/리셋, 전체화면, About 등 데스크톱 메뉴)
- AppTitleBar의 최소화/최대화/닫기 버튼, 전체화면 상태 동기화
  (`renderer:window-*`, `main:enter/leave-full-screen`) 제거
- 줌 단축키(zoomIn/zoomOut/resetZoom)와 keyMappings의 "View" 섹션 삭제
  (`renderer:zoom-in|zoom-out|reset-zoom`)

## 7. OS 시스템 프록시 / PAC 파일 선택

서버 환경에서는 "사용자 OS의 프록시 설정"이라는 개념이 없다.

- Preferences > Proxy의 "System Proxy" 모드(`source: 'inherit'`)와
  `ProxySettings/SystemProxy/` 컴포넌트 삭제 (`renderer:get-system-proxy-variables`,
  `renderer:refresh-system-proxy`; app 슬라이스의 systemProxy 상태/액션 포함)
- PAC "File" 선택 모드(`renderer:browse-pac-file`) 삭제 — PAC은 URL 입력만 유지

## 8. 로컬 인증서 관련 설정

로컬 파일 경로를 참조하는 설정 (브라우저에서 파일 경로 접근 불가, `webUtils.getPathForFile`).

- Preferences > General의 "Use Custom CA Certificate" / "Keep Default CA Certificates" 섹션 삭제
- Preferences > General의 "Use System Browser for OAuth2 Authorization" 체크박스 삭제
  (시스템 브라우저 + bruno:// 딥링크 콜백은 데스크톱 전용)

## 9. 워크스페이스 "Close" / 컬렉션 "Connect to Git"

웹 모드에서는 워크스페이스가 git 브랜치(worktree)라서 "열고 닫는" 대상이 아니고,
모든 컬렉션이 이미 워크스페이스 브랜치로 동기화되므로 컬렉션 단위 git 연결이 불필요하다.

- 워크스페이스 홈 헤더의 ⋯ 메뉴 삭제 — Rename만 남아 이름변경 아이콘 버튼으로 대체,
  Close는 Manage Workspace의 Remove(브랜치 삭제)로 일원화.
  `components/Sidebar/CloseWorkspace` 및 e2e `tests/workspace/close-workspace-returns-to-default.spec.ts` 삭제
- Overview 컬렉션 카드 ⋯ 메뉴의 "Connect to Git" 삭제 —
  `WorkspaceOverview/CollectionsList/ConnectGitRemote` 삭제
  (Copy Git URL / Remove Git Remote는 데스크톱산 워크스페이스 호환용으로 유지)

## 삭제된 npm 의존성 (bruno-app)

- `@xterm/xterm` — Devtools 터미널 렌더링
- `@xterm/addon-fit` — 터미널 크기 맞춤

## 남겨둔 항목 / 알려진 한계

- **파일 경로 피커류** (`components/FilePickerEditor`, MultipartFormParams의 파일 파라미터,
  OAuth1 개인키 파일 선택): 요청 편집 UI 전반에 얽혀 있어 컴포넌트는 유지했다.
  웹에서는 `renderer:browse-files` 핸들러가 없어 버튼이 동작하지 않는다(콘솔 경고만 발생).
  추후 서버 업로드 방식으로 재구현하거나 제거할 후보.
- **web-ipc에 미구현 채널** 다수(쿠키 관리, OpenAPI sync 일부, git clone 등)는 "삭제 대상"이
  아니라 서버에서 구현 가능한 미구현 기능이므로 그대로 두었다.
- Electron 쪽(`packages/bruno-electron`)의 대응 핸들러 코드는 건드리지 않았다
  (앱 버전은 현재 미고려, 렌더러에서 진입점이 사라져 호출되지 않음).
- 요청 실행이 서버에서 일어나므로 사용자 localhost/사설망 API에는 도달할 수 없다
  (기능 삭제가 아니라 구조적 제약).
