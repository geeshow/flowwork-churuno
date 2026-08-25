import React from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { IconEyeOff } from '@tabler/icons';
import { unignoreFolder } from 'providers/ReduxStore/slices/collections/actions';

// ignore entries that were never folders hidden from the sidebar: package/git
// housekeeping, and this fork's workflows dir (API Chain data, not requests).
const HOUSEKEEPING = new Set(['node_modules', '.git', 'workflows']);

const IgnoredFolders = ({ collection }) => {
  const dispatch = useDispatch();
  const entries = (collection?.brunoConfig?.ignore || []).filter((entry) => !HOUSEKEEPING.has(entry));

  if (!entries.length) {
    return null;
  }

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
      </div>
      <div className="mt-1 text-xs opacity-70">
        Hidden from the sidebar via Ignore Folder — the files are still on disk.
      </div>
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
    </div>
  );
};

export default IgnoredFolders;
