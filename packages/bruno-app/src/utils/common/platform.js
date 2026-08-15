import trim from 'lodash/trim';
import platform from 'platform';
import path from './path';

export const isElectron = () => {
  if (!window) {
    return false;
  }

  return window.ipcRenderer ? true : false;
};

// Web mode: the app runs in a browser against the Python execution server.
// The IPC shim (web-ipc/install.js) sets this flag; desktop-only features
// (native dialogs, shell integration, local-port servers) are hidden when true.
export const isWebMode = () => {
  return typeof window !== 'undefined' && window.__BRUNO_WEB_MODE__ === true;
};

export const resolveRequestFilename = (name, extension = 'bru') => {
  return `${trim(name)}.${extension}`;
};

export const getSubdirectoriesFromRoot = (rootPath, pathname) => {
  const relativePath = path.relative(rootPath, pathname);
  return relativePath ? relativePath.split(path.sep) : [];
};

export const isWindowsOS = () => {
  const os = platform.os;
  const osFamily = os.family.toLowerCase();

  return osFamily.includes('windows');
};

export const isMacOS = () => {
  const os = platform.os;
  const osFamily = os.family.toLowerCase();

  return osFamily.includes('os x');
};

export const isLinuxOS = () => {
  const os = platform.os;
  const osFamily = os.family.toLowerCase();

  return osFamily.includes('linux') || osFamily.includes('ubuntu') || osFamily.includes('debian') || osFamily.includes('fedora') || osFamily.includes('centos') || osFamily.includes('arch');
};

export const getPlatformModifierKey = () => {
  return isMacOS() ? '⌘' : 'Ctrl';
};

export const getAppInstallDate = () => {
  let dateString = localStorage.getItem('bruno.installedOn');

  if (!dateString) {
    dateString = new Date().toISOString();
    localStorage.setItem('bruno.installedOn', dateString);
  }

  const date = new Date(dateString);
  return date;
};
