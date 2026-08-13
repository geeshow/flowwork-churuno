/**
 * Browser-side .bru/.yml parsing and serialization. @usebruno/filestore is
 * pure JS at the parse/stringify level; its node-only worker/crypto imports
 * are aliased to stubs in rsbuild.config.mjs (web build only touches the
 * synchronous entry points, never the *ViaWorker ones).
 */
export {
  parseRequest,
  stringifyRequest,
  parseCollection,
  stringifyCollection,
  parseFolder,
  stringifyFolder,
  parseEnvironment,
  stringifyEnvironment
} from '@usebruno/filestore';

export const formatForFile = (pathname) => (pathname.endsWith('.yml') || pathname.endsWith('.yaml') ? 'yml' : 'bru');
