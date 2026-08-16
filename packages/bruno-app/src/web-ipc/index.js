import registerAiHandlers from './handlers/ai';
import registerBootHandlers from './handlers/boot';
import registerCollectionHandlers from './handlers/collections';
import registerGlobalEnvironmentHandlers from './handlers/global-environments';
import registerNetworkHandlers from './handlers/network';

export const registerWebIpcHandlers = () => {
  registerAiHandlers();
  registerBootHandlers();
  registerCollectionHandlers();
  registerGlobalEnvironmentHandlers();
  registerNetworkHandlers();
};
