import React, { useEffect, useRef, useState } from 'react';

// 스텝 응답을 표로 렌더링한다.
//  - data에서 { data: ... }를 자동 언랩
//  - 언랩 결과가 배열이면: 각 원소가 행, columns가 열 (columns 비면 전체 키 자동)
//  - 객체면: 필드/값 2열 표 (columns 비면 전체 키 자동)
//  - 셀 값이 객체/배열(다차원)이면 압축 JSON으로 표시
//  - columns 항목은 점 표기(owner.name)로 중첩 값 접근

const unwrap = (body) => {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) {
    return body.data;
  }
  return body;
};

/**
 * 표의 행 목록. 반복 스텝의 응답은 회차별 응답을 모은 배열이라 원소마다 { data: … }
 * 껍질이 남아 있다 — 껍질을 벗기고, 회차마다 목록이 나왔으면 한 표로 이어 붙인다.
 */
const rowsOf = (root) =>
  root.flatMap((row) => {
    const inner = unwrap(row);
    return Array.isArray(inner) ? inner : [inner];
  });

const getPath = (obj, path) => {
  return path.split('.').reduce((o, k) => {
    if (o == null || typeof o !== 'object') return undefined;
    return o[k];
  }, obj);
};

const cell = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const keysOf = (rows) => {
  const seen = [];
  for (const r of rows) {
    if (r && typeof r === 'object') {
      for (const k of Object.keys(r)) if (!seen.includes(k)) seen.push(k);
    }
  }
  return seen;
};

const sameScroll = (a, b) =>
  a.overflow === b.overflow
  && a.fadeL === b.fadeL
  && a.fadeR === b.fadeR
  && Math.abs(a.thumbW - b.thumbW) < 0.5
  && Math.abs(a.thumbL - b.thumbL) < 0.5;

/**
 * 가로 스크롤 래퍼 — 오버레이(자동으로 사라지는) 스크롤바 대신, 항상 보이는
 * 커스텀 스크롤바(드래그 가능)를 하단에 렌더한다. 넘칠 때만 나타난다.
 */
function Scroller({ children }) {
  const wrapRef = useRef(null);
  const trackRef = useRef(null);
  const [s, setS] = useState({ overflow: false, fadeL: false, fadeR: false, thumbW: 100, thumbL: 0 });

  const update = () => {
    const el = wrapRef.current;
    if (!el) return;
    const { scrollLeft, clientWidth, scrollWidth } = el;
    const overflow = scrollWidth - clientWidth > 1;
    const next = {
      overflow,
      fadeL: scrollLeft > 2,
      fadeR: scrollLeft + clientWidth < scrollWidth - 2,
      thumbW: overflow ? Math.max(8, (clientWidth / scrollWidth) * 100) : 100,
      thumbL: overflow ? (scrollLeft / scrollWidth) * 100 : 0
    };
    setS((prev) => (sameScroll(prev, next) ? prev : next));
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);
  // 데이터/컬럼 변경 등 매 렌더 후에도 지표 재계산 (sameScroll 가드로 무한루프 방지)
  useEffect(update);

  const onThumbDown = (e) => {
    e.preventDefault();
    const el = wrapRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const startX = e.clientX;
    const startScroll = el.scrollLeft;
    const ratio = el.scrollWidth / track.clientWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    const onMove = (ev) => {
      el.scrollLeft = startScroll + (ev.clientX - startX) * ratio;
    };
    const onUp = () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onTrackDown = (e) => {
    if (e.target !== trackRef.current) return;
    const el = wrapRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const rect = track.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    el.scrollLeft = frac * el.scrollWidth - el.clientWidth / 2;
  };

  return (
    <div className={`result-scroller ${s.fadeL ? 'fade-l' : ''} ${s.fadeR ? 'fade-r' : ''}`}>
      <div className="result-table-wrap" ref={wrapRef}>
        {children}
      </div>
      {s.overflow ? (
        <div className="hscroll" ref={trackRef} onMouseDown={onTrackDown}>
          <div
            className="hscroll-thumb"
            style={{ width: `${s.thumbW}%`, left: `${s.thumbL}%` }}
            onMouseDown={onThumbDown}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ResultTable({ data, columns, labels }) {
  const root = unwrap(data);
  const head = (c) => labels?.[c] ?? c;

  if (Array.isArray(root)) {
    const rows = rowsOf(root);
    const cols = columns.length ? columns : keysOf(rows);
    if (rows.length === 0) return <p className="muted result-empty">결과 없음 (빈 배열)</p>;
    return (
      <Scroller>
        <table className="result-table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c} title={c}>
                  {head(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c}>{cell(getPath(row, c))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Scroller>
    );
  }

  if (root && typeof root === 'object') {
    const cols = columns.length ? columns : Object.keys(root);
    return (
      <Scroller>
        <table className="result-table kv">
          <tbody>
            {cols.map((c) => (
              <tr key={c}>
                <th title={c}>{head(c)}</th>
                <td>{cell(getPath(root, c))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scroller>
    );
  }

  return <p className="result-empty">{cell(root)}</p>;
}

export default ResultTable;
