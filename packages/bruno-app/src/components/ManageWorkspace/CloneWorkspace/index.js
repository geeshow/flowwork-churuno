import React, { useEffect, useRef, useState } from 'react';
import Portal from 'components/Portal/index';
import Modal from 'components/Modal/index';
import toast from 'react-hot-toast';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useDispatch, useSelector } from 'react-redux';
import { cloneWorkspaceAction } from 'providers/ReduxStore/slices/workspaces/actions';

const CloneWorkspace = ({ onClose, workspace }) => {
  const dispatch = useDispatch();
  const { workspaces } = useSelector((state) => state.workspaces);
  const inputRef = useRef();
  const [isCloning, setIsCloning] = useState(false);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: `${workspace.name}-copy`
    },
    validationSchema: Yup.object({
      name: Yup.string()
        .trim()
        .min(1, 'must be at least 1 character')
        .max(255, 'must be 255 characters or less')
        .required('name is required')
        .matches(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Only letters, digits, ".", "_" and "-" are allowed')
        .test('unique-name', 'A workspace with this name already exists', function (value) {
          if (!value) return true;
          return !workspaces.some((w) => w.name && w.name.toLowerCase() === value.toLowerCase());
        })
    }),
    onSubmit: async (values) => {
      if (isCloning) return;

      try {
        setIsCloning(true);
        await dispatch(cloneWorkspaceAction(workspace.uid, values.name.trim()));
        toast.success('Workspace duplicated!');
        onClose();
      } catch (error) {
        toast.error(error?.message || 'An error occurred while duplicating the workspace');
        setIsCloning(false);
      }
    }
  });

  useEffect(() => {
    if (inputRef && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [inputRef]);

  return (
    <Portal>
      <Modal
        size="md"
        title={`Duplicate ${workspace.name}`}
        confirmText={isCloning ? 'Duplicating...' : 'Duplicate'}
        handleConfirm={formik.handleSubmit}
        handleCancel={onClose}
        confirmDisabled={isCloning}
      >
        <form className="bruno-form" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label htmlFor="workspace-name" className="block font-semibold">
              New Workspace Name
            </label>
            <input
              id="workspace-name"
              type="text"
              name="name"
              ref={inputRef}
              className="block textbox mt-2 w-full"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              onChange={formik.handleChange}
              value={formik.values.name || ''}
            />
            {formik.touched.name && formik.errors.name ? (
              <div className="text-red-500">{formik.errors.name}</div>
            ) : null}
          </div>
          <div className="text-xs opacity-70 leading-5 mt-3">
            <span className="font-semibold">{workspace.branch || workspace.name}</span> 브랜치를 기준으로 새 브랜치{' '}
            <code className="font-semibold">workspace/{formik.values.name.trim() || '<이름>'}</code>
            이(가) 생성됩니다 — 현재 컬렉션과 워크플로우를 그대로 가져갑니다.
          </div>
        </form>
      </Modal>
    </Portal>
  );
};

export default CloneWorkspace;
