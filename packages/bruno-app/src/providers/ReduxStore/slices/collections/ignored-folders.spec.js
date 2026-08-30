jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'mock-uid'
}));

jest.mock('@usebruno/schema', () => ({
  collectionSchema: { validate: () => Promise.resolve() },
  environmentSchema: { validate: () => Promise.resolve() },
  itemSchema: { validate: () => Promise.resolve() }
}));

import { configureStore } from '@reduxjs/toolkit';
import collectionsReducer from 'providers/ReduxStore/slices/collections';
import { setIgnoredFolders } from 'providers/ReduxStore/slices/collections/actions';

const COLLECTION_UID = 'col-1';
const COLLECTION_PATH = '/coll';

const folder = (name, items = []) => ({
  uid: `uid-${name}`,
  name,
  type: 'folder',
  pathname: `${COLLECTION_PATH}/${name}`,
  items
});

let invokedArgs;

beforeEach(() => {
  invokedArgs = [];
  window.ipcRenderer = {
    invoke: jest.fn((...args) => {
      invokedArgs.push(args);
      // renderer:set-ignored-folders resolves with the updated bruno config
      return Promise.resolve({ version: '1', name: 'test', type: 'collection', ignore: args[3] });
    })
  };
});

const createStore = ({ ignore, items }) => {
  return configureStore({
    reducer: { collections: collectionsReducer },
    preloadedState: {
      collections: {
        collections: [
          {
            uid: COLLECTION_UID,
            pathname: COLLECTION_PATH,
            root: {},
            brunoConfig: { version: '1', name: 'test', type: 'collection', ignore },
            environments: [],
            items
          }
        ],
        collectionSortOrder: 'default',
        activeWorkspaceUid: null
      }
    }
  });
};

const getCollection = (store) => store.getState().collections.collections[0];

describe('setIgnoredFolders', () => {
  it('replaces managed entries while preserving housekeeping ones', async () => {
    const store = createStore({
      ignore: ['node_modules', '.git', 'workflows', 'legacy'],
      items: [folder('api')]
    });

    await store.dispatch(setIgnoredFolders(['api'], COLLECTION_UID));

    expect(invokedArgs).toEqual([
      ['renderer:set-ignored-folders', COLLECTION_UID, COLLECTION_PATH, ['node_modules', '.git', 'workflows', 'api']]
    ]);
    expect(getCollection(store).brunoConfig.ignore).toEqual(['node_modules', '.git', 'workflows', 'api']);
  });

  it('removes newly ignored folders from the tree, including nested ones', async () => {
    const nested = { ...folder('core/메타코드'), name: '메타코드' };
    const store = createStore({
      ignore: ['node_modules'],
      items: [folder('core', [nested]), folder('api')]
    });

    await store.dispatch(setIgnoredFolders(['core/메타코드'], COLLECTION_UID));

    const items = getCollection(store).items;
    expect(items.map((i) => i.name)).toEqual(['core', 'api']);
    expect(items[0].items).toEqual([]);
  });

  it('clearing every entry keeps housekeeping and deletes nothing from the tree', async () => {
    const store = createStore({
      ignore: ['node_modules', '.git', 'legacy', 'other'],
      items: [folder('api')]
    });

    await store.dispatch(setIgnoredFolders([], COLLECTION_UID));

    expect(invokedArgs[0][3]).toEqual(['node_modules', '.git']);
    expect(getCollection(store).items).toHaveLength(1);
  });

  it('entries that were already ignored are not deleted again', async () => {
    const store = createStore({
      ignore: ['legacy'],
      items: [folder('legacy'), folder('api')]
    });

    // 'legacy' is already in the config — only 'api' is newly ignored
    await store.dispatch(setIgnoredFolders(['legacy', 'api'], COLLECTION_UID));

    expect(getCollection(store).items.map((i) => i.name)).toEqual(['legacy']);
  });

  it('rejects when the collection does not exist', async () => {
    const store = createStore({ ignore: [], items: [] });

    await expect(store.dispatch(setIgnoredFolders([], 'missing'))).rejects.toThrow('Collection not found');
    expect(invokedArgs).toHaveLength(0);
  });
});
