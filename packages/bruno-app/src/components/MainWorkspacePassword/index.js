import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import Modal from 'components/Modal';
import { hideMainPasswordPrompt } from 'providers/ReduxStore/slices/workspaces';
import { switchWorkspace } from 'providers/ReduxStore/slices/workspaces/actions';

// 데모용 하드코딩 비밀번호 — 보안 장치가 아니라 실수로 운영본을 여는 것을
// 막는 문턱이다. 번들에 그대로 노출되는 것을 전제로 한다.
const MAIN_WORKSPACE_PASSWORD = '1234';

/**
 * main(운영) 워크스페이스 전환 비밀번호 모달. switchWorkspace가 default
 * 워크스페이스를 만나면 이 모달을 띄우고, 검증이 되면 mainUnlocked로
 * 같은 thunk를 다시 불러 실제 전환을 진행한다.
 */
const MainWorkspacePassword = () => {
  const dispatch = useDispatch();
  const inputRef = useRef();
  const workspaceUid = useSelector((state) => state.workspaces.mainPasswordPromptUid);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (workspaceUid) {
      setPassword('');
      setError(null);
      inputRef.current?.focus();
    }
  }, [workspaceUid]);

  if (!workspaceUid) {
    return null;
  }

  const close = () => dispatch(hideMainPasswordPrompt());

  const confirm = () => {
    if (password !== MAIN_WORKSPACE_PASSWORD) {
      setError('비밀번호가 올바르지 않습니다');
      return;
    }
    close();
    dispatch(switchWorkspace(workspaceUid, { mainUnlocked: true }));
    toast.success('Switched to main');
  };

  return (
    <Modal
      size="sm"
      title="main 워크스페이스 열기"
      description="main은 운영 브랜치입니다 — 변경 사항이 바로 운영에 기록됩니다."
      confirmText="열기"
      handleConfirm={confirm}
      handleCancel={close}
      style="new"
    >
      <form
        className="bruno-form"
        onSubmit={(e) => {
          e.preventDefault();
          confirm();
        }}
      >
        <label htmlFor="main-workspace-password" className="block font-semibold mb-2">
          비밀번호
        </label>
        <input
          id="main-workspace-password"
          type="password"
          ref={inputRef}
          className="block textbox w-full"
          autoComplete="off"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          data-testid="main-workspace-password-input"
        />
        {error ? <div className="text-red-500 text-sm mt-1">{error}</div> : null}
      </form>
    </Modal>
  );
};

export default MainWorkspacePassword;
