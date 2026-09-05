import { flattenItems, isItemARequest } from './index';
import filter from 'lodash/filter';
import find from 'lodash/find';

export const doesRequestMatchSearchText = (item, searchText = '') => {
  const text = searchText.toLowerCase();
  return item?.name?.toLowerCase().includes(text) || item?.request?.url?.toLowerCase().includes(text);
};

export const doesFolderHaveItemsMatchSearchText = (item, searchText = '') => {
  let flattenedItems = flattenItems(item.items);
  let requestItems = filter(flattenedItems, (item) => isItemARequest(item) && !item.isTransient);

  return find(requestItems, (request) => doesRequestMatchSearchText(request, searchText));
};

export const doesCollectionHaveItemsMatchingSearchText = (collection, searchText = '') => {
  let flattenedItems = flattenItems(collection.items);
  let requestItems = filter(flattenedItems, (item) => isItemARequest(item) && !item.isTransient);

  return find(requestItems, (request) => doesRequestMatchSearchText(request, searchText));
};
