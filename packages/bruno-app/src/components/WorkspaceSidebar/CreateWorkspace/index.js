import React, { useRef, useEffect, useState } from 'react';
import { useFormik } from 'formik';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import Modal from 'components/Modal';
import { createWorkspaceAction } from 'providers/ReduxStore/slices/workspaces/actions';
import { multiLineMsg } from 'utils/common/index';
import { formatIpcError } from 'utils/common/error';

const CreateWorkspace = ({ onClose }) => {
  const inputRef = useRef();
  const dispatch = useDispatch();
  const workspaces = useSelector((state) => state.workspaces.workspaces);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      workspaceName: ''
    },
    validationSchema: Yup.object({
      workspaceName: Yup.string()
        .trim()
        .min(1, 'Workspace name can\'t be empty')
        .max(255, 'Must be 255 characters or less')
        .required('Workspace name is required')
        .matches(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Only letters, digits, ".", "_" and "-" are allowed')
        .test('unique-name', 'A workspace with this name already exists', function (value) {
          if (!value) return true;

          return !workspaces.some((w) =>
            !w.isCreating && w.name && w.name.toLowerCase() === value.toLowerCase());
        })
    }),
    onSubmit: async (values) => {
      if (isSubmitting) return;

      try {
        setIsSubmitting(true);

        await dispatch(createWorkspaceAction(values.workspaceName.trim()));
        toast.success('Workspace created!');
        onClose();
      } catch (error) {
        toast.error(multiLineMsg('An error occurred while creating the workspace', formatIpcError(error)));
      } finally {
        setIsSubmitting(false);
      }
    }
  });

  useEffect(() => {
    if (inputRef && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputRef]);

  return (
    <Modal
      size="md"
      title="Create Workspace"
      description="Give your new workspace a name to get started."
      confirmText={isSubmitting ? 'Creating...' : 'Create Workspace'}
      handleConfirm={formik.handleSubmit}
      handleCancel={onClose}
      style="new"
      confirmDisabled={isSubmitting}
    >
      <div>
        <form className="bruno-form" onSubmit={formik.handleSubmit}>
          <div className="mb-4">
            <label htmlFor="workspaceName" className="block font-semibold mb-2">
              Name
            </label>
            <input
              id="workspace-name"
              type="text"
              name="workspaceName"
              ref={inputRef}
              className="block textbox w-full"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              onChange={formik.handleChange}
              value={formik.values.workspaceName || ''}
            />
            {formik.touched.workspaceName && formik.errors.workspaceName ? (
              <div className="text-red-500 text-sm mt-1">{formik.errors.workspaceName}</div>
            ) : null}
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default CreateWorkspace;
