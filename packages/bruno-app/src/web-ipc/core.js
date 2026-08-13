/**
 * In-browser stand-in for the Electron IPC bridge (see bruno-electron/src/preload.js).
 *
 * `invoke`/`send` dispatch to locally registered handlers; `on` subscribes to
 * events the handlers synthesize via `emit`. Kept dependency-free so it can be
 * installed onto `window` before any other app module evaluates.
 */

const handlers = new Map();
const listeners = new Map();

export const handle = (channel, handler) => {
  handlers.set(channel, handler);
};

// Events are delivered on a fresh task to mimic real IPC arrival and avoid
// dispatching redux actions from inside another dispatch.
export const emit = (channel, ...args) => {
  setTimeout(() => {
    const channelListeners = listeners.get(channel);
    if (!channelListeners || !channelListeners.size) {
      return;
    }
    [...channelListeners].forEach((listener) => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`[web-ipc] listener for "${channel}" failed`, error);
      }
    });
  }, 0);
};

const invoke = async (channel, ...args) => {
  const handler = handlers.get(channel);
  if (!handler) {
    console.warn(`[web-ipc] no handler for channel "${channel}" — resolving undefined`);
    return undefined;
  }
  return handler(...args);
};

export const shim = {
  invoke,
  send: (channel, ...args) => {
    invoke(channel, ...args).catch((error) => console.error(`[web-ipc] send to "${channel}" failed`, error));
  },
  on: (channel, handler) => {
    if (!listeners.has(channel)) {
      listeners.set(channel, new Set());
    }
    listeners.get(channel).add(handler);
    return () => {
      listeners.get(channel)?.delete(handler);
    };
  },
  getFilePath: () => {
    throw new Error('Local file paths are not available in Bruno web mode');
  },
  openExternal: (url) => {
    window.open(url, '_blank', 'noopener');
  }
};
