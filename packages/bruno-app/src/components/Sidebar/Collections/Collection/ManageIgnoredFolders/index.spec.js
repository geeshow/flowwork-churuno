/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

const mockDispatch = jest.fn(() => Promise.resolve());

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() }
}));

const mockSetIgnoredFolders = jest.fn((entries, collectionUid) => ({ type: 'setIgnoredFolders', entries, collectionUid }));

jest.mock('providers/ReduxStore/slices/collections/actions', () => ({
  setIgnoredFolders: (...args) => mockSetIgnoredFolders(...args),
  closeTabs: (payload) => ({ type: 'closeTabs', payload })
}));

jest.mock('components/Modal', () => {
  return function MockModal({ title, children, handleConfirm, handleCancel }) {
    return (
      <div>
        <div>{title}</div>
        {children}
        <button type="button" onClick={handleConfirm}>Apply</button>
        <button type="button" onClick={handleCancel}>Cancel</button>
      </div>
    );
  };
});

import ManageIgnoredFolders from './index';

const COLLECTION_UID = 'col-1';

const theme = {
  font: { size: { xs: '11px' } },
  colors: { text: { muted: '#888' } },
  background: { surface1: '#eee' },
  border: { radius: { base: '4px' } }
};

const folder = (relativePath, items = []) => ({
  uid: `uid-${relativePath}`,
  name: relativePath.split('/').pop(),
  type: 'folder',
  pathname: `/coll/${relativePath}`,
  items
});

const makeCollection = ({ ignore = [], items = [] } = {}) => ({
  uid: COLLECTION_UID,
  pathname: '/coll',
  brunoConfig: { version: '1', name: 'test', type: 'collection', ignore },
  items
});

const renderModal = (collection, onClose = jest.fn()) =>
  render(
    <ThemeProvider theme={theme}>
      <ManageIgnoredFolders collection={collection} onClose={onClose} />
    </ThemeProvider>
  );

const checkbox = (rel) => screen.getByTestId(`folder-visible-checkbox-${rel}`);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ManageIgnoredFolders', () => {
  it('renders the folder tree with visible folders checked and ignored entries unchecked', () => {
    renderModal(makeCollection({
      ignore: ['node_modules', '.git', 'legacy'],
      items: [folder('core', [folder('core/계좌')])]
    }));

    expect(checkbox('core')).toBeChecked();
    expect(checkbox('core/계좌')).toBeChecked();
    expect(checkbox('legacy')).not.toBeChecked();
    // 하우스키핑 항목은 목록에 나타나지 않는다
    expect(screen.queryByTestId('folder-visible-checkbox-node_modules')).not.toBeInTheDocument();
  });

  it('unchecking a parent unchecks and disables its descendants', () => {
    renderModal(makeCollection({ items: [folder('core', [folder('core/계좌', [folder('core/계좌/deep')])])] }));

    fireEvent.click(checkbox('core'));

    expect(checkbox('core')).not.toBeChecked();
    expect(checkbox('core/계좌')).not.toBeChecked();
    expect(checkbox('core/계좌')).toBeDisabled();
    expect(checkbox('core/계좌/deep')).toBeDisabled();
  });

  it('records only the topmost hidden folder on apply', () => {
    renderModal(makeCollection({ items: [folder('core', [folder('core/계좌')])] }));

    fireEvent.click(checkbox('core/계좌'));
    fireEvent.click(checkbox('core'));
    fireEvent.click(screen.getByText('Apply'));

    expect(mockSetIgnoredFolders).toHaveBeenCalledWith(['core'], COLLECTION_UID);
  });

  it('re-checking a parent restores a descendant to its own state', () => {
    renderModal(makeCollection({ items: [folder('core', [folder('core/계좌')])] }));

    fireEvent.click(checkbox('core/계좌'));
    fireEvent.click(checkbox('core'));
    fireEvent.click(checkbox('core'));

    expect(checkbox('core')).toBeChecked();
    expect(checkbox('core/계좌')).not.toBeChecked();
    expect(checkbox('core/계좌')).not.toBeDisabled();
  });

  it('checking a hidden folder removes it from the applied entries', () => {
    renderModal(makeCollection({ ignore: ['legacy'], items: [] }));

    fireEvent.click(checkbox('legacy'));
    fireEvent.click(screen.getByText('Apply'));

    expect(mockSetIgnoredFolders).toHaveBeenCalledWith([], COLLECTION_UID);
  });
});
