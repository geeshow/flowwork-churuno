import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconEye, IconEyeOff, IconRefresh, IconUpload, IconX } from '@tabler/icons';
import toast from 'react-hot-toast';
import serverApi from '../../../web-ipc/server-api';
import { getLocalStorageValue, setLocalStorageValue } from 'utils/common/localStorage';
import ConfirmButton from 'components/Flowwork/ConfirmButton';
import useOpenChangeLocation from './useOpenChangeLocation';
import FilterChips from './FilterChips';
import ApiDiff from './ApiDiff';
import StyledWrapper from './StyledWrapper';

const CHANGE_LABEL = { A: '추가', M: '수정', D: '삭제' };
// 요청은 메서드 배지로 이미 구분되므로 종류 라벨을 따로 붙이지 않는다
const KIND_LABEL = { folder: '폴더', collection: '컬렉션', environment: '환경' };
// 필터 칩 — 사용자는 요청을 'API'라 부른다
const CHANGE_FILTERS = [['A', '추가'], ['M', '수정'], ['D', '삭제']];
const KIND_FILTERS = [['collection', '컬렉션'], ['folder', '폴더'], ['request', 'API'], ['environment', '환경']];

// 필터는 새로고침(원복 후 새로고침 포함) 뒤에도 유지되도록 저장한다
const FILTERS_KEY = 'bruno.workspaceRelease.filters';

const readStoredFilter = (key) => {
  const stored = getLocalStorageValue(FILTERS_KEY, null, JSON.parse);
  return new Set(Array.isArray(stored?.[key]) ? stored[key] : []);
};

const toggledSet = (values, value) => {
  const next = new Set(values);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
};

/**
 * 워크스페이스 → main 반영 (웹 모드 전용).
 *
 * 이 워크스페이스 브랜치에서 작업한 요청·폴더·컬렉션 설정·환경을 main과
 * 비교해 파일 단위로 골라 반영하거나, main 버전으로 되돌리거나, 목록에서만
 * 감춘다(무시). main에 같은 위치·이름의 것이 독립적으로 이미 반영돼
 * 있으면(중복) 반영만 막고 원복·무시는 허용한다.
 */
