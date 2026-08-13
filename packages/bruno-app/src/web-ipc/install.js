/**
 * Must be the first import of the app entry: several modules destructure
 * `window.ipcRenderer` at module-evaluation time, so the shim object has to
 * exist before the rest of the module graph evaluates. Handler registration
 * happens later (registerWebIpcHandlers) — the object identity is what matters
 * here.
 */
import { shim } from './core';

if (typeof window !== 'undefined' && !window.ipcRenderer) {
  window.__BRUNO_WEB_MODE__ = true;
  window.ipcRenderer = shim;
}
