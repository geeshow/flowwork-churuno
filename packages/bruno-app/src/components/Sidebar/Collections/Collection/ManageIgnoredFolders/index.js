import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { IconFolder } from '@tabler/icons';
import Modal from 'components/Modal';
import { setIgnoredFolders, closeTabs } from 'providers/ReduxStore/slices/collections/actions';
import { getIgnoredFolderEntries } from 'utils/collections/ignoredFolders';
import { flattenItems, isItemAFolder, findItemInCollectionByPathname, recursivelyGetAllItemUids } from 'utils/collections';
import StyledWrapper from './StyledWrapper';

// 보이는 폴더(트리)와 이미 숨겨진 항목(설정에만 남아 트리에는 없다)을 합쳐
// 컬렉션 기준 상대 경로의 중첩 트리로 만든다
const buildFolderTree = (collection) => {
  const root = { children: new Map() };
  const ensure = (relPath) => {
    let node = root;
    let path = '';
    for (const segment of relPath.split('/')) {
      path = path ? `${path}/${segment}` : segment;
      if (!node.children.has(segment)) {
        node.children.set(segment, { name: segment, rel: path, children: new Map() });
      }
      node = node.children.get(segment);
    }
  };

  flattenItems(collection?.items)
    .filter((item) => isItemAFolder(item))
    .forEach((item) => ensure(item.pathname.slice(collection.pathname.length + 1)));
  getIgnoredFolderEntries(collection).forEach(ensure);

  const toSortedArray = (node) =>
    [...node.children.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((child) => ({ ...child, children: toSortedArray(child) }));
  return toSortedArray(root);
};

const ManageIgnoredFolders = ({ collection, onClose }) => {
  const dispatch = useDispatch();
  const entries = getIgnoredFolderEntries(collection);
  const [hidden, setHidden] = useState(() => new Set(entries));
  const [saving, setSaving] = useState(false);
  const tree = buildFolderTree(collection);

  const toggle = (rel) => {
    const next = new Set(hidden);
    if (!next.delete(rel)) {
      next.add(rel);
    }
    setHidden(next);
  };

  const hasHiddenAncestor = (rel) => {
    for (let idx = rel.lastIndexOf('/'); idx > 0; idx = rel.lastIndexOf('/', idx - 1)) {
      if (hidden.has(rel.slice(0, idx))) {
        return true;
      }
    }
    return false;
  };

  const onConfirm = () => {
    // 숨긴 폴더의 하위 항목은 상위가 이미 통째로 가리므로 최상위 항목만 기록한다
    const nextEntries = [...hidden].filter((rel) => !hasHiddenAncestor(rel)).sort();

    setSaving(true);
    dispatch(setIgnoredFolders(nextEntries, collection.uid))
      .then(() => {
        nextEntries
          .filter((rel) => !entries.includes(rel))
          .forEach((rel) => {
            const item = findItemInCollectionByPathname(collection, `${collection.pathname}/${rel}`);
            if (item) {
              dispatch(closeTabs({ tabUids: [...recursivelyGetAllItemUids(item.items), item.uid] }));
            }
          });
        toast.success('Ignored folders updated');
        onClose();
      })
      .catch((error) => {
        console.error('Error updating ignored folders', error);
        toast.error(error?.message || 'Error updating ignored folders');
        setSaving(false);
      });
  };

  const renderNode = (node, depth, ancestorHidden) => {
    const selfHidden = hidden.has(node.rel);
    const isVisible = !selfHidden && !ancestorHidden;
    return (
      <React.Fragment key={node.rel}>
        <label
          className={`folder-row ${isVisible ? '' : 'hidden-folder'}`}
          style={{ paddingLeft: `${depth * 20}px` }}
        >
          <input
            type="checkbox"
            checked={isVisible}
            disabled={ancestorHidden}
            onChange={() => toggle(node.rel)}
            data-testid={`folder-visible-checkbox-${node.rel}`}
          />
          <IconFolder size={15} stroke={1.5} />
          <span className="folder-name" title={node.rel}>{node.name}</span>
        </label>
        {node.children.map((child) => renderNode(child, depth + 1, ancestorHidden || selfHidden))}
      </React.Fragment>
    );
  };

  return (
    <Modal
      size="md"
      title="Ignored Folders"
      confirmText={saving ? 'Applying…' : 'Apply'}
      handleConfirm={onConfirm}
      handleCancel={onClose}
      confirmDisabled={saving}
      style="new"
    >
      <StyledWrapper data-testid="manage-ignored-folders-modal">
        <div className="hint">
          체크를 해제한 폴더는 사이드바에서 숨겨집니다 — 파일은 디스크에 그대로 남습니다. 상위 폴더를 숨기면 하위
          폴더도 함께 숨겨집니다.
        </div>
        {tree.length ? (
          <div className="folder-tree">{tree.map((node) => renderNode(node, 0, false))}</div>
        ) : (
          <div className="hint">이 컬렉션에는 폴더가 없습니다.</div>
        )}
      </StyledWrapper>
    </Modal>
  );
};

export default ManageIgnoredFolders;