const WorkspaceRelease = ({ workspace }) => {
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [showIgnored, setShowIgnored] = useState(false);
  const [openDiffs, setOpenDiffs] = useState(() => new Set());
  const [changeFilter, setChangeFilter] = useState(() => readStoredFilter('changes'));
  const [kindFilter, setKindFilter] = useState(() => readStoredFilter('kinds'));
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh((n) => n + 1), []);
  const openLocation = useOpenChangeLocation(workspace);

  useEffect(() => {
    let alive = true;
    setError(null);
    serverApi
      .workspacePendingChanges(workspace.name)
      .then((result) => {
        if (!alive) return;
        setPending(result);
        // 목록에서 사라진 항목의 선택과 펼친 diff는 남겨두지 않는다
        const paths = new Set(result.files.map((f) => f.path));
        setSelected((prev) => new Set([...prev].filter((p) => paths.has(p))));
        setOpenDiffs((prev) => new Set([...prev].filter((p) => paths.has(p))));
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [workspace.name, refresh]);

  const files = pending?.files ?? [];
  const ignoredCount = useMemo(() => files.filter((f) => f.ignored).length, [files]);
  // 필터 개수는 필터 적용 전(무시 여부만 반영한) 목록 기준이라야 0건인 칩을 알 수 있다
  const listed = useMemo(() => files.filter((f) => (showIgnored ? f.ignored : !f.ignored)), [files, showIgnored]);
  const visible = useMemo(
    () =>
      listed.filter(
        (f) => (changeFilter.size === 0 || changeFilter.has(f.change))
          && (kindFilter.size === 0 || kindFilter.has(f.kind))
      ),
    [listed, changeFilter, kindFilter]
  );

  const countBy = (key) =>
    listed.reduce((counts, f) => ({ ...counts, [f[key]]: (counts[f[key]] ?? 0) + 1 }), {});
  const changeCounts = useMemo(() => countBy('change'), [listed]);
  const kindCounts = useMemo(() => countBy('kind'), [listed]);

  const applyFilters = (changes, kinds) => {
    setChangeFilter(changes);
    setKindFilter(kinds);
    setLocalStorageValue(FILTERS_KEY, JSON.stringify({ changes: [...changes], kinds: [...kinds] }));
  };

  const selectedPaths = useMemo(
    () => visible.filter((f) => selected.has(f.path)).map((f) => f.path),
    [visible, selected]
  );
  const hasDuplicateSelected = useMemo(
    () => visible.some((f) => selected.has(f.path) && f.status === 'duplicate'),
    [visible, selected]
  );
  const allSelected = visible.length > 0 && visible.every((f) => selected.has(f.path));

  const toggle = (path) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(visible.map((f) => f.path)));
  };

  const toggleDiff = (path) => {
    setOpenDiffs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const switchView = () => {
    setShowIgnored((prev) => !prev);
    setSelected(new Set());
  };

  // done: 성공 시 토스트 문구, 또는 목록 아래 남길 안내(notice)
  const run = async (op, { done, keepNotice } = {}) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await op();
      if (done) toast.success(done);
      if (keepNotice) setNotice(keepNotice);
      setSelected(new Set());
      reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const releaseLabel = hasDuplicateSelected
    ? '중복 항목이 선택되어 있어 반영할 수 없습니다'
    : 'main에 반영하면 flowwork에서 바로 사용할 수 있습니다';

  return (
    <StyledWrapper data-testid="workspace-release">
      <div className="release-head">
        {visible.length > 0 && (
          <input type="checkbox" checked={allSelected} onChange={toggleAll} title="전체 선택" />
        )}
        <span className="release-desc">
          {showIgnored
            ? '무시한 항목입니다. 작업 내용은 그대로 있고 목록에서만 감춰져 있습니다.'
            : '작업한 요청·문서·환경을 선택해 main에 반영합니다. 반영된 API는 flowwork에서 바로 사용할 수 있습니다.'}
        </span>
        {(ignoredCount > 0 || showIgnored) && (
          <button className="link-btn" onClick={switchView}>
            {showIgnored ? '변경 목록 보기' : `무시한 항목 ${ignoredCount}개`}
          </button>
        )}
        <button className="refresh" onClick={reload} title="새로고침">
          <IconRefresh size={16} strokeWidth={1.5} />
        </button>
      </div>

      {listed.length > 0 && (
        <div className="release-filters">
          <FilterChips
            options={CHANGE_FILTERS}
            counts={changeCounts}
            selected={changeFilter}
            onToggle={(value) => applyFilters(toggledSet(changeFilter, value), kindFilter)}
            onClear={() => applyFilters(new Set(), kindFilter)}
          />
          <span className="filter-divider" />
          <FilterChips
            options={KIND_FILTERS}
            counts={kindCounts}
            selected={kindFilter}
            onToggle={(value) => applyFilters(changeFilter, toggledSet(kindFilter, value))}
            onClear={() => applyFilters(changeFilter, new Set())}
          />
        </div>
      )}

      {error && <div className="release-error">{error}</div>}
      {notice && (
        <div className="release-notice">
          {notice}
          <button className="link-btn" onClick={() => window.location.reload()}>
            새로고침
          </button>
        </div>
      )}

      {pending === null ? (
        <div className="release-loading">불러오는 중…</div>
      ) : visible.length === 0 ? (
        <div className="release-empty">
          {listed.length > 0
            ? '필터에 맞는 항목이 없습니다.'
            : showIgnored
              ? '무시한 항목이 없습니다.'
              : 'main에 반영할 변경이 없습니다. 컬렉션에서 요청·문서·환경을 만들거나 수정하면 여기에 나타납니다.'}
        </div>
      ) : (
        visible.map((file) => (
          <React.Fragment key={file.path}>
            <div className={`release-row ${file.status === 'duplicate' ? 'duplicate' : ''}`}>
              <input type="checkbox" checked={selected.has(file.path)} onChange={() => toggle(file.path)} />
              <span className={`change-badge change-${file.change.toLowerCase()}`}>
                {CHANGE_LABEL[file.change] ?? file.change}
              </span>
              {file.method ? (
                <span className={`api-method method-${file.method.toLowerCase()}`}>{file.method}</span>
              ) : (
                <span className="api-method kind-label">{KIND_LABEL[file.kind] ?? ''}</span>
              )}
              <button
                className="row-open"
                title={file.change === 'D' ? file.path : `${file.path} — 눌러서 열기`}
                onClick={() => openLocation(file)}
              >
                <span className="api-name">{file.name}</span>
                <span className="api-directory">{file.directory}</span>
              </button>
              {file.status === 'duplicate' && (
                <span className="duplicate-hint" title="main에 같은 위치·이름의 항목이 이미 있습니다">
                  중복 — 이름이나 위치를 바꿔 주세요
                </span>
              )}
              <button
                className={`diff-btn ${openDiffs.has(file.path) ? 'open' : ''}`}
                title={`${pending?.main_branch ?? 'main'}과의 차이 보기`}
                onClick={() => toggleDiff(file.path)}
              >
                diff
              </button>
            </div>
            {openDiffs.has(file.path) && (
              <ApiDiff workspaceName={workspace.name} path={file.path} mainBranch={pending?.main_branch ?? 'main'} />
            )}
          </React.Fragment>
        ))
      )}

      {visible.length > 0 && (
        <div className="release-footer">
          <span className="selected-count">
            {selectedPaths.length > 0 ? `${selectedPaths.length}건 선택됨` : '반영할 항목을 선택하세요'}
          </span>
          {showIgnored ? (
            <button
              className="secondary-btn"
              disabled={busy || selectedPaths.length === 0}
              onClick={() =>
                run(() => serverApi.workspaceIgnoreChanges(workspace.name, selectedPaths, false), {
                  done: `${selectedPaths.length}건을 변경 목록으로 되돌렸습니다`
                })}
            >
              <IconEye size={14} strokeWidth={1.5} />
              무시 해제
            </button>
          ) : (
            <>
              <button
                className="secondary-btn"
                disabled={busy || selectedPaths.length === 0}
                title="작업 내용은 그대로 두고 목록에서만 감춥니다"
                onClick={() =>
                  run(() => serverApi.workspaceIgnoreChanges(workspace.name, selectedPaths, true), {
                    done: `${selectedPaths.length}건을 무시했습니다 — 작업 내용은 그대로 있습니다`
                  })}
              >
                <IconEyeOff size={14} strokeWidth={1.5} />
                무시
              </button>
              <ConfirmButton
                className="secondary-btn danger"
                disabled={busy || selectedPaths.length === 0}
                confirmLabel={`${selectedPaths.length}건 main 원복 — 확정`}
                title="이 워크스페이스의 작업 내용을 버리고 main 버전으로 되돌립니다"
                onConfirm={() =>
                  run(() => serverApi.workspaceRevertChanges(workspace.name, selectedPaths), {
                    keepNotice: 'main 버전으로 되돌렸습니다. 열려 있는 요청 화면에 반영하려면 새로고침하세요.'
                  })}
              >
                <IconX size={14} strokeWidth={1.5} />
                main 원복
              </ConfirmButton>
              <ConfirmButton
                className="release-submit"
                disabled={busy || selectedPaths.length === 0 || hasDuplicateSelected}
                confirmLabel={`${selectedPaths.length}건 main 반영 — 확정`}
                title={releaseLabel}
                onConfirm={() =>
                  run(() => serverApi.workspaceReleaseChanges(workspace.name, selectedPaths), {
                    done: `${selectedPaths.length}건을 main에 반영했습니다 — flowwork에서 바로 사용할 수 있습니다`
                  })}
              >
                <IconUpload size={14} strokeWidth={1.5} />
                main 반영
              </ConfirmButton>
            </>
          )}
        </div>
      )}
    </StyledWrapper>
  );
};

export default WorkspaceRelease;
