// API_COMBO 옵션 캐시 — 완료 결과 캐시 + in-flight promise 공유로 중복 호출 방지.
// React와 무관한 순수 로직이라 단독 테스트 가능. Provider가 이 클래스를 감싼다.

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export class ComboCache {
  constructor(ttlMs = DEFAULT_TTL_MS, now = Date.now) {
    this.ttl = ttlMs;
    this.done = new Map();
    this.inFlight = new Map();
    this.now = now;
  }

  async get(key, loader) {
    const cached = this.done.get(key);
    if (cached && this.now() - cached.fetchedAt < this.ttl) return cached.data;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const promise = loader()
      .then((data) => {
        this.done.set(key, { data, fetchedAt: this.now() });
        return data;
      })
      .finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, promise);
    return promise;
  }
}

/** 응답 body에서 행 배열을 뽑아낸다 (배열 자체 / {data:[...]} 모두 허용). */
export function extractRows(body) {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    const data = body.data;
    if (Array.isArray(data)) return data;
  }
  return [];
}

/** 응답 body에서 단일 객체(의존 조회 결과)를 뽑아낸다. */
export function extractOne(body) {
  if (Array.isArray(body)) return body[0] ?? null;
  if (body && typeof body === 'object') {
    const data = body.data;
    if (Array.isArray(data)) return data[0] ?? null;
    if (data && typeof data === 'object') return data;
    // data 키가 있는데 null/원시값이면 "결과 없음" — body 자체를 결과로 오인하지 않는다
    if ('data' in body) return null;
    return body;
  }
  return null;
}
