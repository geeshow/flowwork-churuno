# Bruno Web Mode

Bruno(Electron 데스크톱 앱)를 브라우저에서 사용하기 위한 웹 모드입니다.
Electron 메인 프로세스가 하던 일을 두 조각으로 나눕니다:

- **브라우저 shim** (`packages/bruno-app/src/web-ipc/`) — `window.ipcRenderer`를
  대체합니다. `.bru`/`.yml` 파싱·직렬화(`@usebruno/filestore`)와 변수 보간·헤더
  병합은 전부 브라우저에서 수행합니다.
- **Python 서버** (`web-server/main.py`, FastAPI) — ① 컬렉션 파일 저장소(파일
  CRUD), ② 실제 HTTP 요청 실행(브라우저 CORS 제약 우회), ③ 빌드된 웹앱 정적
  서빙을 담당합니다.

```
브라우저 (bruno-app + web-ipc shim)
   │  /api/fs/*        파일 읽기/쓰기 (.bru/.yml 원문)
   │  /api/http/execute 해석 완료된 요청(HAR 형태) 실행
   ▼
Python 서버 (web-server/main.py) ──▶ 대상 API 서버
```

## 실행 방법

```bash
# 1. (최초 1회) 의존성 설치 + 공유 패키지 빌드
nvm use && npm i --legacy-peer-deps && npm run setup

# 2. 웹앱 번들 빌드
npm run build:web

# 3. Python 서버 실행 (기본 포트 8008)
cd web-server
pip install -r requirements.txt
python main.py
```

브라우저에서 <http://localhost:8008> 접속.

개발 중에는 정적 빌드 대신 rsbuild dev 서버를 써도 됩니다
(`npm run dev:web` → <http://localhost:3000>; shim이 자동으로
`localhost:8008`의 API를 호출합니다).

### 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `BRUNO_WEB_DATA_DIR` | `web-server/collections` | 컬렉션 루트 디렉토리 |
| `BRUNO_WEB_PORT` | `8008` | 서버 포트 |
| `BRUNO_WEB_APP_DIST` | `packages/bruno-app/dist` | 웹앱 번들 경로 |

브라우저 쪽에서는 `window.__BRUNO_WEB_SERVER_URL__`로 서버 주소를 재정의할 수
있습니다.

## Git 워크스페이스 모드 (workspace/* 브랜치)

`web-server/repo`에 git 저장소가 클론되어 있으면 서버가 **`workspace/*` 브랜치마다
git worktree**(`web-server/worktrees/<이름>`)를 만들고, 각각을 Bruno 워크스페이스로
노출합니다. 화면 좌상단 워크스페이스 선택기에서 브랜치를 전환할 수 있습니다.

- 요청을 저장하면 해당 worktree에 파일이 쓰이고, **2초 디바운스 후 자동으로
  `git commit`**(메시지 `bruno-web: auto-save`) 되며 기본으로 원격에 push까지 합니다
  (`BRUNO_WEB_GIT_PUSH=0`으로 push 비활성화).
- 작업자별로 `workspace/<이름>` 브랜치를 만들면 서버 재시작 시 worktree가 자동
  생성됩니다. 현재 저장소: <https://github.com/geeshow/flowwork-apis>
  (`workspace/kyutae`, `workspace/demo`).
- 각 워크스페이스에는 `flowwork/`(flowwork-apis 컬렉션)와 `sample-api/`(내장 mock
  샘플) 두 컬렉션이 들어 있습니다.
- 저장소가 없으면 기존처럼 `web-server/collections` 단일 루트로 동작합니다(legacy).

| 변수 | 기본값 | 설명 |
|---|---|---|
| `BRUNO_WEB_REPO_DIR` | `web-server/repo` | 클론된 git 저장소 위치 |
| `BRUNO_WEB_WORKTREES_DIR` | `web-server/worktrees` | 브랜치별 worktree 위치 |
| `BRUNO_WEB_GIT_PUSH` | `1` | 자동 커밋 후 push 여부 |

## 샘플 컬렉션 & 내장 Mock API

`web-server/collections/` 아래에 두 개의 샘플이 들어 있습니다:

- **Demo Collection** — 외부 API(jsonplaceholder) 호출 예제
- **Mock API** — Python 서버에 내장된 mock API(`/mock/*`)를 사용하는 예제.
  인터넷 없이 폴더 구조·인증·에러·지연 응답까지 테스트할 수 있습니다.
  - `Auth/` — `POST /mock/auth/login` (`bruno` / `secret` → 토큰 발급),
    `GET /mock/auth/me` (Bearer 토큰 필요, 환경변수 `{{token}}` 사용)
  - `Users/` — 목록/조회/생성/수정/삭제 CRUD
  - `Products/` — 쿼리 파라미터(`?category=electronics`) 예제
  - `Misc/` — 요청 에코, 500 응답, 2초 지연 응답

Mock API 엔드포인트는 `web-server/main.py`의 `/mock/*` 라우트에 정의되어 있으니
자유롭게 추가·수정하면 됩니다.

## 동작 방식

- 부팅 시 shim이 Electron의 부팅 캐스케이드(`main:load-preferences` →
  `main:workspace-opened` → `main:workspaces-ready` → `main:collection-opened` →
  `main:app-loaded`)를 재현합니다. 컬렉션 루트 아래의 모든 컬렉션
  (`bruno.json` 또는 `opencollection.yml` 보유 디렉토리)이 자동으로 열립니다.
- 요청 전송 시 shim이 변수 보간/헤더 병합/인증 해석까지 마친 요청을 HAR 형태로
  Python 서버에 넘기고, 서버가 httpx로 실행한 결과(상태/헤더/본문 base64/
  타임라인)를 돌려받아 기존 응답 패널에 그대로 표시합니다.
- 환경설정과 UI 상태 스냅샷은 `localStorage`에 저장됩니다.

## 지원 범위 (MVP)

지원: 컬렉션/폴더/요청 열람·생성·편집·저장·삭제, 컬렉션 환경(생성·수정·선택),
변수 보간, basic/bearer/apikey 인증, json/text/xml/form-urlencoded 본문,
응답 패널(상태·헤더·본문·타임라인), 요청 취소.

아직 미지원 (Electron 앱 전용):

- pre-request/post-response **스크립트, 테스트, assertion** (JS 샌드박스 없음)
- gRPC / WebSocket / SSE 스트리밍
- OAuth2 플로우, digest/NTLM/AWS SigV4 서명
- 쿠키 저장소, 프록시/클라이언트 인증서 설정
- 파일 업로드(multipart 파일 항목), 로컬 파일 본문
- 글로벌 환경, 다중 워크스페이스, mock 서버, AI 기능, git 연동
- 외부에서 파일을 수정했을 때의 실시간 반영(파일 워처 없음) — 새로고침 필요

## 보안 주의

이 서버는 인증이 없고 컬렉션 루트 안의 파일을 읽고 쓸 수 있으며 임의 URL로
요청을 프록시합니다. **로컬호스트 또는 신뢰된 네트워크에서만 사용하세요.**
