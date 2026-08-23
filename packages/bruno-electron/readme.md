# bruno-electron

> **레거시 — 웹 모드 제품(Flowwork)에서는 사용하지 않습니다.**
> 원본 Bruno의 데스크톱(Electron) 메인 프로세스입니다. 웹 모드는 `packages/bruno-app/src/web-ipc/`(브라우저 shim)와
> `web-server/`(FastAPI)가 이 역할을 대신하며, 이 패키지의 코드는 런타임에 참조되지 않습니다.
> 그래서 기본 `npm test`·CI 유닛 테스트·Dependabot 업데이트에서 제외돼 있고, 유지보수하지 않습니다.
> 필요할 때만 직접 돌립니다:
>
> ```bash
> npm run test:electron    # 이 패키지의 Jest 단위 테스트
> npm run dev              # Electron + React 개발 실행 (원본 Bruno 방식)
> ```

```bash
# electron dev
npm start

# generate pfx file for signing windows build
openssl pkcs12 -export -inkey sectigo.key -in sectigo.pem -out sectigo.pfx
```
