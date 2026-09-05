/**
 * 컬렉션 트리(서버 /api/fs/collection 응답 원본)의 IndexedDB 사본.
 *
 * 새로고침하면 브라우저 메모리의 트리는 사라지지만 이 사본은 남는다. 마운트 시
 * 저장해 둔 etag를 서버에 보내면 서버는 stat 지문만 대조해 변경이 없을 때
 * notModified로 답하고, 그 경우 3MB급 트리 전송·파싱 없이 이 사본으로 마운트한다.
 * IndexedDB를 못 쓰는 환경(프라이빗 모드 등)에서는 조용히 캐시 없이 동작한다.
 */
const DB_NAME = 'bruno-web';
const STORE_NAME = 'collection-trees';

// 버전을 고정하지 않는다: DB가 이미 다른(또는 빈) 버전으로 존재해도 열리고,
// 스토어가 없으면 버전을 하나 올려 만들어 스스로 복구한다.
const openDb = () =>
  new Promise((resolve, reject) => {
    const open = (version) => {
      const request = version ? window.indexedDB.open(DB_NAME, version) : window.indexedDB.open(DB_NAME);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (db.objectStoreNames.contains(STORE_NAME)) return resolve(db);
        const nextVersion = db.version + 1;
        db.close();
        open(nextVersion);
      };
      request.onerror = () => reject(request.error);
    };
    open();
  });

const withStore = async (mode, run) => {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = run(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
};

export const readCachedTree = async (pathname) => {
  try {
    return (await withStore('readonly', (store) => store.get(pathname))) || null;
  } catch (_error) {
    return null;
  }
};

export const writeCachedTree = (pathname, etag, tree) => {
  withStore('readwrite', (store) => store.put({ etag, tree }, pathname)).catch(() => {});
};
