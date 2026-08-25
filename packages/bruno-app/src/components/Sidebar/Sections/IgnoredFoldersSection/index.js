import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { IconEye, IconEyeOff } from '@tabler/icons';

import { unignoreFolder } from 'providers/ReduxStore/slices/collections/actions';
import { getIgnoredFolderEntries } from 'utils/collections/ignoredFolders';
import SidebarSection from 'components/Sidebar/SidebarSection';
import ActionIcon from 'ui/ActionIcon';

/**
 * Folders hidden via the sidebar's Ignore Folder, listed per collection so
 * they can be brought back without digging into collection settings. The
 * files never left the disk — restoring just drops the entry from the
 * collection config and remounts.
 */
const IgnoredFoldersSection = () => {
  const dispatch = useDispatch();
  const collections = useSelector((state) => state.collections.collections);

  const groups = (collections || [])
    .map((collection) => ({ collection, entries: getIgnoredFolderEntries(collection) }))
    .filter(({ entries }) => entries.length);

  const restore = (collection, entry) => {
    dispatch(unignoreFolder(entry, collection.uid))
      .then(() => toast.success(`Folder "${entry}" is visible again`))
      .catch((error) => {
        console.error('Error restoring ignored folder', error);
        toast.error(error?.message || 'Error restoring ignored folder');
      });
  };

  return (
    <SidebarSection
      id="ignored-folders"
      title="Ignored folders"
      icon={IconEyeOff}
      className="ignored-folders-section"
    >
      {groups.length ? (
        <div className="flex flex-col py-1" data-testid="ignored-folders-section">
          {groups.map(({ collection, entries }) => (
            <div key={collection.uid}>
              {groups.length > 1 && (
                <div className="px-2 pt-1 text-xs font-medium opacity-70 truncate" title={collection.name}>
                  {collection.name}
                </div>
              )}
              {entries.map((entry) => (
                <div key={entry} className="flex items-center gap-1 pl-3 pr-2 py-0.5 text-sm">
                  <span className="truncate flex-1" title={entry}>{entry}</span>
                  <ActionIcon
                    size="sm"
                    label={`Show folder ${entry} again`}
                    onClick={() => restore(collection, entry)}
                    data-testid={`sidebar-unignore-folder-${entry}`}
                  >
                    <IconEye size={14} stroke={1.5} aria-hidden="true" />
                  </ActionIcon>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-center opacity-60 py-4">No ignored folders.</div>
      )}
    </SidebarSection>
  );
};

export default IgnoredFoldersSection;
