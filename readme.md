# Flowwork

**API 컬렉션을 엮어 업무 흐름으로.**

Flowwork는 두 개의 앱이 하나의 Git 저장소 위에서 돌아가는 웹 기반 API 플랫폼입니다.

- **Bruno** — 개발자가 브라우저에서 API 요청을 만들고, 호출하고, 문서와 함께 저장합니다.
- **API Chain** — 실무자가 그 API들을 순서대로 엮은 *체인*을 실행하고 결과를 공유합니다.

둘 다 같은 저장소의 같은 브랜치 전략을 쓰기 때문에, 모든 변경이 기록되고 검토를 거쳐 운영에 반영됩니다.
설치 없이 브라우저만 있으면 되고, 팀원은 링크 하나로 같은 화면을 엽니다.

> 이 프로젝트는 오픈소스 API 클라이언트 [Bruno](https://github.com/usebruno/bruno)(MIT)의 포크입니다.
> Electron 데스크톱 앱을 브라우저 + Python 실행 서버 구조로 옮기고, 그 위에 API Chain을 얹었습니다.
> 원본 Bruno의 안내문은 [`docs/readme/`](docs/readme/)에 있습니다.

---

## 소개

```
 ┌──────────────── Flowwork (브라우저) ────────────────┐
 │   Bruno                      API Chain             │
 │   API 요청 만들기 · 호출 ──▶  카탈로그 · 체인 작성 · 실행  │
 └───────────────┬──────────────────────┬─────────────┘
                 │ /api/fs  /api/http   │ /api/flowwork  /api/ai
 ┌───────────────▼──────────────────────▼─────────────┐
 │  Python 실행 서버 (FastAPI)                          │
 │  파일 CRUD · HTTP 실행 · Git worktree · AI 브리지       │
 └───────────────┬────────────────────────────────────┘
                 ▼
      Git 저장소  main(운영) · develop(편집) · workspace/*(개인)
```

**함께 쓰면 이렇게 흐릅니다**

1. Bruno에서 API 요청을 만들고 **작업 브랜치(workspace/내이름)** 에 저장 — 저장은 자동으로 커밋됩니다.
2. 검토한 요청만 골라 **main에 반영**합니다.
3. API Chain이 main의 컬렉션(`.bru`)을 **카탈로그**로 읽습니다 — 따로 등록할 것이 없습니다.
4. 편집 모드에서 체인을 작성하고, 작업 단위로 **운영 반영**하면 실무자가 실행하고 결과를 링크로 공유합니다.

---

## 기능

### API Chain

| 기능 | 설명 |
|---|---|
| **API 컬렉션 기반 호출 관계** | Bruno 컬렉션의 요청이 그대로 API 카탈로그가 됩니다. 카탈로그에서 API를 골라 스텝으로 쌓고, 이전 스텝 응답·환경변수·사용자 입력·고정값을 다음 요청의 `{{변수}}`에 매핑합니다. 흐름도(Flowmap)에서 값이 어디서 와서 어디로 가는지 한눈에 봅니다. |
| **AI로 자동 체인 생성** | 하고 싶은 업무를 말로 설명하면 AI가 카탈로그에서 관련 API를 추리고(relevance) 계획(plan)을 세워 입력값·스텝 초안을 한 번에 제안합니다(마법사). 부족한 정보는 되물어 채우는 대화형 제안도 있고, 긴 생성은 중간에 끊을 수 있습니다. |
| **Git 기반 작업 관리** | 체인은 파일(`workflows/<도메인>/<업무>/<id>.json`)로 저장되고 모든 변경이 Git에 기록됩니다. 사용자는 "변경"과 "운영 반영" 두 단계만 봅니다 — 편집 공간에서 저장하면 즉시 기록, 변경 목록에서 작업 단위로 골라 main에 반영. 검토 없이 운영이 바뀌지 않고 언제든 운영 버전으로 되돌릴 수 있습니다. |
| 도메인 › 업무 › 체인 | 업무(폴더) 단위로 체인을 정리하고, 업무 이름 변경·이동·복제·삭제를 지원합니다. 도메인별 색상으로 구분합니다. |
| 반복 블록 · 조건 분기 · 체인 연결 | 목록의 항목마다 같은 스텝을 실행하는 반복, 응답 값에 따른 분기, 다른 체인을 스텝으로 호출하는 연결업무(순환 참조 감지). |
| 실행 이력 · 공유 링크 | 단계별 성공/실패와 응답을 남기고 `#/flowwork/executions/<id>` 링크로 공유합니다. 실행 중 추가 입력(중간 입력)도 지원합니다. |
| 업무별 Docs | 마크다운 문서를 운영 화면에서도 바로 편집합니다(문서는 운영에 직접 기록). |
| 원본 요청으로 이동 | 스텝에서 Bruno의 원본 요청을 새 창으로 엽니다 — 작성 중인 내용을 잃지 않습니다. |

### Bruno (웹)

| 기능 | 설명 |
|---|---|
| **Web 기반 API 호출** | 설치 없이 브라우저에서 요청을 보내고 응답을 확인합니다. 파라미터·헤더·바디(json/text/xml/form)·환경변수·변수 보간·basic/bearer/apikey 인증, 응답 패널(상태·헤더·본문·타임라인), 요청 취소. `.bru`/`.yml` 파싱과 직렬화는 브라우저에서 처리하고, 서버는 CORS 없이 실제 HTTP 호출만 대신합니다. |
| **Git branch 전략으로 환경 분리·작업 공유** | 워크스페이스가 곧 브랜치입니다. `main`은 읽기 전용 운영본, 각자의 `workspace/<이름>` 브랜치에서 요청·문서·환경을 고치면 2초 디바운스로 자동 커밋·푸시됩니다. 변경 목록에서 골라 main에 반영하고, 요청·폴더·컬렉션마다 `#/ws/...` 공유 링크가 있습니다. |
| AI 채팅 | 문서·스크립트 작성과 요청 수정을 돕는 사이드바(이 PC의 `claude` CLI를 브리지로 사용). |
| API Spec 패널 | OpenAPI/Swagger 문서를 보며 바로 호출합니다. |
| 가져오기 | Postman · Insomnia · OpenAPI 컬렉션을 가져옵니다. |
| Devtools | 콘솔·네트워크 로그로 요청을 추적합니다. |
| 내장 Mock API | 인터넷 없이 인증·CRUD·에러·지연 응답을 테스트할 수 있는 `/mock/*` 엔드포인트와 샘플 컬렉션. |

### 제품 홈

타이틀바의 **Flowwork** 를 누르면 두 앱을 소개하는 홈(`#/home`)이 열리고, 가운데 **API Chain / Bruno** 스위처로 앱을 오갑니다.
설정은 두 앱이 함께 쓰는 페이지 오버레이입니다.

---

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프론트엔드 | React 19 · Redux Toolkit · styled-components(테마) + Tailwind(레이아웃) · CodeMirror 5 · @tabler/icons |
| 데스크톱(원본 Bruno, **레거시**) | Electron 43 · electron-builder 26 — 웹 모드에서 사용하지 않아 기본 `npm test`·CI·Dependabot에서 제외. 필요 시 `npm run test:electron` |
| 번들러 | Rsbuild 1 (Rspack) · Babel 8 (React Compiler 플러그인) |
| 웹 모드 shim | `packages/bruno-app/src/web-ipc/` — Electron의 `ipcRenderer`를 브라우저에서 대체, 부팅 캐스케이드 재현 |
| 공유 패키지 | `@usebruno/common` · `requests` · `filestore`(`.bru`/`.yml`) · `converters` · `query` · `schema-types` · `graphql-docs` — rollup 4로 빌드 |
| 백엔드 | Python 3.12 · FastAPI · uvicorn · httpx · PyYAML |
| 저장소/협업 | Git worktree 기반 워크스페이스(`workspace/*`), 편집 브랜치(`develop`), 파일 단위 체리픽으로 운영 반영 |
| AI | `claude` CLI를 Bearer 토큰 REST(`/api/ai/status|generate|stream`)로 노출하는 로컬 브리지 — provider 중립 API |
| 테스트 | Jest 30 (단위, `npm test`) · ESLint 9 · Playwright(기존 E2E는 Electron 기반이라 레거시 — 웹용 E2E는 남은 작업) |
| 런타임 | Node 22.12 (`.nvmrc`) · Python 3.12 |

### 저장소 구조

```
packages/
  bruno-app/            React 앱 (Bruno + API Chain + 제품 홈)
    src/components/Flowwork/   API Chain — editor/ · engine/ · ai/ · Edit/ · WorkflowRunner/ …
    src/components/ProductHome/ 제품 홈
    src/web-ipc/               브라우저 shim (boot · collections · network · ai)
  bruno-electron/       데스크톱 앱 (원본 Bruno) — 레거시, 기본 테스트·CI 제외
  bruno-common|requests|filestore|converters|query|schema-types|graphql-docs|js|cli …
web-server/
  main.py               파일 API · HTTP 실행 · 정적 서빙 · Mock API
  flowwork.py           /api/flowwork/* — 카탈로그 · 업무 · 체인 · 실행 · 편집
  gitops.py             편집 브랜치 worktree · 변경 목록 · 운영 반영(체리픽)
  api_release.py        Bruno 워크스페이스 → main 반영
  ai.py                 AI 브리지
tests/, playwright/     Electron 기반 E2E — 레거시 (수동 실행만)
```

---

## 시작하기

```bash
# 1. 의존성 설치 + 공유 패키지 빌드 (최초 1회)
nvm use && npm i --legacy-peer-deps && npm run setup

# 2. 웹앱 번들 빌드
npm run build:web

# 3. Python 서버 (기본 8008)
cd web-server
pip install -r requirements.txt
python main.py
```

브라우저에서 <http://localhost:8008> 을 엽니다.
개발 중에는 `npm run dev:web`(rsbuild dev, <http://localhost:3000>)을 쓰면 shim이 `localhost:8008`의 API를 호출합니다.

**GitHub Pages** — <https://geeshow.github.io/flowwork-churuno/> 에 `main`의 웹 번들이 자동 배포됩니다(`.github/workflows/pages.yml`).
정적 호스팅이라 실행 서버는 포함되지 않습니다: 배포된 앱은 **보는 사람의 로컬 `web-server`(http://localhost:8008)** 를 API로 쓰고,
서버가 없으면 제품 소개 화면과 안내 배너만 보여 줍니다. 다른 서버를 쓰려면 빌드 시 `BRUNO_WEB_SERVER_URL`을 바꾸거나
페이지에서 `window.__BRUNO_WEB_SERVER_URL__`을 지정합니다.

`web-server/repo`에 API 컬렉션 저장소를 클론해 두면 `workspace/*` 브랜치마다 워크스페이스가 생깁니다.
환경 변수(`BRUNO_WEB_*`)와 Git 워크스페이스·편집 브랜치 동작은 [`web-server/README.md`](web-server/README.md)에 정리돼 있습니다.

```bash
# 단위 테스트 — 워크스페이스·스펙 단위로
npm test --workspace=packages/bruno-app -- src/components/Flowwork
```

---

## 남은 작업

**웹 모드에서 아직 빠진 Bruno 기능** (Electron 전용으로 남아 있음)

- [ ] pre-request / post-response **스크립트, 테스트, assertion** — 브라우저용 JS 샌드박스 필요
- [ ] gRPC · WebSocket · SSE 스트리밍
- [ ] OAuth2 인증 플로우, digest / NTLM / AWS SigV4 서명
- [ ] 쿠키 저장소, 프록시 · 클라이언트 인증서 설정 (웹 설정 화면에서는 제거됨)
- [ ] multipart 파일 업로드, 로컬 파일 본문
- [ ] 외부에서 파일을 고쳤을 때의 실시간 반영(파일 워처) — 지금은 새로고침

**API Chain**

- [ ] Playwright E2E 테스트 — 현재 엔진·AI 모듈 단위 테스트만 있음 (`tests/`에 체인 시나리오 없음)
- [ ] 실행 스케줄링 / 외부 트리거(웹훅)로 체인 실행
- [ ] 실행 결과 알림·내보내기(CSV 등)
- [ ] 체인 버전 비교(운영 vs 편집) 화면의 시각적 diff

**플랫폼 · 운영**

- [ ] **인증·권한** — 실행 서버에 인증이 없고 임의 URL로 프록시하므로 현재는 로컬/신뢰 네트워크 전용
- [ ] AI 브리지를 로컬 `claude` CLI에서 원격 AI 서비스로 교체 (API는 provider 중립으로 설계됨)
- [ ] 배포 패키징(Docker) 및 운영 가이드
- [ ] Electron 패키지·Electron E2E 제거 — 웹용 Playwright E2E가 갖춰지면 `packages/bruno-electron`, `tests/`, `playwright/`를 지운다 (지금은 레거시로 남기고 기본 실행에서만 제외)

---

## 라이선스

[MIT](license.md) — 원본 Bruno와 동일합니다.
