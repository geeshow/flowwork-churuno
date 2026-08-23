const electron = require('electron');

/**
 * Whether the app runs unpackaged (dev) — what `electron-is-dev` used to
 * answer. Inlined because electron-is-dev 3 is ESM-only and the main process
 * is CommonJS. `ELECTRON_IS_DEV=1|0` still overrides, as before.
 */
const isEnvSet = 'ELECTRON_IS_DEV' in process.env;
const getFromEnv = Number.parseInt(process.env.ELECTRON_IS_DEV, 10) === 1;

module.exports = isEnvSet ? getFromEnv : !electron.app.isPackaged;
