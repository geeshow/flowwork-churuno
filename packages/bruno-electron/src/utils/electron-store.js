/**
 * electron-store 9+ ships as ESM only. The main process is CommonJS, so
 * require() hands back the module namespace and the class sits on `default`.
 * Every store module goes through here so that detail lives in one place
 * (and so Jest's __mocks__/electron-store.js keeps working unchanged).
 */
const mod = require('electron-store');

module.exports = mod.default || mod;
