/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

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
const mockUnignoreFolder = jest.fn((entry, collectionUid) => ({ type: 'unignoreFolder', entry, collectionUid }));

jest.mock('providers/ReduxStore/slices/collections/actions', () => ({
  setIgnoredFolders: (...args) => mockSetIgnoredFolders(...args),
  unignoreFolder: (...args) => mockUnignoreFolder(...args)
}));

import IgnoredFolders from './index';

const COLLECTION_UID = 'col-1';

const makeCollection = ({ ignore = [], items = [] } = {}) => ({
  uid: COLLECTION_UID,
  pathname: '/coll',
  brunoConfig: { version: '1', name: 'test', type: 'collection', ignore },
  items
});

const folder = (relativePath, items = []) => ({
  uid: `uid-${relativePath}`,
  name: relativePath.split('/').pop(),
  type: 'folder',
  pathname: `/coll/${relativePath}`,
  items
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('IgnoredFolders', () => {
  it('lists managed entries and hides housekeeping ones', () => {
    render(<IgnoredFolders collection={makeCollection({ ignore: ['node_modules', '.git', 'workflows', 'legacy'] })} />);

    expect(screen.getByText('legacy')).toBeInTheDocument();
    expect(screen.queryByText('node_modules')).not.toBeInTheDocument();
    expect(screen.getByTestId('unignore-folder-legacy')).toBeInTheDocument();
  });

  it('renders nothing when there are no entries and no folders', () => {
    const { container } = render(<IgnoredFolders collection={makeCollection()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('still offers Manage when nothing is ignored yet but folders exist', () => {
    render(<IgnoredFolders collection={makeCollection({ items: [folder('api')] })} />);

    expect(screen.getByText('No folders are ignored.')).toBeInTheDocument();
    expect(screen.getByTestId('manage-ignored-folders')).toBeInTheDocument();
  });

  it('Manage lists every folder plus hidden entries, with current ones checked', () => {
    const collection = makeCollection({
      ignore: ['node_modules', 'legacy'],
      items: [folder('core', [folder('core/메타코드')]), folder('api')]
    });
    render(<IgnoredFolders collection={collection} />);

    fireEvent.click(screen.getByTestId('manage-ignored-folders'));

    expect(screen.getByTestId('ignore-folder-checkbox-api')).not.toBeChecked();
    expect(screen.getByTestId('ignore-folder-checkbox-core')).not.toBeChecked();
    expect(screen.getByTestId('ignore-folder-checkbox-core/메타코드')).not.toBeChecked();
    expect(screen.getByTestId('ignore-folder-checkbox-legacy')).toBeChecked();
  });

  it('applies the checked set as one bulk update', () => {
    const collection = makeCollection({ ignore: ['legacy'], items: [folder('api')] });
    render(<IgnoredFolders collection={collection} />);

    fireEvent.click(screen.getByTestId('manage-ignored-folders'));
    fireEvent.click(screen.getByTestId('ignore-folder-checkbox-api'));
    fireEvent.click(screen.getByTestId('apply-ignored-folders'));

    expect(mockSetIgnoredFolders).toHaveBeenCalledTimes(1);
    const [entries, collectionUid] = mockSetIgnoredFolders.mock.calls[0];
    expect([...entries].sort()).toEqual(['api', 'legacy']);
    expect(collectionUid).toBe(COLLECTION_UID);
  });

  it('unchecking an entry drops it from the applied set', () => {
    const collection = makeCollection({ ignore: ['legacy'], items: [] });
    render(<IgnoredFolders collection={collection} />);

    fireEvent.click(screen.getByTestId('manage-ignored-folders'));
    fireEvent.click(screen.getByTestId('ignore-folder-checkbox-legacy'));
    fireEvent.click(screen.getByTestId('apply-ignored-folders'));

    expect(mockSetIgnoredFolders).toHaveBeenCalledWith([], COLLECTION_UID);
  });

  it('"Show all again" restores everything in one call', () => {
    const collection = makeCollection({ ignore: ['legacy', 'other'] });
    render(<IgnoredFolders collection={collection} />);

    fireEvent.click(screen.getByTestId('unignore-all-folders'));

    expect(mockSetIgnoredFolders).toHaveBeenCalledWith([], COLLECTION_UID);
  });

  it('keeps the single-entry restore path on unignoreFolder', () => {
    const collection = makeCollection({ ignore: ['legacy'] });
    render(<IgnoredFolders collection={collection} />);

    expect(screen.queryByTestId('unignore-all-folders')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('unignore-folder-legacy'));

    expect(mockUnignoreFolder).toHaveBeenCalledWith('legacy', COLLECTION_UID);
  });
});
