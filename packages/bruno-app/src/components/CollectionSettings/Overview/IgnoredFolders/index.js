import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { IconEyeOff } from '@tabler/icons';
import { setIgnoredFolders, unignoreFolder } from 'providers/ReduxStore/slices/collections/actions';
import { getIgnoredFolderEntries } from 'utils/collections/ignoredFolders';
import { flattenItems, isItemAFolder } from 'utils/collections';

const relativePathOf = (item, collection) => item.pathname.slice(collection.pathname.length + 1);

const IgnoredFolders = ({ collection }) => {
  const dispatch = useDispatch();
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const entries = getIgnoredFolderEntries(collection);

  // ignored folders are absent from the tree, so the manageable set is the
  // union of visible folders and the entries already in the config
  const folderPaths = flattenItems(collection?.items)
    .filter((item) => isItemAFolder(item))
    .map((item) => relativePathOf(item, collection));
  const managePaths = [...new Set([...folderPaths, ...entries])].sort();

  const editing = selected !== null;

  if (!entries.length && !managePaths.length) {
    return null;
  }

  const startEditing = () => setSelected(new Set(entries));
  const stopEditing = () => setSelected(null);
  const toggle = (path) => {
    const next = new Set(selected);
    if (!next.delete(path)) {
      next.add(path);
    }
    setSelected(next);
  };

  const apply = (nextEntries) => {
    setSaving(true);
    dispatch(setIgnoredFolders(nextEntries, collection.uid))
      .then(() => {
        toast.success('Ignored folders updated');
        setSelected(null);
      })
      .catch((error) => {
        console.error('Error updating ignored folders', error);
        toast.error(error?.message || 'Error updating ignored folders');
      })
      .finally(() => setSaving(false));
  };

  const restore = (entry) => {
    dispatch(unignoreFolder(entry, collection.uid))
      .then(() => toast.success(`Folder "${entry}" is visible again`))
      .catch((error) => {
        console.error('Error restoring ignored folder', error);
        toast.error(error?.message || 'Error restoring ignored folder');
      });
  };

  return (
    <div className="mt-6" data-testid="ignored-folders">
      <div className="flex gap-2 items-center">
        <IconEyeOff size={18} stroke={1.5} className="flex-shrink-0" />
        <span className="font-medium">Ignored folders</span>
        {!editing && (
          <button
            type="button"
            className="text-link cursor-pointer hover:underline bg-transparent text-xs ml-auto"
            onClick={startEditing}
            data-testid="manage-ignored-folders"
          >
            Manage
          </button>
        )}
      </div>
      <div className="mt-1 text-xs opacity-70">
        {editing
          ? 'Checked folders are hidden from the sidebar — the files stay on disk.'
          : 'Hidden from the sidebar via Ignore Folder — the files are still on disk.'}
      </div>

      {editing ? (
        <>
          <ul className="mt-2 flex flex-col gap-1" data-testid="ignored-folders-editor">
            {managePaths.map((path) => (
              <li key={path}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(path)}
                    onChange={() => toggle(path)}
                    data-testid={`ignore-folder-checkbox-${path}`}
                  />
                  <span className="truncate" title={path}>{path}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-3 text-xs">
            <button
              type="button"
              className="text-link cursor-pointer hover:underline bg-transparent font-medium"
              disabled={saving}
              onClick={() => apply([...selected])}
              data-testid="apply-ignored-folders"
            >
              {saving ? 'Applying…' : 'Apply'}
            </button>
            <button
              type="button"
              className="cursor-pointer hover:underline bg-transparent opacity-70"
              disabled={saving}
              onClick={stopEditing}
            >
              Cancel
            </button>
          </div>
        </>
      ) : entries.length ? (
        <>
          <ul className="mt-2 flex flex-col gap-1">
            {entries.map((entry) => (
              <li key={entry} className="flex items-center gap-3">
                <span className="truncate" title={entry}>{entry}</span>
                <button
                  type="button"
                  className="text-link cursor-pointer hover:underline bg-transparent flex-shrink-0"
                  onClick={() => restore(entry)}
                  data-testid={`unignore-folder-${entry}`}
                >
                  Show again
                </button>
              </li>
            ))}
          </ul>
          {entries.length > 1 && (
            <button
              type="button"
              className="mt-2 text-link cursor-pointer hover:underline bg-transparent text-xs"
              disabled={saving}
              onClick={() => apply([])}
              data-testid="unignore-all-folders"
            >
              Show all again
            </button>
          )}
        </>
      ) : (
        <div className="mt-2 text-xs opacity-70">No folders are ignored.</div>
      )}
    </div>
  );
};

export default IgnoredFolders;
