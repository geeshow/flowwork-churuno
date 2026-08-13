// Browser stub for node:crypto — only the filestore redaction utilities use
// createHash, and web mode never calls them.
export const createHash = () => {
  throw new Error('node:crypto is not available in the browser');
};
export default { createHash };
