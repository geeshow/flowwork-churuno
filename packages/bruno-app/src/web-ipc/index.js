import registerBootHandlers from './handlers/boot';
import registerCollectionHandlers from './handlers/collections';
import registerNetworkHandlers from './handlers/network';

export const registerWebIpcHandlers = () => {
  registerBootHandlers();
  registerCollectionHandlers();
  registerNetworkHandlers();
};
