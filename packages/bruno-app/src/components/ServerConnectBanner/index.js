import React, { useState } from 'react';
import Portal from 'components/Portal';
import { setServerBaseUrl } from '../../web-ipc/server-api';

/**
 * Shown when the app booted without reaching its execution server — a static
 * deployment (GitHub Pages) or web-server not running. The proxy / AI server
 * can live anywhere, so the reader types its address here; it is kept for this
 * browser and the page reloads against it.
 */
const ServerConnectBanner = ({ serverUrl, onDismiss }) => {
  const [draft, setDraft] = useState(serverUrl);

  const connect = (event) => {
    event.preventDefault();
    if (draft.trim()) {
      setServerBaseUrl(draft);
    }
  };

  return (
    <Portal>
      <div
        className="fixed bottom-0 left-0 right-0 z-10 bg-amber-100 border border-amber-400 text-amber-700 px-4 py-3"
        role="alert"
        data-testid="server-unreachable-banner"
      >
        <strong className="font-bold">실행 서버에 연결할 수 없습니다</strong>
        <div>
          {serverUrl} 에서 응답이 없습니다. 이 화면은 둘러볼 수 있지만 API 호출·저장은 되지 않습니다.
          실행 서버(<code>web-server</code>)를 띄운 주소를 입력하면 그 서버로 다시 엽니다.
        </div>
        <form className="flex items-center gap-2 mt-2" onSubmit={connect}>
          <label htmlFor="server-url-input" className="whitespace-nowrap">서버 주소</label>
          <input
            id="server-url-input"
            type="url"
            className="flex-1 max-w-xl px-2 py-1 border border-amber-400 rounded bg-white text-gray-900"
            placeholder="http://localhost:8008"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoComplete="off"
            spellCheck="false"
            data-testid="server-url-input"
          />
          <button type="submit" className="px-3 py-1 rounded bg-amber-600 text-white" data-testid="server-url-connect">
            연결
          </button>
        </form>
        <button type="button" className="absolute right-2 top-0 text-xl" onClick={onDismiss} aria-label="닫기">
          &times;
        </button>
      </div>
    </Portal>
  );
};

export default ServerConnectBanner;
