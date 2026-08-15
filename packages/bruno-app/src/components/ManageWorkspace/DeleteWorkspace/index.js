import React, { useState } from 'react';
import Portal from 'components/Portal/index';
import Modal from 'components/Modal/index';
import toast from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { IconFolder } from '@tabler/icons';
import { closeWorkspaceAction } from 'providers/ReduxStore/slices/workspaces/actions';

const DeleteWorkspace = ({ onClose, workspace }) => {
  const dispatch = useDispatch();
  const [isDeleting, setIsDeleting] = useState(false);

  const onConfirm = async () => {
    if (isDeleting) return;

    try {
      setIsDeleting(true);
      await dispatch(closeWorkspaceAction(workspace.uid));
      onClose();
    } catch (error) {
      toast.error(error?.message || 'An error occurred while removing the workspace');
      setIsDeleting(false);
    }
  };

  return (
    <Portal>
      <Modal
        size="sm"
        title="Remove Workspace"
        confirmText={isDeleting ? 'Removing...' : 'Remove'}
        handleConfirm={onConfirm}
        handleCancel={onClose}
        confirmDisabled={isDeleting}
        confirmButtonColor="danger"
      >
        <div className="flex items-center">
          <IconFolder size={18} strokeWidth={1.5} />
          <span className="ml-2 mr-4 font-semibold">{workspace?.name}</span>
          {workspace?.branch && <code className="text-xs opacity-70">{workspace.branch}</code>}
        </div>
        {workspace?.pathname && (
          <div className="break-words text-xs mt-1">{workspace.pathname}</div>
        )}
        <div className="mt-4">
          <span className="font-semibold">{workspace?.name}</span> 워크스페이스를 삭제할까요?
        </div>
        <div className="mt-4 text-red-500">
          브랜치 <code className="font-semibold">{workspace?.branch || workspace?.name}</code>이(가) 로컬과
          원격(origin)에서 모두 삭제됩니다. 컬렉션과 워크플로우도 함께 사라지며 되돌릴 수 없습니다.
        </div>
      </Modal>
    </Portal>
  );
};

export default DeleteWorkspace;
