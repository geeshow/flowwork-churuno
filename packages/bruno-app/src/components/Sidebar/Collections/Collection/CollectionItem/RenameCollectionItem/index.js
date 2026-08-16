import React, { useRef, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import Modal from 'components/Modal';
import { isItemAFolder } from 'utils/tabs';
import useRenameCollectionItem from 'hooks/useRenameCollectionItem';
import toast from 'react-hot-toast';
import Portal from 'components/Portal';
import Button from 'ui/Button';

const RenameCollectionItem = ({ collectionUid, item, onClose }) => {
  const isFolder = isItemAFolder(item);
  const inputRef = useRef();
  const renameCollectionItem = useRenameCollectionItem(collectionUid, item);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: item?.name
    },
    validationSchema: Yup.object({
      name: Yup.string()
        .min(1, 'must be at least 1 character')
        .max(255, 'must be 255 characters or less')
        .required('name is required')
    }),
    onSubmit: async (values) => {
      try {
        await renameCollectionItem(values.name);
        onClose();
      } catch (error) {
        toast.error(error.message || 'An error occurred while renaming');
      }
    }
  });

  useEffect(() => {
    if (inputRef && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputRef]);

  return (
    <Portal>
      <Modal
        size="md"
        title={`Rename ${isFolder ? 'Folder' : 'Request'}`}
        handleCancel={onClose}
        hideFooter
      >
        <form className="bruno-form" onSubmit={formik.handleSubmit}>
          <div className="flex flex-col mt-2">
            <label htmlFor="name" className="block font-medium">
              {isFolder ? 'Folder' : 'Request'} Name
            </label>
            <input
              id="collection-item-name"
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
            {formik.touched.name && formik.errors.name ? <div className="text-red-500">{formik.errors.name}</div> : null}
          </div>

          <div className="flex justify-end items-center mt-8 bruno-modal-footer">
            <Button type="button" color="secondary" variant="ghost" onClick={onClose} className="mr-2">
              Cancel
            </Button>
            <Button type="submit" data-testid="rename-item-button">
              Rename
            </Button>
          </div>
        </form>
      </Modal>
    </Portal>
  );
};

export default RenameCollectionItem;
