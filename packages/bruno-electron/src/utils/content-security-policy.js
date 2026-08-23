const { app, session } = require('electron');

/**
 * Attach a Content-Security-Policy header to every response of a session —
 * what `electron-util`'s setContentSecurityPolicy did. Inlined because
 * electron-util 1.x is ESM-only and moved the helper to a sub-export.
 *
 * @param {string} policy   directives, each terminated by ';'
 * @param {{ session?: Electron.Session }} [options]
 */
const setContentSecurityPolicy = async (policy, options = {}) => {
  await app.whenReady();

  if (!policy.split('\n').filter((line) => line.trim()).every((line) => line.endsWith(';'))) {
    throw new Error('Each line must end in a semicolon');
  }

  const normalized = policy.replace(/[\t\n]/g, '').trim();
  const ses = options.session || session.defaultSession;

  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [normalized]
      }
    });
  });
};

module.exports = { setContentSecurityPolicy };
